// Fase 4C: revisões espaçadas — perguntas que voltam, misturando assuntos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { initialState, answerObjective, answerReview, reviewsDue, restoreState, isAnswerObjective } from '../src/core/progression.js';
import { REVIEW_INTERVALS, REVIEW_BOXES, reviewsMastered } from '../src/core/review.js';
import { fundamentalsAnswer, FUNDAMENTAL_TYPES } from '../src/core/fundamentals.js';

const data = loadData();
const levels = data.progression.levels;
const idx = (id) => levels.findIndex((l) => l.id === id);
const all = levels.flatMap((l) => l.objectives);
const O = (id) => all.find((o) => o.id === id);

/** Responde certo a todas as perguntas de um nível de fundamentos. */
function finishLevel(state) {
  let s = state;
  for (const o of levels[s.levelIndex].objectives) s = answerObjective(s, o.id, fundamentalsAnswer(o, data), data).state;
  return s;
}

test('nada para revisar no começo; o nível respondido volta no seguinte', () => {
  const s0 = initialState(data);
  assert.deepEqual(reviewsDue(s0, data), []);
  const s1 = finishLevel(s0);
  assert.equal(levels[s1.levelIndex].id, 'f2');
  const due = reviewsDue(s1, data);
  assert.equal(due.length, 3, 'no máximo 3 por vez');
  assert.ok(due.every((d) => d.level.id === 'f1'));
});

test('as revisões misturam níveis diferentes', () => {
  let s = initialState(data);
  for (let i = 0; i < 4; i++) s = finishLevel(s); // f1–f4 respondidos; agora no f5
  assert.equal(levels[s.levelIndex].id, 'f5');
  const due = reviewsDue(s, data);
  assert.equal(due.length, 3);
  assert.equal(new Set(due.map((d) => d.level.id)).size, 3, 'três assuntos diferentes');
  assert.ok(due.every((d) => isAnswerObjective(d.objective)));
});

test('acerto espaça, erro traz de volta, e depois de todas as caixas a pergunta sai', () => {
  let s = finishLevel(initialState(data)); // no f2
  const id = 'f1-ar';
  // Erro: continua na caixa 0 e volta no próximo nível (não some, não muda os objetivos).
  let r = answerReview(s, id, 'pura', data);
  assert.equal(r.correct, false);
  assert.deepEqual(r.entry, { box: 0, due: s.levelIndex + REVIEW_INTERVALS[0] });
  assert.deepEqual(r.state.completedObjectives, s.completedObjectives);
  assert.ok(!reviewsDue(r.state, data, 99).some((d) => d.objective.id === id), 'não repete no mesmo nível');
  // Acertos sucessivos: o intervalo cresce até a pergunta sair da revisão.
  s = r.state;
  for (let box = 1; box <= REVIEW_BOXES; box++) {
    s = { ...s, levelIndex: s.reviews[id].due };
    assert.ok(reviewsDue(s, data, 99).some((d) => d.objective.id === id), `caixa ${box - 1}: vence`);
    r = answerReview(s, id, 'homogenea', data);
    assert.equal(r.correct, true);
    s = r.state;
    if (box < REVIEW_BOXES) assert.equal(r.entry.due - s.levelIndex, REVIEW_INTERVALS[box]);
  }
  assert.equal(s.reviews[id].done, true);
  assert.equal(reviewsMastered(s), 1);
  assert.ok(!reviewsDue({ ...s, levelIndex: levels.length - 1 }, data, 99).some((d) => d.objective.id === id));
});

test('só revisa o que já foi respondido', () => {
  const s0 = initialState(data);
  const r = answerReview(s0, 'f1-ar', 'homogenea', data);
  assert.equal(r.entry, null);
  assert.deepEqual(r.state, s0);
});

test('revisões de todo tipo de pergunta, inclusive contas antigas (saves da v2)', () => {
  // Um save que já tinha resolvido estequiometria: as contas também voltam para revisão.
  const s = { ...initialState(data), levelIndex: idx('n13'), stoichSolved: ['n10-co2', 'n10-limite', 'n12-metano'] };
  const due = reviewsDue(s, data, 99);
  assert.deepEqual(due.map((d) => d.objective.id).sort(), ['n10-co2', 'n10-limite', 'n12-metano']);
  assert.equal(answerReview(s, 'n10-co2', '43,9', data).correct, true);
  assert.equal(answerReview(s, 'n10-limite', 'H2', data).correct, false);
});

test('o save guarda as revisões e descarta lixo', () => {
  let s = finishLevel(initialState(data));
  s = answerReview(s, 'f1-ar', 'homogenea', data).state;
  const saved = JSON.parse(JSON.stringify({ ...s, reviews: { ...s.reviews, inexistente: { box: 1, due: 3 }, 'f1-oleo': { box: 'x' } } }));
  const restored = restoreState(saved, data);
  assert.deepEqual(restored.reviews, s.reviews);
  // Save sem o campo (v3 antigo): começa vazio.
  const { reviews, ...old } = s;
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(old)), data).reviews, {});
});

test('toda pergunta pode voltar numa revisão', () => {
  for (const o of all.filter((x) => FUNDAMENTAL_TYPES.includes(x.type))) assert.ok(isAnswerObjective(o), o.id);
  assert.ok(isAnswerObjective(O('n10-co2')));
  assert.ok(!isAnswerObjective(O('n1-agua')), 'produzir algo não é pergunta');
});
