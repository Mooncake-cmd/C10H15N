// Progressão pedagógica: níveis, desbloqueios e objetivos. Funções puras sobre um estado
// serializável (vai para o localStorage como JSON), para facilitar testes e evolução.
//
// Extensão: novos tipos de objetivo entram em OBJECTIVE_CHECKS (ex.: Fase 2 — "produza 10 g de
// NaCl" com estequiometria; Fase 3 — missões com várias etapas).

import { lookupReaction } from './engine.js';
import { stoichiometry, percentYield } from './stoichiometry.js';
import { reactionThermo, heatFor } from './thermo.js';
import { kineticsAnswer } from './kinetics.js';
import { equilibriumAnswer } from './equilibrium.js';
import { moleculeAnswer } from './vsepr.js';
import { organicAnswer } from './organic.js';
import { newRun, runCombine, runAnswer, runLab, isMissionAvailable } from './missions.js';
import { FUNDAMENTAL_TYPES, isFundamentalsAnswerRight } from './fundamentals.js';
import { scheduleReview, sanitizeReviews, dueReviews } from './review.js';
import { isResting, recordWrong, sanitizeAttempts } from './guard.js';

export const STATE_VERSION = 3;
// v1 → v2: um nível novo (metais alcalino-terrosos) entrou no meio da Fase 1, então o
// levelIndex salvo deixou de valer. A migração refaz o caminho a partir do histórico.
// v2 → v3: Fase 4 (fundamentos no começo e degraus no meio). Níveis marcados com `since: 3`
// são novos: para quem já jogava, as perguntas deles contam como respondidas (o jogador não
// é mandado de volta ao começo) e o caminho é refeito pelo histórico.

export function initialState(data) {
  const state = {
    version: STATE_VERSION,
    levelIndex: 0,
    finished: false,
    unlockedElements: [],
    unlockedSubstances: [],
    unlockedItems: [],
    produced: [], // substâncias obtidas como produto de reação (= "descobertas")
    reactionsDone: [],
    nonReactionsSeen: [],
    completedObjectives: [],
    stoichSolved: [], // objetivos de cálculo (estequiometria, cinética) respondidos corretamente
    missionsDone: [], // missões concluídas (Fase 3F)
    missionRun: null, // missão em andamento: { id, done, got, attempts, failed }
    reviews: {}, // revisão espaçada (Fase 4C): { idDoObjetivo: { box, due, done? } }
    reviewHits: 0, // revisões acertadas (conta como avanço para liberar perguntas em descanso)
    attempts: {}, // erros por pergunta do nível (Fase 4D): { idDoObjetivo: { wrong, restAt? } }
  };
  return applyUnlocks(state, data.progression.levels[0]);
}

function applyUnlocks(state, level) {
  const u = level.unlocks ?? {};
  const add = (arr, more = []) => [...new Set([...arr, ...more])];
  return {
    ...state,
    unlockedElements: add(state.unlockedElements, u.elements),
    unlockedSubstances: add(state.unlockedSubstances, u.substances),
    unlockedItems: add(state.unlockedItems, u.items),
  };
}

/** Substâncias e ferramentas disponíveis para o jogador. */
export function inventory(state, data) {
  const subs = new Set();
  for (const sym of state.unlockedElements) {
    const el = data.elementalBySymbol.get(sym);
    if (el) subs.add(el.id);
  }
  state.unlockedSubstances.forEach((id) => subs.add(id));
  state.produced.forEach((id) => subs.add(id));
  return { substances: [...subs], items: [...state.unlockedItems] };
}

