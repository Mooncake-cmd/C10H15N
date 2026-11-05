// Fase 3F: missões. Dados coerentes, toda missão concluível com o kit e dentro das tentativas,
// regras de tentativa/falha, contas e as afirmações químicas dos textos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData, playMission } from './helpers.js';
import { createEngine, lookupReaction } from '../src/core/engine.js';
import { initialState, startMission, missionCombine, answerMission, abandonMission, isObjectiveDone } from '../src/core/progression.js';
import { currentSteps, isAction, missionAnswer, calcAnswer, calcWorked, titration, isMissionAvailable, ACTION_KINDS, QUESTION_KINDS } from '../src/core/missions.js';
import { solutionPH } from '../src/core/equilibrium.js';
import { molarMass } from '../src/core/formula.js';

const data = loadData();
const engine = createEngine(data);
const finished = { ...initialState(data), finished: true, levelIndex: data.progression.levels.length - 1 };
const M = (id) => data.missionsById.get(id);

test('missões: dados coerentes', () => {
  const ids = new Set();
  const stepIds = new Set();
  const levelIds = data.progression.levels.map((l) => l.id);
  assert.ok(data.missions.length >= 6);
  for (const m of data.missions) {
    assert.ok(!ids.has(m.id), `missão duplicada ${m.id}`);
    ids.add(m.id);
    assert.ok(m.icon && m.title && m.story && m.conclusion, m.id);
    assert.ok(['historia', 'laboratorio', 'ambiental'].includes(m.format), `${m.id}: formato`);
    assert.ok(levelIds.includes(m.after), `${m.id}: nível ${m.after}`);
    assert.ok(m.kit.substances.every((id) => data.substancesById.has(id)), `${m.id}: kit`);
    assert.ok((m.kit.items ?? []).every((id) => data.itemsById.has(id)), `${m.id}: ferramentas`);
    assert.ok(['seguro', 'cuidado', 'perigo'].includes(m.safety.level) && m.safety.why && m.safety.home, `${m.id}: segurança`);
    assert.ok(m.sources.length > 0, `${m.id}: fontes`);
    for (const src of m.sources) {
      assert.ok(data.sources[src.ref], `${m.id}: fonte ${src.ref}`);
      assert.ok(!data.complementarySources.includes(src.ref), `${m.id}: fonte de divulgação não vale`);
      assert.ok(src.topic && src.pages, `${m.id}: tópico e página`);
    }
    const actions = m.steps.filter(isAction).length;
    assert.ok(m.maxAttempts >= actions + 2, `${m.id}: precisa de folga de pelo menos 2 tentativas`);
    for (const s of m.steps) {
      assert.ok(!stepIds.has(s.id), `etapa duplicada ${s.id}`);
      stepIds.add(s.id);
      assert.ok([...ACTION_KINDS, ...QUESTION_KINDS].includes(s.kind), `${s.id}: tipo ${s.kind}`);
      assert.ok(s.text, s.id);
      if (s.kind === 'reaction') assert.ok(lookupReaction(data, s.reaction), `${s.id}: reação`);
      if (s.kind === 'produce') assert.ok(data.substancesById.has(s.substance), `${s.id}: substância`);
      if (s.kind === 'observe') assert.equal(engine.combine(s.selection).kind, s.expect, `${s.id}: observação`);
      if (isAction(s)) assert.ok(s.done, `${s.id}: o que se observa`);
      if (s.kind === 'choice') {
        assert.ok(s.choices.length >= 3, `${s.id}: pelo menos 3 alternativas`);
        assert.equal(s.choices.filter((c) => c.value === s.answer).length, 1, `${s.id}: resposta`);
        assert.ok(s.choices.every((c) => c.label && c.why), `${s.id}: toda alternativa explica o porquê`);
      }
      if (s.kind === 'calc') {
        assert.ok(Number.isFinite(calcAnswer(s, data)) && calcAnswer(s, data) > 0, `${s.id}: conta`);
        assert.ok(s.unitLabel && s.hint, `${s.id}: unidade e dica do caminho`);
        assert.ok(calcWorked(s, data).length >= 2, `${s.id}: caminho da conta`);
      }
    }
    assert.ok(m.steps.some(isAction) && m.steps.some((s) => !isAction(s)), `${m.id}: ações e perguntas`);
  }
});

