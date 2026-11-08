// Fase 4D: tentativas nas perguntas dos níveis e laboratórios que não entregam a resposta pronta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { createEngine } from '../src/core/engine.js';
import { initialState, answerObjective, questionResting, restoreState, answerReview } from '../src/core/progression.js';
import { pendingQuestion, maxAttempts, attemptsLeft } from '../src/core/guard.js';
import { fundamentalsAnswer } from '../src/core/fundamentals.js';

const data = loadData();
const engine = createEngine(data);
const levels = data.progression.levels;
const idx = (id) => levels.findIndex((l) => l.id === id);
const O = (id) => levels.flatMap((l) => l.objectives).find((o) => o.id === id);
const at = (id, extra = {}) => ({ ...initialState(data), levelIndex: idx(id), ...extra });

test('laboratório de velocidade: só esconde a pergunta pendente do nível', () => {
  const s = at('n13');
  assert.equal(pendingQuestion(s, data, 'halfLife', { kinetics: 'n2o5', T: 338, A0: 0.01 })?.id, 'n13-meia-vida', '1ª ordem: qualquer [A]₀');
  assert.equal(pendingQuestion(s, data, 'halfLife', { kinetics: 'n2o5', T: 318, A0: 0.01 }), null, 'outra temperatura: mostra');
  assert.equal(pendingQuestion(s, data, 'plus10', { kinetics: 'n2o5', T: 298 })?.id, 'n13-temperatura');
  assert.equal(pendingQuestion(s, data, 'halfLife', { kinetics: 'hi', T: 700, A0: 0.1 })?.id, 'n13-segunda-ordem');
  assert.equal(pendingQuestion(s, data, 'halfLife', { kinetics: 'hi', T: 700, A0: 0.2 }), null, '2ª ordem: depende de [A]₀');
  // Respondida, ou fora do nível: o laboratório mostra tudo.
  assert.equal(pendingQuestion({ ...s, stoichSolved: ['n13-meia-vida'] }, data, 'halfLife', { kinetics: 'n2o5', T: 338, A0: 0.01 }), null);
  assert.equal(pendingQuestion(at('n14'), data, 'halfLife', { kinetics: 'n2o5', T: 338, A0: 0.01 }), null);
  assert.equal(pendingQuestion({ ...s, finished: true }, data, 'plus10', { kinetics: 'n2o5', T: 298 }), null);
});

test('laboratório de equilíbrio: pH, tampão, Kps e Le Chatelier', () => {
  const s = at('n14');
  assert.equal(pendingQuestion(s, data, 'pH', { species: 'HCl', c: 0.01 })?.id, 'n14-acido-forte');
  assert.equal(pendingQuestion(s, data, 'pH', { species: 'HCl', c: 0.02 }), null);
  assert.equal(pendingQuestion(s, data, 'pH', { species: 'CH3COOH', c: 0.08 })?.id, 'n14-acido-fraco');
  assert.equal(pendingQuestion(s, data, 'bufferPH', { species: 'CH3COOH', cAcid: 0.08, cBase: 0.04 })?.id, 'n14-tampao');
  assert.equal(pendingQuestion(s, data, 'solubility', { salt: 'AgCl', common: 0 })?.id, 'n14-kps');
  assert.equal(pendingQuestion(s, data, 'solubility', { salt: 'AgCl', common: 0.1 }), null, 'com íon comum é outra conta');
  assert.deepEqual(pendingQuestion(s, data, 'shift', { gas: 'nh3' }).map((o) => o.stress).sort(), ['compress', 'heat']);
  assert.deepEqual(pendingQuestion({ ...s, stoichSolved: ['n14-pressao'] }, data, 'shift', { gas: 'nh3' }).map((o) => o.stress), ['heat']);
});