const OBJECTIVE_CHECKS = {
  produce: (o, h) => h.produced.has(o.substance),
  produceCategory: (o, h, data) => [...h.produced].some((id) => data.substancesById.get(id)?.categories.includes(o.category)),
  reactionType: (o, h, data) =>
    [...h.reactionsDone].some((rid) => {
      const r = lookupReaction(data, rid);
      return !!r && r.types.includes(o.reactionType) && (!o.withReactant || r.reactants.some((e) => e.id === o.withReactant));
    }),
  nonReaction: (o, h) => h.nonReactionsSeen.has(o.reasonId),
  reaction: (o, h) => h.reactionsDone.has(o.reaction),
  stoich: (o, h) => h.stoichSolved.has(o.id),
  // Fase 3B: pergunta de cinética (meia-vida, concentração depois de um tempo, efeito da temperatura).
  kinetics: (o, h) => h.stoichSolved.has(o.id),
  // Fase 3C: pergunta de equilíbrio (pH, tampão, Kps, Le Chatelier).
  equilibrium: (o, h) => h.stoichSolved.has(o.id),
  // Fase 3D: pergunta sobre a forma de uma molécula (forma, polaridade, pares isolados, hibridização).
  molecule: (o, h) => h.stoichSolved.has(o.id),
  // Fase 3E: pergunta de química orgânica (nome oficial, função, isomeria).
  organic: (o, h) => h.stoichSolved.has(o.id),
  // Fase 4: perguntas dos fundamentos (escolha, átomo, elétrons, estado físico, nomes).
  ...Object.fromEntries(FUNDAMENTAL_TYPES.map((t) => [t, (o, h) => h.stoichSolved.has(o.id)])),
  // Fase 3F: concluir uma missão.
  mission: (o, h) => h.missionsDone.has(o.mission),
  // Fase 3A: ter feito uma reação que libera (exo) ou absorve (endo) calor, opcionalmente com |ΔH°| mínimo.
  thermo: (o, h, data) =>
    [...h.reactionsDone].some((rid) => {
      const r = lookupReaction(data, rid);
      const dH = r ? reactionThermo(r, data).dH : null;
      if (dH == null) return false;
      return (o.sign === 'endo' ? dH > 0 : dH < 0) && (!o.minKJ || Math.abs(dH) >= o.minKJ);
    }),
};

export function isObjectiveDone(objective, state, data) {
  const check = OBJECTIVE_CHECKS[objective.type];
  if (!check) throw new Error(`Tipo de objetivo desconhecido: ${objective.type}`);
  const history = {
    produced: new Set(state.produced),
    reactionsDone: new Set(state.reactionsDone),
    nonReactionsSeen: new Set(state.nonReactionsSeen),
    stoichSolved: new Set(state.stoichSolved ?? []),
    missionsDone: new Set(state.missionsDone ?? []),
  };
  return check(objective, history, data);
}

export const OBJECTIVE_TYPES = Object.keys(OBJECTIVE_CHECKS);

/**
 * Aplica o resultado de uma combinação ao estado.
 * @returns {{state: object, events: {type: string, [k: string]: any}[]}}
 */
export function applyResult(state, result, data) {
  const events = [];
  let s = { ...state };

  if (result.kind === 'reaction') {
    const r = result.reaction;
    if (!s.reactionsDone.includes(r.id)) {
      s.reactionsDone = [...s.reactionsDone, r.id];
      events.push({ type: 'first-reaction', reaction: r });
    }
    for (const p of r.products) {
      if (!s.produced.includes(p.id)) {
        s.produced = [...s.produced, p.id];
        events.push({ type: 'discovered', substance: data.substancesById.get(p.id) });
      }
    }
  } else if (result.kind === 'no-reaction' && result.reasonId && !s.nonReactionsSeen.includes(result.reasonId)) {
    s.nonReactionsSeen = [...s.nonReactionsSeen, result.reasonId];
  }

  s = advance(s, data, events);
  return { state: s, events };
}

/**
 * Confere objetivos; ao completar um nível, desbloqueia o próximo (e reconfere, pois o histórico
 * pode já cumprir objetivos do nível novo).
 */
function advance(s, data, events) {
  const levels = data.progression.levels;
  while (!s.finished) {
    const level = levels[s.levelIndex];
    for (const o of level.objectives) {
      if (!s.completedObjectives.includes(o.id) && isObjectiveDone(o, s, data)) {
        s.completedObjectives = [...s.completedObjectives, o.id];
        events.push({ type: 'objective', objective: o, level });
      }
    }
    if (!level.objectives.every((o) => s.completedObjectives.includes(o.id))) break;
    events.push({ type: 'level-complete', level });
    if (s.levelIndex + 1 >= levels.length) {
      s.finished = true;
      events.push({ type: 'game-complete' });
      break;
    }
    s.levelIndex += 1;
    s = applyUnlocks(s, levels[s.levelIndex]);
    events.push({ type: 'level-start', level: levels[s.levelIndex] });
  }
  return s;
}