test('missões: cada uma é concluível com o kit, uma combinação por etapa', async () => {
  for (const m of data.missions) {
    const res = await playMission(finished, m.id, data, engine);
    assert.equal(res.stuck, null, `${m.id}: travou em ${res.stuck}`);
    assert.equal(res.attempts, m.steps.filter(isAction).length, m.id);
    assert.ok(res.state.missionsDone.includes(m.id) && !res.state.missionRun, m.id);
  }
});

test('missões: só começam depois do nível indicado', () => {
  const s0 = initialState(data);
  for (const m of data.missions) {
    assert.equal(isMissionAvailable(m, s0, data), false, m.id);
    assert.equal(startMission(s0, m.id, data).missionRun, null);
  }
  const after = data.progression.levels.findIndex((l) => l.id === 'n7');
  assert.ok(isMissionAvailable(M('m-balao'), { ...s0, levelIndex: after + 1 }, data));
  assert.ok(!isMissionAvailable(M('m-balao'), { ...s0, levelIndex: after }, data));
});

test('missões: tentativas, erros explicados, falha e recomeço', () => {
  let s = startMission(finished, 'm-cobre', data);
  assert.equal(s.missionRun.attempts, 0);
  // Fora de ordem (missão em ordem estrita): CuSO4 + Zn dá cobre, mas a etapa atual é a 1.
  s = missionCombine(s, ['Cu', 'H2SO4'], engine.combine(['Cu', 'H2SO4']), data).state;
  assert.equal(s.missionRun.attempts, 1);
  assert.deepEqual(s.missionRun.done, []);
  // Etapa 1 certa.
  let r = missionCombine(s, ['Cu', 'HNO3'], engine.combine(['Cu', 'HNO3']), data);
  assert.ok(r.events.some((e) => e.type === 'mission-step' && e.step.id === 'm-cobre-nitrato'));
  s = r.state;
  assert.ok(s.missionRun.got.includes('Cu(NO3)2'), 'o produto entra no kit');
  // Pergunta antes da hora não vale.
  assert.equal(answerMission(s, 'm-cobre-massa', 'igual', data).correct, false);
  // Gastar tudo: falha.
  const max = M('m-cobre').maxAttempts;
  for (let i = s.missionRun.attempts; i < max; i++) {
    r = missionCombine(s, ['Zn'], engine.combine(['Zn']), data);
    s = r.state;
  }
  assert.equal(s.missionRun.failed, true);
  assert.ok(r.events.some((e) => e.type === 'mission-failed'));
  // Recomeçar zera.
  s = startMission(s, 'm-cobre', data);
  assert.deepEqual(s.missionRun, { id: 'm-cobre', done: [], got: [], attempts: 0, failed: false });
  assert.equal(abandonMission(s).missionRun, null);
});

test('missões: resposta errada gasta tentativa e mostra o porquê; certa é de graça', () => {
  let s = startMission(finished, 'm-agua-oxigenada', data);
  for (const sel of [['H2O2'], ['H2O2', 'catalisador']]) s = missionCombine(s, sel, engine.combine(sel), data).state;
  assert.equal(s.missionRun.done.length, 2);
  const used = s.missionRun.attempts;
  const wrong = answerMission(s, 'm-h2o2-papel', 'equilibrio', data);
  assert.equal(wrong.correct, false);
  assert.match(wrong.why, /ida e a volta/);
  assert.equal(wrong.state.missionRun.attempts, used + 1);
  const right = answerMission(wrong.state, 'm-h2o2-papel', 'caminho', data);
  assert.equal(right.correct, true);
  assert.equal(right.state.missionRun.attempts, used + 1);
});

test('missões: sem ordem estrita, as ações seguidas podem ser feitas em qualquer ordem', () => {
  let s = startMission(finished, 'm-balao', data);
  assert.equal(currentSteps(s.missionRun, M('m-balao')).length, 3);
  s = missionCombine(s, ['CaCO3', 'HCl'], engine.combine(['CaCO3', 'HCl']), data).state;
  assert.deepEqual(s.missionRun.done, ['m-balao-co2']);
});

