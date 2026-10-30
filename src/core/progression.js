// Progressão pedagógica: níveis, desbloqueios e objetivos. Funções puras sobre um estado
// serializável (vai para o localStorage como JSON), para facilitar testes e evolução.
//
// Extensão: novos tipos de objetivo entram em OBJECTIVE_CHECKS (ex.: Fase 2 — "produza 10 g de
// NaCl" com estequiometria; Fase 3 — missões com várias etapas).

export const STATE_VERSION = 1;

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
      const r = data.reactionsById.get(rid);
      return r.types.includes(o.reactionType) && (!o.withReactant || r.reactants.some((e) => e.id === o.withReactant));
    }),
  nonReaction: (o, h) => h.nonReactionsSeen.has(o.reasonId),
};

export function isObjectiveDone(objective, state, data) {
  const check = OBJECTIVE_CHECKS[objective.type];
  if (!check) throw new Error(`Tipo de objetivo desconhecido: ${objective.type}`);
  const history = {
    produced: new Set(state.produced),
    reactionsDone: new Set(state.reactionsDone),
    nonReactionsSeen: new Set(state.nonReactionsSeen),
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

  // Confere objetivos; ao completar um nível, desbloqueia o próximo (e reconfere, pois o
  // histórico pode já cumprir objetivos do nível novo).
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
  return { state: s, events };
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
  if (!saved || saved.version !== STATE_VERSION) return null;
  if (typeof saved.levelIndex !== 'number' || saved.levelIndex >= data.progression.levels.length) return null;
  const known = (arr, has) => (Array.isArray(arr) ? arr.filter(has) : []);
  return {
    ...initialState(data),
    ...saved,
    produced: known(saved.produced, (id) => data.substancesById.has(id)),
    reactionsDone: known(saved.reactionsDone, (id) => data.reactionsById.has(id)),
    nonReactionsSeen: known(saved.nonReactionsSeen, () => true),
    completedObjectives: known(saved.completedObjectives, () => true),
  };
}