/**
 * Resposta certa de um objetivo de estequiometria:
 *   ask 'limiting' → id do reagente limitante;
 *   ask 'yield'    → rendimento percentual (actual: { id, g } é a massa obtida de verdade);
 *   ask 'heat'     → calor liberado em kJ (Fase 3A; precisa de ΔH° conhecido);
 *   ask <produto>  → quantidade do produto na unidade `unit` ('g' padrão, 'mol' ou 'L' de gás a 25 °C e 1 atm).
 */
export function stoichAnswer(objective, data) {
  const res = stoichiometry(lookupReaction(data, objective.reaction), data, objective.given);
  if (objective.ask === 'limiting') return res.limiting;
  if (objective.ask === 'heat') {
    // calor LIBERADO, em kJ (positivo numa reação exotérmica): −ξ·ΔH°
    return -heatFor(res.extent, reactionThermo(lookupReaction(data, objective.reaction), data).dH);
  }
  if (objective.ask === 'yield') {
    const p = res.products.find((x) => x.id === objective.actual.id);
    return percentYield(objective.actual.g, p.grams);
  }
  const p = res.products.find((x) => x.id === objective.ask);
  return objective.unit === 'mol' ? p.mol : objective.unit === 'L' ? p.liters : p.grams;
}

/** Tolerância de 2% (arredondamentos de massa molar), com um mínimo de 0,01. */
export function isStoichAnswerRight(objective, answer, data) {
  const expected = stoichAnswer(objective, data);
  if (objective.ask === 'limiting') return answer === expected;
  const x = Number(String(answer).replace(',', '.').replace('%', '').trim());
  return Number.isFinite(x) && Math.abs(x - expected) <= Math.max(0.02 * Math.abs(expected), 0.01);
}

