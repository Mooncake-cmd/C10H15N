// Fase 3F: missões. Funções puras sobre a "corrida" de uma missão (o progresso de quem está
// jogando uma), sem DOM. As transições que mexem no estado do jogo (concluir missão → objetivos
// de nível) ficam em progression.js, que usa estas funções.
//
// Uma missão tem um kit limitado (só ele vale na bancada), um máximo de tentativas (cada
// combinação e cada resposta errada gasta uma) e etapas: ações (fazer uma reação, produzir uma
// substância, observar um resultado) e perguntas (escolha, ou conta com o caminho mostrado).

import { lookupReaction } from './engine.js';
import { stoichiometry, MOLAR_VOLUME_L } from './stoichiometry.js';
import { molarMass } from './formula.js';

export const ACTION_KINDS = ['reaction', 'produce', 'observe'];
export const QUESTION_KINDS = ['choice', 'calc'];
export const isAction = (step) => ACTION_KINDS.includes(step.kind);

/** Corrida nova de uma missão. */
export const newRun = (mission) => ({ id: mission.id, done: [], got: [], attempts: 0, failed: false });

/** A missão está liberada? (o nível `after` precisa estar concluído) */
export function isMissionAvailable(mission, state, data) {
  if (state.finished) return true;
  const idx = data.progression.levels.findIndex((l) => l.id === mission.after);
  return idx >= 0 && state.levelIndex > idx;
}

/** Substâncias e ferramentas que valem durante a missão: o kit + o que já foi produzido nela. */
export function missionInventory(run, mission) {
  return { substances: [...new Set([...mission.kit.substances, ...run.got])], items: [...(mission.kit.items ?? [])] };
}

/**
 * Etapas que podem ser feitas agora: a primeira pendente e, se for uma ação numa missão sem
 * ordem estrita, as ações pendentes seguidas a ela (até a próxima pergunta).
 */
