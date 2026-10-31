// Progressão pedagógica: níveis, desbloqueios e objetivos. Funções puras sobre um estado
// serializável (vai para o localStorage como JSON), para facilitar testes e evolução.
//
// Extensão: novos tipos de objetivo entram em OBJECTIVE_CHECKS (ex.: Fase 2 — "produza 10 g de
// NaCl" com estequiometria; Fase 3 — missões com várias etapas).

import { lookupReaction } from './engine.js';
import { stoichiometry, percentYield } from './stoichiometry.js';
import { reactionThermo, heatFor } from './thermo.js';

export const STATE_VERSION = 2;
// v1 → v2: um nível novo (metais alcalino-terrosos) entrou no meio da Fase 1, então o
// levelIndex salvo deixou de valer. A migração refaz o caminho a partir do histórico.

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
    stoichSolved: [], // objetivos de estequiometria respondidos corretamente
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

/** O jogador respondeu a um objetivo de estequiometria. */
export function answerObjective(state, objectiveId, answer, data) {
  const events = [];
  const objective = data.progression.levels.flatMap((l) => l.objectives).find((o) => o.id === objectiveId);
  if (!objective || objective.type !== 'stoich') return { state, events, correct: false };
  const correct = isStoichAnswerRight(objective, answer, data);
  let s = state;
  if (correct && !(s.stoichSolved ?? []).includes(objectiveId)) {
    s = { ...s, stoichSolved: [...(s.stoichSolved ?? []), objectiveId] };
    s = advance(s, data, events);
  }
  return { state: s, events, correct };
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
  if (!saved || ![1, STATE_VERSION].includes(saved.version)) return null;
  if (typeof saved.levelIndex !== 'number' || saved.levelIndex < 0) return null;
  const known = (arr, has) => (Array.isArray(arr) ? arr.filter(has) : []);
  const history = {
    produced: known(saved.produced, (id) => data.substancesById.has(id)),
    reactionsDone: known(saved.reactionsDone, (id) => !!lookupReaction(data, id)),
    nonReactionsSeen: known(saved.nonReactionsSeen, () => true),
    completedObjectives: known(saved.completedObjectives, () => true),
    stoichSolved: known(saved.stoichSolved, () => true),
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
