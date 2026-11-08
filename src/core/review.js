// Fase 4C: revisões espaçadas. Perguntas já respondidas (fundamentos, contas, moléculas…)
// voltam alguns níveis depois, misturando assuntos; a cada acerto o intervalo dobra, e um erro
// faz a pergunta voltar logo. Puro, sem DOM.
//
// O "relógio" é o nível em que o jogador está (não o tempo real): assim a revisão acompanha o
// jogo e é determinística (testável). Cada pergunta tem uma caixa (Leitner): 0, 1, 2, 3 e então
// sai da revisão. Uma pergunta respondida sem registro de revisão está na caixa 0 e vence no
// nível seguinte ao seu — por isso saves antigos não precisam de migração.

export const REVIEW_INTERVALS = [1, 2, 4, 8]; // níveis até a próxima vez, por caixa
export const REVIEW_BOXES = REVIEW_INTERVALS.length; // acertos para sair da revisão
export const MAX_DUE = 3;

/** O relógio da revisão: o índice do nível atual (o total de níveis, se o jogo acabou). */
export const reviewClock = (state, data) => (state.finished ? data.progression.levels.length : state.levelIndex);

function objectiveIndex(data) {
  const map = new Map();
  data.progression.levels.forEach((l, i) => l.objectives.forEach((o) => map.set(o.id, { o, level: i })));
  return map;
}

/** Registro de revisão de uma pergunta respondida (o padrão, se ainda não houver). */
export function reviewEntry(state, id, data, index = objectiveIndex(data)) {
  const saved = state.reviews?.[id];
  if (saved) return saved;
  const at = index.get(id);
  return at ? { box: 0, due: at.level + REVIEW_INTERVALS[0] } : null;
}

/**
 * Perguntas que vencem agora, no máximo `max`, de níveis diferentes sempre que possível
 * (para misturar assuntos), as mais atrasadas primeiro.
 * @param {(o) => boolean} isAnswerType quais objetivos são perguntas (as que dá para refazer)
 */
export function dueReviews(state, data, isAnswerType, max = MAX_DUE) {
  const index = objectiveIndex(data);
  const clock = reviewClock(state, data);
  const due = (state.stoichSolved ?? [])
    .map((id) => ({ id, at: index.get(id), entry: reviewEntry(state, id, data, index) }))
    .filter((x) => x.at && x.entry && !x.entry.done && isAnswerType(x.at.o) && x.entry.due <= clock)
    .sort((a, b) => a.entry.due - b.entry.due || a.at.level - b.at.level);
  const picked = [];
  const levelsUsed = new Set();
  for (const x of due) {
    if (picked.length >= max) break;
    if (!levelsUsed.has(x.at.level)) {
      picked.push(x);
      levelsUsed.add(x.at.level);
    }
  }
  for (const x of due) {
    if (picked.length >= max) break;
    if (!picked.includes(x)) picked.push(x);
  }
  return picked.map((x) => ({ objective: x.at.o, level: data.progression.levels[x.at.level], entry: x.entry }));
}

/**
 * Resultado de uma resposta de revisão: acerto sobe uma caixa (ou sai da revisão), erro volta
 * para a caixa 0 e a pergunta reaparece no próximo nível. Não mexe nos objetivos dos níveis.
 * @returns {{ state, entry }}
 */
export function scheduleReview(state, id, correct, data) {
  const clock = reviewClock(state, data);
  const prev = reviewEntry(state, id, data) ?? { box: 0, due: clock };
  let entry;
  if (!correct) entry = { box: 0, due: clock + REVIEW_INTERVALS[0] };
  else if (prev.box + 1 >= REVIEW_BOXES) entry = { box: REVIEW_BOXES, due: clock, done: true };
  else entry = { box: prev.box + 1, due: clock + REVIEW_INTERVALS[prev.box + 1] };
  return { state: { ...state, reviews: { ...(state.reviews ?? {}), [id]: entry } }, entry };
}

/** Quantas perguntas já saíram da revisão (respondidas certo nas caixas todas). */
export const reviewsMastered = (state) => Object.values(state.reviews ?? {}).filter((e) => e.done).length;

/** Limpa registros inválidos de um save. */
export function sanitizeReviews(reviews, data) {
  if (!reviews || typeof reviews !== 'object') return {};
  const index = objectiveIndex(data);
  const ok = (e) => e && Number.isInteger(e.box) && e.box >= 0 && e.box <= REVIEW_BOXES && Number.isFinite(e.due);
  return Object.fromEntries(Object.entries(reviews).filter(([id, e]) => index.has(id) && ok(e)));
}
