// Fase 4D: os laboratórios e a calculadora não entregam a resposta pronta das perguntas do nível.
// Quando o que o jogador montou no laboratório é exatamente uma pergunta pendente do nível atual,
// a interface mostra o caminho da conta e esconde só o número final. Fora disso, tudo aparece
// (o laboratório continua sendo para explorar). Puro, sem DOM.

import { lookupReaction } from './engine.js';

/** A mesma reação (curada ou gerada pelas regras): mesmos reagentes e produtos. */
const reactionKey = (r) => r && `${r.reactants.map((e) => e.id).sort().join('+')}>${r.products.map((e) => e.id).sort().join('+')}`;

const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.005 * Math.max(Math.abs(b), 1e-12);

/** Perguntas do nível atual ainda não respondidas. */
function pending(state, data) {
  if (state.finished) return [];
  const level = data.progression.levels[state.levelIndex];
  const solved = new Set(state.stoichSolved ?? []);
  return (level?.objectives ?? []).filter((o) => !solved.has(o.id) && !(state.completedObjectives ?? []).includes(o.id));
}

/** Quantidade dada numa pergunta de estequiometria, no formato da calculadora. */
function sameGiven(objGiven, calcGiven) {
  const keys = Object.keys(objGiven);
  if (keys.length !== Object.keys(calcGiven).length) return false;
  return keys.every((id) => {
    const a = objGiven[id];
    const b = calcGiven[id];
    if (!b) return false;
    if (typeof a === 'number') return close(b.g, a);
    if (a.mol != null) return close(b.mol, a.mol);
    if (a.L != null) return close(b.L, a.L);
    if (a.mL != null) return close(b.mL, a.mL) && close(b.M, a.M);
    return false;
  });
}

/**
 * Pergunta pendente que o laboratório responderia agora, ou null.
 *   kind 'halfLife' { kinetics, T, A0 } · 'plus10' { kinetics, T } (efeito de +10 °C)
 *   'pH' { species, c } · 'bufferPH' { species, cAcid, cBase } · 'solubility' { salt, common }
 *   'shift' { gas } → lista das perguntas de Le Chatelier pendentes desse gás
 *   'stoich' { reaction (objeto), given, actual? } → a pergunta (o campo `ask` diz o que esconder)
 */
export function pendingQuestion(state, data, kind, p) {
  const list = pending(state, data);
  const find = (fn) => list.find(fn) ?? null;
  switch (kind) {
    case 'halfLife':
      return find((o) => o.type === 'kinetics' && o.ask === 'halfLife' && o.kinetics === p.kinetics && Math.abs(o.T - p.T) < 0.5 && (o.A0 == null || close(p.A0, o.A0) || data.kinetics.byId.get(o.kinetics)?.order === 1));
    case 'plus10':
      return find((o) => o.type === 'kinetics' && o.ask === 'ratio' && o.kinetics === p.kinetics && Math.abs(o.T - p.T) < 0.5 && Math.abs(o.T2 - o.T - 10) < 0.5);
    case 'pH':
      return find((o) => o.type === 'equilibrium' && o.ask === 'pH' && o.species === p.species && close(p.c, o.c));
    case 'bufferPH':
      return find((o) => o.type === 'equilibrium' && o.ask === 'bufferPH' && o.species === p.species && close(p.cAcid, o.cAcid) && close(p.cBase, o.cBase));
    case 'solubility':
      return find((o) => o.type === 'equilibrium' && o.ask === 'solubility' && o.salt === p.salt && (o.common ? close(p.common, o.common.c) : !(p.common > 0)));
    case 'shift':
      return list.filter((o) => o.type === 'equilibrium' && o.ask === 'shift' && o.gas === p.gas);
    case 'stoich':
      return find((o) => o.type === 'stoich' && reactionKey(lookupReaction(data, o.reaction)) === reactionKey(p.reaction) && sameGiven(o.given, p.given) && (o.ask !== 'yield' || close(p.actual?.g, o.actual.g)));
    default:
      return null;
  }
}

// ---------------- Tentativas nas perguntas dos níveis ----------------

/**
 * Tentativas por pergunta: nas de escolha, menos que o número de alternativas (não dá para
 * testar todas); nas de conta, 3. Esgotadas, a pergunta descansa até o jogador avançar em
 * outra coisa (outro objetivo ou uma revisão certa) — a explicação do erro fica à vista.
 */
export function maxAttempts(o) {
  const n = o.type === 'state' ? 3 : o.choices?.length ?? (o.type === 'stoich' && o.ask === 'limiting' ? Object.keys(o.given).length : 0);
  return n ? Math.max(1, Math.floor(n / 2)) : 3;
}

/** Medida de "avanço" que libera uma pergunta em descanso. */
export const progressMark = (state) => (state.completedObjectives?.length ?? 0) + (state.reviewHits ?? 0);

/**
 * A pergunta está em descanso? Nunca trava o jogo: se não houver mais nada a fazer no nível
 * (todas as pendentes em descanso e nenhum objetivo de bancada), ela libera.
 */
export function isResting(o, state, data, canDoElse = true) {
  const lock = state.attempts?.[o.id];
  if (!lock || lock.restAt == null || lock.restAt !== progressMark(state)) return false;
  return canDoElse;
}

/** Registra uma resposta errada; devolve o novo registro { wrong, restAt? }. */
export function recordWrong(state, o) {
  const prev = state.attempts?.[o.id];
  const fresh = !prev || (prev.restAt != null && prev.restAt !== progressMark(state));
  const wrong = (fresh ? 0 : prev.wrong) + 1;
  const entry = wrong >= maxAttempts(o) ? { wrong, restAt: progressMark(state) } : { wrong };
  return { ...state, attempts: { ...(state.attempts ?? {}), [o.id]: entry } };
}

/** Tentativas que ainda restam nesta rodada. */
export function attemptsLeft(o, state) {
  const prev = state.attempts?.[o.id];
  if (!prev || (prev.restAt != null && prev.restAt !== progressMark(state))) return maxAttempts(o);
  return Math.max(0, maxAttempts(o) - prev.wrong);
}

/** Limpa registros inválidos de um save. */
export function sanitizeAttempts(attempts) {
  if (!attempts || typeof attempts !== 'object') return {};
  return Object.fromEntries(Object.entries(attempts).filter(([, e]) => e && Number.isInteger(e.wrong) && e.wrong > 0 && (e.restAt == null || Number.isFinite(e.restAt))));
}