test('calculadora de estequiometria: reconhece a pergunta, mesmo pela reação curada equivalente', () => {
  const r = (sel) => engine.combine(sel).reaction;
  assert.equal(pendingQuestion(at('n10'), data, 'stoich', { reaction: r(['CH4', 'O2', 'faisca']), given: { CH4: { g: 16 } } })?.ask, 'CO2');
  assert.equal(pendingQuestion(at('n10'), data, 'stoich', { reaction: r(['CH4', 'O2', 'faisca']), given: { CH4: { g: 20 } } }), null);
  assert.equal(pendingQuestion(at('n10'), data, 'stoich', { reaction: r(['H2', 'O2', 'faisca']), given: { H2: { g: 4 }, O2: { g: 16 } } })?.ask, 'limiting');
  // n12-etanol cita a reação gerada pelas regras; a bancada dá a curada — é a mesma reação.
  assert.equal(pendingQuestion(at('n12'), data, 'stoich', { reaction: r(['C2H5OH', 'O2', 'faisca']), given: { C2H5OH: { g: 23 } } })?.ask, 'heat');
  assert.equal(pendingQuestion(at('n11'), data, 'stoich', { reaction: r(['HCl', 'NaOH']), given: { HCl: { mL: 50, M: 0.1 } } })?.ask, 'NaCl');
  assert.equal(pendingQuestion(at('n11'), data, 'stoich', { reaction: r(['C3H8', 'O2', 'faisca']), given: { C3H8: { mol: 1 } } })?.ask, 'CO2');
  const caco3 = r(['CaCO3', 'calor']);
  assert.equal(pendingQuestion(at('n11'), data, 'stoich', { reaction: caco3, given: { CaCO3: { g: 42.73 } }, actual: { id: 'CO2', g: 17.5 } })?.ask, 'yield');
  assert.equal(pendingQuestion(at('n11'), data, 'stoich', { reaction: caco3, given: { CaCO3: { g: 42.73 } }, actual: null }), null);
});

test('tentativas: menos que as alternativas nas perguntas de escolha; 3 nas de conta', () => {
  assert.equal(maxAttempts(O('f1-ar')), 1, '3 alternativas');
  assert.equal(maxAttempts(O('f1-gelo')), 1, '2 alternativas');
  assert.equal(maxAttempts(O('f4-br')), 1, 'sólido/líquido/gasoso');
  assert.equal(maxAttempts(O('n10-limite')), 1, 'limitante entre 2 reagentes');
  assert.equal(maxAttempts(O('f2-na-n')), 3);
  assert.equal(maxAttempts(O('n10-co2')), 3);
  for (const o of levels.flatMap((l) => l.objectives).filter((x) => x.choices)) assert.ok(maxAttempts(o) < o.choices.length, `${o.id}: dá para testar todas`);
});

test('tentativas esgotadas: a pergunta descansa até o jogador avançar em outra coisa', () => {
  let s = initialState(data); // f1: só perguntas de escolha
  s = answerObjective(s, 'f1-ar', 'pura', data).state;
  assert.equal(attemptsLeft(O('f1-ar'), s), 0);
  assert.ok(questionResting(O('f1-ar'), s, data));
  // Em descanso, nem a resposta certa conta (não dá para chutar todas em sequência).
  const r = answerObjective(s, 'f1-ar', 'homogenea', data);
  assert.equal(r.resting, true);
  assert.equal(r.correct, false);
  assert.ok(!r.state.stoichSolved.includes('f1-ar'));
  // Concluir outro objetivo libera, com as tentativas renovadas.
  s = answerObjective(s, 'f1-oleo', 'heterogenea', data).state;
  assert.ok(!questionResting(O('f1-ar'), s, data));
  assert.equal(attemptsLeft(O('f1-ar'), s), 1);
  assert.equal(answerObjective(s, 'f1-ar', 'homogenea', data).correct, true);
});

test('o jogo nunca trava: se todas as pendentes descansam e não há mais nada, elas liberam', () => {
  let s = initialState(data);
  for (const o of levels[0].objectives) s = answerObjective(s, o.id, o.choices.find((c) => c.value !== o.answer).value, data).state;
  for (const o of levels[0].objectives) assert.ok(!questionResting(o, s, data), o.id);
  // Com o nível respondido, chega-se ao próximo normalmente.
  for (const o of levels[0].objectives) s = answerObjective(s, o.id, fundamentalsAnswer(o, data), data).state;
  assert.equal(levels[s.levelIndex].id, 'f2');
});

test('uma revisão certa também conta como avanço', () => {
  let s = { ...initialState(data), levelIndex: idx('f2'), stoichSolved: ['f1-ar'], completedObjectives: levels[0].objectives.map((o) => o.id) };
  s = answerObjective(s, 'f2-massa', 'meio', data).state;
  assert.ok(questionResting(O('f2-massa'), s, data));
  s = answerReview(s, 'f1-ar', 'homogenea', data).state;
  assert.ok(!questionResting(O('f2-massa'), s, data));
});

test('o save guarda as tentativas e descarta lixo', () => {
  const s = answerObjective(initialState(data), 'f1-ar', 'pura', data).state;
  const restored = restoreState(JSON.parse(JSON.stringify({ ...s, attempts: { ...s.attempts, x: { wrong: 'a' } } })), data);
  assert.deepEqual(restored.attempts, s.attempts);
  assert.ok(questionResting(O('f1-ar'), restored, data));
});