test('missões: concluir cumpre o objetivo do nível 17', async () => {
  const o = data.progression.levels.find((l) => l.id === 'n17').objectives.find((x) => x.mission === 'm-extintor');
  const res = await playMission(finished, 'm-extintor', data, engine);
  assert.ok(isObjectiveDone(o, res.state, data));
  assert.ok(!isObjectiveDone(o, finished, data));
});

test('missões: contas (titulação e volume de gás) e o caminho mostrado', () => {
  const vin = M('m-vinagre').steps;
  const t = titration(vin.find((s) => s.id === 'm-vinagre-mol').calc, data);
  assert.ok(Math.abs(t.M - 0.835) < 1e-9);
  assert.ok(Math.abs(t.gL - 0.835 * 60.05) < 0.1);
  assert.ok(Math.abs(t.gL / 10 - 5.0) < 0.05, 'a conclusão fala em cerca de 5% (g por 100 mL)');
  const molStep = vin.find((s) => s.id === 'm-vinagre-mol');
  assert.equal(answerMission(startAt(molStep), molStep.id, '0,835', data).correct, true);
  assert.equal(answerMission(startAt(molStep), molStep.id, '0,0835', data).correct, false);
  assert.match(calcWorked(molStep, data).join(' | '), /0,00835 mol/);

  const ext = M('m-extintor').steps.find((s) => s.id === 'm-extintor-litros');
  assert.ok(Math.abs(calcAnswer(ext, data) - (8.4 / 84.007) * 24.47) < 0.01);
  assert.match(calcWorked(ext, data).join(' | '), /24,47 L\/mol/);
});

/** Estado com a missão da etapa `step` em andamento, tudo antes dela já feito. */
function startAt(step) {
  const m = data.missions.find((x) => x.steps.includes(step));
  const s = startMission(finished, m.id, data);
  const done = m.steps.slice(0, m.steps.indexOf(step)).map((x) => x.id);
  return { ...s, missionRun: { ...s.missionRun, done } };
}

test('missões: o indicador certo da titulação do vinagre (pH no ponto estequiométrico)', () => {
  const t = titration(M('m-vinagre').steps.find((s) => s.id === 'm-vinagre-mol').calc, data);
  const acetic = data.equilibrium.acids.find((a) => a.game === 'CH3COOH');
  // No ponto estequiométrico só há acetato (base fraca), diluído no volume total.
  const c = t.nAnalyte / ((10.0 + 16.7) / 1000);
  const { pH } = solutionPH('weakBase', c, { Kb: data.equilibrium.Kw.value / acetic.Ka });
  assert.ok(pH > 8.5 && pH < 9.5, `"pH perto de 9" (${pH.toFixed(2)})`);
  const step = M('m-vinagre').steps.find((s) => s.id === 'm-vinagre-indicador');
  const ind = (name) => data.equilibrium.indicators.find((i) => i.name === name);
  const fen = ind('fenolftaleína');
  assert.ok(pH >= fen.range[0] && pH <= fen.range[1], 'a fenolftaleína vira nesse pH');
  for (const [value, name] of [['fenolftaleina', 'fenolftaleína'], ['alaranjado', 'alaranjado de metila'], ['bromotimol', 'azul de bromotimol']]) {
    const label = step.choices.find((c) => c.value === value).label;
    const r = ind(name).range.map((x) => String(x.toFixed(1)).replace('.', ','));
    assert.ok(label.includes(`${r[0]} e ${r[1]}`), `faixa do ${name} igual à Tabela 12.3`);
    if (value !== 'fenolftaleina') assert.ok(ind(name).range[1] < pH, `${name} viraria antes do ponto`);
  }
});

test('missões: massas molares citadas nos textos', () => {
  const mm = (f) => Math.round(molarMass(f, data.atomicMasses));
  const balao = M('m-balao').steps.find((s) => s.id === 'm-balao-sobe');
  for (const [f, v] of [['H2', 2], ['O2', 32], ['CO2', 44], ['N2', 28]]) {
    assert.equal(mm(f), v);
    assert.ok(JSON.stringify(balao).includes(`${v} g/mol`), `${f}: ${v} g/mol`);
  }
  assert.equal(mm('CH3COOH'), 60);
});