/** Resposta numérica com tolerância de 2% (arredondamentos de k, de ln 2 e de massa molar). */
export function isKineticsAnswerRight(objective, answer, data) {
  const expected = kineticsAnswer(objective, data.kinetics);
  const x = Number(String(answer).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(x) && Math.abs(x - expected) <= 0.02 * Math.abs(expected);
}

/** Equilíbrio: escolha exata (Le Chatelier); pH com ±0,02; demais números com 2%. */
export function isEquilibriumAnswerRight(objective, answer, data) {
  const expected = equilibriumAnswer(objective, data);
  if (objective.choices) return answer === expected;
  const x = Number(String(answer).replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(x)) return false;
  return objective.ask === 'pH' || objective.ask === 'bufferPH' ? Math.abs(x - expected) <= 0.02 : Math.abs(x - expected) <= 0.02 * Math.abs(expected);
}

/** Forma molecular: escolha exata, ou número inteiro (pares isolados, ângulo). */
export function isMoleculeAnswerRight(objective, answer, data) {
  const expected = moleculeAnswer(objective, data);
  if (objective.choices) return String(answer) === String(expected);
  const x = Number(String(answer).replace(',', '.').replace('°', '').trim());
  return Number.isFinite(x) && Math.abs(x - expected) < 0.5;
}

/** Orgânica: sempre escolha (nome, função, isômero, tipo de isomeria). */
export const isOrganicAnswerRight = (objective, answer, data) => String(answer) === String(organicAnswer(objective, data));

const ANSWER_CHECKS = {
  ...Object.fromEntries(FUNDAMENTAL_TYPES.map((t) => [t, isFundamentalsAnswerRight])),
  stoich: isStoichAnswerRight,
  kinetics: isKineticsAnswerRight,
  equilibrium: isEquilibriumAnswerRight,
  molecule: isMoleculeAnswerRight,
  organic: isOrganicAnswerRight,
};

/** O objetivo é uma pergunta (dá para responder de novo numa revisão)? */
export const isAnswerObjective = (o) => !!ANSWER_CHECKS[o.type];

/** Perguntas de revisão que vencem agora (Fase 4C). */
export const reviewsDue = (state, data, max) => dueReviews(state, data, isAnswerObjective, max);

/**
 * Resposta a uma pergunta de revisão: só muda o agendamento da revisão (acerto: volta mais
 * tarde; erro: volta no próximo nível), nunca os objetivos dos níveis.
 * @returns {{ state, correct, entry }}
 */
export function answerReview(state, objectiveId, answer, data) {
  const objective = data.progression.levels.flatMap((l) => l.objectives).find((o) => o.id === objectiveId);
  if (!objective || !isAnswerObjective(objective) || !(state.stoichSolved ?? []).includes(objectiveId)) return { state, correct: false, entry: null };
  const correct = ANSWER_CHECKS[objective.type](objective, answer, data);
  const res = scheduleReview(state, objectiveId, correct, data);
  const s = correct ? { ...res.state, reviewHits: (state.reviewHits ?? 0) + 1 } : res.state;
  return { state: s, correct, entry: res.entry };
}

/**
 * Pergunta do nível em descanso (tentativas esgotadas, Fase 4D)? Só enquanto houver outra coisa
 * para fazer: outro objetivo pendente fora de descanso ou uma revisão — o jogo nunca trava.
 */
export function questionResting(objective, state, data) {
  if (!isResting(objective, state, data)) return false;
  const level = data.progression.levels[state.levelIndex];
  const others = (level?.objectives ?? []).filter((o) => o.id !== objective.id && !state.completedObjectives.includes(o.id) && !isObjectiveDone(o, state, data));
  const canDoElse = others.some((o) => !isAnswerObjective(o) || !isResting(o, state, data)) || reviewsDue(state, data).length > 0;
  return canDoElse;
}

/** O jogador respondeu a um objetivo de cálculo (estequiometria ou cinética). */
export function answerObjective(state, objectiveId, answer, data) {
  const events = [];
  const objective = data.progression.levels.flatMap((l) => l.objectives).find((o) => o.id === objectiveId);
  if (!objective || !ANSWER_CHECKS[objective.type]) return { state, events, correct: false };
  if (questionResting(objective, state, data)) return { state, events, correct: false, resting: true };
  const correct = ANSWER_CHECKS[objective.type](objective, answer, data);
  let s = state;
  if (!correct && !(s.stoichSolved ?? []).includes(objectiveId)) s = recordWrong(s, objective);
  if (correct && !(s.stoichSolved ?? []).includes(objectiveId)) {
    s = { ...s, stoichSolved: [...(s.stoichSolved ?? []), objectiveId] };
    s = advance(s, data, events);
  }
  return { state: s, events, correct };
}

// ---------------- Missões (Fase 3F) ----------------

/** Começa (ou recomeça do zero) uma missão liberada. */
export function startMission(state, missionId, data) {
  const m = data.missionsById.get(missionId);
  if (!m || !isMissionAvailable(m, state, data)) return state;
  return { ...state, missionRun: newRun(m) };
}

/** Sai da missão em andamento (o progresso dela se perde; o que foi descoberto fica). */
export const abandonMission = (state) => ({ ...state, missionRun: null });

function finishRun(s, mission, finished, events, data, wasFailed) {
  if (s.missionRun.failed && !wasFailed) events.push({ type: 'mission-failed', mission });
  if (!finished) return s;
  events.push({ type: 'mission-complete', mission });
  const done = s.missionsDone.includes(mission.id) ? s.missionsDone : [...s.missionsDone, mission.id];
  return advance({ ...s, missionsDone: done, missionRun: null }, data, events);
}

/**
 * Combinação feita na bancada durante uma missão: aplica o resultado ao jogo (descobertas,
 * objetivos) e à missão (etapas, tentativas).
 * @returns {{ state, events }}
 */
export function missionCombine(state, selection, result, gameData) {
  const base = applyResult(state, result, gameData);
  const run = base.state.missionRun;
  if (!run) return base;
  const mission = gameData.missionsById.get(run.id);
  const res = runCombine(run, mission, selection, result);
  const events = [...base.events, ...res.completed.map((step) => ({ type: 'mission-step', mission, step }))];
  const s = finishRun({ ...base.state, missionRun: res.run }, mission, res.finished, events, gameData, run.failed);
  return { state: s, events };
}

/**
 * Ação de laboratório na missão em andamento (separar uma mistura, teste de chama).
 * @returns {{ state, events, outcome }}
 */
export function missionLab(state, action, gameData) {
  const run = state.missionRun;
  if (!run) return { state, events: [], outcome: null };
  const mission = gameData.missionsById.get(run.id);
  const res = runLab(run, mission, action, gameData);
  const events = res.completed.map((step) => ({ type: 'mission-step', mission, step }));
  const s = finishRun({ ...state, missionRun: res.run }, mission, res.finished, events, gameData, run.failed);
  return { state: s, events, outcome: res.outcome };
}

/**
 * Resposta a uma pergunta da missão em andamento.
 * @returns {{ state, events, correct, why? }}
 */
export function answerMission(state, stepId, answer, gameData) {
  const run = state.missionRun;
  if (!run) return { state, events: [], correct: false };
  const mission = gameData.missionsById.get(run.id);
  const res = runAnswer(run, mission, stepId, answer, gameData);
  const events = res.correct ? [{ type: 'mission-step', mission, step: mission.steps.find((x) => x.id === stepId) }] : [];
  const s = finishRun({ ...state, missionRun: res.run }, mission, res.finished, events, gameData, run.failed);
  return { state: s, events, correct: res.correct, why: res.why };
}

/** Em qual nível cada elemento/substância/ferramenta é desbloqueado (para dicas na UI). */
export function unlockLevelMap(data) {
  const map = new Map();
  data.progression.levels.forEach((lvl, i) => {
    const u = lvl.unlocks ?? {};
    for (const k of ['elements', 'substances', 'items']) (u[k] ?? []).forEach((id) => map.set(`${k}:${id}`, i));
  });
  return map;
}

/** Valida/migra um estado salvo; devolve null se inválido. */
export function restoreState(saved, data) {
  if (!saved || ![1, 2, STATE_VERSION].includes(saved.version)) return null;
  if (typeof saved.levelIndex !== 'number' || saved.levelIndex < 0) return null;
  const known = (arr, has) => (Array.isArray(arr) ? arr.filter(has) : []);
  const history = {
    produced: known(saved.produced, (id) => data.substancesById.has(id)),
    reactionsDone: known(saved.reactionsDone, (id) => !!lookupReaction(data, id)),
    nonReactionsSeen: known(saved.nonReactionsSeen, () => true),
    completedObjectives: known(saved.completedObjectives, () => true),
    stoichSolved: known(saved.stoichSolved, () => true),
    missionsDone: known(saved.missionsDone, (id) => data.missionsById.has(id)),
    missionRun: saved.missionRun && data.missionsById.has(saved.missionRun.id) ? saved.missionRun : null,
    reviews: sanitizeReviews(saved.reviews, data),
    reviewHits: Number.isInteger(saved.reviewHits) && saved.reviewHits >= 0 ? saved.reviewHits : 0,
    attempts: sanitizeAttempts(saved.attempts),
  };
  if (saved.version === STATE_VERSION) {
    if (saved.levelIndex >= data.progression.levels.length) return null;
    const restored = { ...initialState(data), ...saved, ...history };
    // Quem terminou antes de existirem níveis novos (ex.: a Fase 2) continua de onde parou.
    if (restored.finished && restored.levelIndex < data.progression.levels.length - 1) {
      return advance({ ...restored, finished: false }, data, []);
    }
    return restored;
  }
  // Saves antigos: as perguntas dos níveis novos (posteriores à versão do save) contam como
  // respondidas, para o jogador continuar de onde parou.
  const added = data.progression.levels.filter((l) => (l.since ?? 1) > saved.version).flatMap((l) => l.objectives);
  history.stoichSolved = [...new Set([...history.stoichSolved, ...added.filter((o) => ANSWER_CHECKS[o.type]).map((o) => o.id)])];
  return replayHistory(history, data);
}

/**
 * Reconstrói o estado a partir do histórico (o que o jogador já fez), recomeçando do nível 1:
 * os níveis cujos objetivos o histórico já cumpre são concluídos de novo, com seus desbloqueios,
 * e o jogador para no primeiro nível com objetivo pendente.
 */
function replayHistory(history, data) {
  const start = { ...initialState(data), ...history, completedObjectives: [] };
  return applyResult(start, { kind: 'invalid' }, data).state;
}