export function currentSteps(run, mission) {
  const pending = mission.steps.filter((s) => !run.done.includes(s.id));
  if (!pending.length) return [];
  const first = pending[0];
  if (!isAction(first) || mission.ordered) return [first];
  const start = mission.steps.indexOf(first);
  const group = [];
  for (const s of mission.steps.slice(start)) {
    if (!isAction(s)) break;
    if (!run.done.includes(s.id)) group.push(s);
  }
  return group;
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/** A combinação feita (seleção + resultado do motor) cumpre esta etapa de ação? */
export function actionMatches(step, selection, result) {
  if (step.kind === 'reaction') return result.kind === 'reaction' && result.reaction.id === step.reaction;
  if (step.kind === 'produce') return result.kind === 'reaction' && result.reaction.products.some((p) => p.id === step.substance);
  if (step.kind === 'observe') return sameSet(selection, step.selection) && result.kind === step.expect;
  return false;
}

const remaining = (run, mission) => mission.maxAttempts - run.attempts;
const isComplete = (run, mission) => mission.steps.every((s) => run.done.includes(s.id));

/**
 * Gasta uma tentativa. A missão falha quando as tentativas acabam e ainda falta uma ação (que
 * precisa de uma combinação), ou quando se erra uma pergunta sem tentativas sobrando.
 * Respostas certas não gastam tentativa.
 */
function spend(run, mission) {
  const r = { ...run, attempts: run.attempts + 1 };
  if (isComplete(r, mission)) return r;
  const left = remaining(r, mission);
  const needsAction = mission.steps.some((s) => !r.done.includes(s.id) && isAction(s));
  if (left < 0 || (left === 0 && needsAction)) r.failed = true;
  return r;
}

/** Tentativas que ainda restam. */
export const attemptsLeft = (run, mission) => Math.max(0, remaining(run, mission));

/**
 * Uma combinação feita na bancada durante a missão.
 * @returns {{ run, completed: object[] (etapas cumpridas), finished: boolean }}
 */
export function runCombine(run, mission, selection, result) {
  if (run.failed || isComplete(run, mission)) return { run, completed: [], finished: false };
  let r = { ...run };
  const completed = currentSteps(r, mission).filter((s) => actionMatches(s, selection, result));
  // Uma combinação cumpre no máximo uma etapa (a primeira que bate).
  const step = completed[0];
  if (step) r = { ...r, done: [...r.done, step.id] };
  if (result.kind === 'reaction') r.got = [...new Set([...r.got, ...result.reaction.products.map((p) => p.id)])];
  r = spend(r, mission);
  return { run: r, completed: step ? [step] : [], finished: isComplete(r, mission) };
}

/**
 * Resposta a uma pergunta da missão (a pergunta precisa ser a etapa atual).
 * @returns {{ run, correct: boolean, finished: boolean, why?: string }}
 */
export function runAnswer(run, mission, stepId, answer, data) {
  const step = mission.steps.find((s) => s.id === stepId);
  if (!step || run.failed || !currentSteps(run, mission).includes(step) || isAction(step)) return { run, correct: false, finished: false };
  const correct = isMissionAnswerRight(step, answer, data);
  const why = step.kind === 'choice' ? step.choices.find((c) => String(c.value) === String(answer))?.why : undefined;
  let r = run;
  if (correct) r = { ...run, done: [...run.done, step.id] };
  else r = spend(run, mission);
  return { run: r, correct, finished: isComplete(r, mission), why };
}

// ---------------- Contas ----------------

const fmt = (x, digits = 3) => Number(x.toPrecision(digits)).toLocaleString('pt-BR', { maximumFractionDigits: 6 });

/**
 * Titulação (Atkins & Jones, seção L.3): mol do titulante = c × V; mol do analito pela proporção
 * da equação; concentração = mol ÷ volume da amostra.
 */
export function titration(calc, data) {
  const r = lookupReaction(data, calc.reaction);
  if (!r) throw new Error(`reação ${calc.reaction}`);
  const coef = (id) => r.reactants.find((e) => e.id === id)?.coef;
  const cT = coef(calc.titrant);
  const cA = coef(calc.analyte);
  if (!cT || !cA) throw new Error(`${calc.analyte} e ${calc.titrant} precisam ser reagentes de ${calc.reaction}`);
  const nTitrant = calc.titrantM * (calc.titrantML / 1000);
  const nAnalyte = (nTitrant * cA) / cT;
  const M = nAnalyte / (calc.sampleML / 1000);
  const mm = molarMass(data.substancesById.get(calc.analyte).formula, data.atomicMasses);
  return { nTitrant, nAnalyte, M, molarMass: mm, gL: M * mm, ratio: [cA, cT] };
}

/** Resposta certa de uma pergunta de conta. */
export function calcAnswer(step, data) {
  const c = step.calc;
  if (c.type === 'titration') {
    const t = titration(c, data);
    return c.ask === 'gL' ? t.gL : t.M;
  }
  if (c.type === 'stoich') {
    const res = stoichiometry(lookupReaction(data, c.reaction), data, c.given);
    const p = res.products.find((x) => x.id === c.ask);
    return c.unit === 'mol' ? p.mol : c.unit === 'L' ? p.liters : p.grams;
  }
  throw new Error(`conta desconhecida: ${c.type}`);
}

/** Resposta certa de qualquer pergunta da missão. */
export const missionAnswer = (step, data) => (step.kind === 'choice' ? step.answer : calcAnswer(step, data));

/** Escolha exata; conta com tolerância de 2% (arredondamentos de massa molar). */
export function isMissionAnswerRight(step, answer, data) {
  if (step.kind === 'choice') return String(answer) === String(step.answer);
  const expected = calcAnswer(step, data);
  const x = Number(String(answer).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(x) && Math.abs(x - expected) <= 0.02 * Math.abs(expected);
}

/** O caminho da conta, passo a passo e com os números (mostrado depois da resposta certa). */
export function calcWorked(step, data) {
  const c = step.calc;
  const F = (id) => data.substancesById.get(id).formula;
  if (c.type === 'titration') {
    const t = titration(c, data);
    const lines = [
      `mol de ${F(c.titrant)} = ${fmt(c.titrantM)} mol/L × ${fmt(c.titrantML / 1000)} L = ${fmt(t.nTitrant)} mol`,
      `pela equação, ${t.ratio[1]} mol de ${F(c.titrant)} reage com ${t.ratio[0]} mol de ${F(c.analyte)}: ${fmt(t.nAnalyte)} mol de ${F(c.analyte)}`,
      `concentração = ${fmt(t.nAnalyte)} mol ÷ ${fmt(c.sampleML / 1000)} L = ${fmt(t.M)} mol/L`,
    ];
    if (c.ask === 'gL') lines.push(`massa por litro = ${fmt(t.M)} mol/L × ${fmt(t.molarMass, 4)} g/mol = ${fmt(t.gL)} g/L`);
    return lines;
  }
  if (c.type === 'stoich') {
    const r = lookupReaction(data, c.reaction);
    const res = stoichiometry(r, data, c.given);
    const [gid] = Object.keys(c.given);
    const g = res.reactants.find((x) => x.id === gid);
    const p = res.products.find((x) => x.id === c.ask);
    const lines = [];
    if ('g' in c.given[gid]) lines.push(`mol de ${F(gid)} = ${fmt(c.given[gid].g)} g ÷ ${fmt(g.molarMass, 4)} g/mol = ${fmt(g.mol)} mol`);
    else lines.push(`mol de ${F(gid)} = ${fmt(g.mol)} mol`);
    lines.push(`pela equação, ${g.coef} mol de ${F(gid)} dá ${p.coef} mol de ${F(c.ask)}: ${fmt(p.mol)} mol de ${F(c.ask)}`);
    if (c.unit === 'L') lines.push(`volume = ${fmt(p.mol)} mol × ${fmt(MOLAR_VOLUME_L, 4)} L/mol = ${fmt(p.liters)} L (25 °C e 1 atm)`);
    else if (c.unit !== 'mol') lines.push(`massa = ${fmt(p.mol)} mol × ${fmt(p.molarMass, 4)} g/mol = ${fmt(p.grams)} g`);
    return lines;
  }
  return [];
}
