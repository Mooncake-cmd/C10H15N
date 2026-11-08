// Progressão: todo objetivo precisa ser alcançável com o que já está desbloqueado, e o jogo
// inteiro precisa ser "zerável". Simulamos um jogador que tenta tudo o que tem à mão.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData, playMission } from './helpers.js';
import { createEngine } from '../src/core/engine.js';
import { initialState, applyResult, inventory, restoreState, STATE_VERSION, OBJECTIVE_TYPES, answerObjective, stoichAnswer } from '../src/core/progression.js';
import { kineticsAnswer, kAt } from '../src/core/kinetics.js';
import { equilibriumAnswer } from '../src/core/equilibrium.js';
import { moleculeAnswer } from '../src/core/vsepr.js';
import { organicAnswer } from '../src/core/organic.js';
import { lookupReaction } from '../src/core/engine.js';
import { FUNDAMENTAL_TYPES, fundamentalsAnswer } from '../src/core/fundamentals.js';

const data = loadData();
const engine = createEngine(data);
const levels = data.progression.levels;
const idx = (id) => levels.findIndex((l) => l.id === id);

/** Responde às perguntas dos níveis de fundamentos (Fase 4A) e chega ao nível n1 (a bancada). */
function skipFundamentals(state) {
  let s = state;
  while (!s.finished && levels[s.levelIndex].since === 3 && levels[s.levelIndex].objectives.every((o) => FUNDAMENTAL_TYPES.includes(o.type))) {
    const at = s.levelIndex;
    for (const o of levels[at].objectives) s = answerObjective(s, o.id, fundamentalsAnswer(o, data), data).state;
    assert.notEqual(s.levelIndex, at, `${levels[at].id}: as respostas certas não concluíram o nível`);
  }
  return s;
}

test('referências da progressão existem', () => {
  const objIds = new Set();
  const nrIds = new Set(data.nonReactions.map((n) => n.id));
  for (const lvl of levels) {
    const u = lvl.unlocks ?? {};
    (u.elements ?? []).forEach((s) => assert.ok(data.elementalBySymbol.has(s), `${lvl.id}: elemento sem forma jogável ${s}`));
    (u.substances ?? []).forEach((s) => assert.ok(data.substancesById.has(s), `${lvl.id}: ${s}`));
    (u.items ?? []).forEach((s) => assert.ok(data.itemsById.has(s), `${lvl.id}: ${s}`));
    assert.ok(lvl.objectives.length > 0 && lvl.intro && lvl.lesson, lvl.id);
    for (const o of lvl.objectives) {
      assert.ok(!objIds.has(o.id), `objetivo duplicado ${o.id}`);
      objIds.add(o.id);
      assert.ok(OBJECTIVE_TYPES.includes(o.type), `${o.id}: tipo ${o.type}`);
      if (o.substance) assert.ok(data.substancesById.has(o.substance), o.id);
      if (o.withReactant) assert.ok(data.substancesById.has(o.withReactant), o.id);
      if (o.type === 'reaction') assert.ok(lookupReaction(data, o.reaction), o.id);
      if (o.type === 'stoich') {
        const r = lookupReaction(data, o.reaction);
        assert.ok(r, `${o.id}: reação ${o.reaction}`);
        for (const id of Object.keys(o.given)) assert.ok(r.reactants.some((e) => e.id === id), `${o.id}: ${id} não é reagente`);
        if (o.ask === 'limiting') assert.ok(Object.keys(o.given).length > 1, `${o.id}: limitante precisa de dois reagentes`);
        else if (o.ask === 'yield') assert.ok(r.products.some((e) => e.id === o.actual?.id), `${o.id}: rendimento de um produto`);
        else if (o.ask === 'heat') assert.ok(Number.isFinite(stoichAnswer(o, data)), `${o.id}: reação sem ΔH° conhecido`);
        else assert.ok(r.products.some((e) => e.id === o.ask), `${o.id}: pergunta inválida`);
        assert.ok(Number.isFinite(stoichAnswer(o, data)) || typeof stoichAnswer(o, data) === 'string', `${o.id}: sem resposta calculável`);
      }
      if (o.type === 'kinetics') {
        const e = data.kinetics.byId.get(o.kinetics);
        assert.ok(e, `${o.id}: cinética ${o.kinetics}`);
        assert.ok(['halfLife', 'concentration', 'ratio', 'k'].includes(o.ask) && o.unitLabel, `${o.id}: pergunta`);
        if (o.ask !== 'ratio') assert.ok(kAt(e, o.T), `${o.id}: sem k conferido a ${o.T} K`);
        assert.ok(Number.isFinite(kineticsAnswer(o, data.kinetics)), `${o.id}: sem resposta calculável`);
      }
      if (o.type === 'nonReaction' && !o.reasonId.startsWith('rule:')) assert.ok(nrIds.has(o.reasonId), o.id);
    }
  }
});

test('todo elemento jogável é desbloqueado em algum nível', () => {
  const unlocked = new Set(levels.flatMap((l) => l.unlocks?.elements ?? []));
  for (const s of data.substances.filter((x) => x.elementOf)) assert.ok(unlocked.has(s.elementOf), s.elementOf);
});

/** Um "jogador exaustivo": tenta todas as reações e não-reações possíveis com o inventário atual. */
async function playLevel(state) {
  let changed = true;
  const allEvents = [];
  const startLevel = state.levelIndex;
  while (changed && state.levelIndex === startLevel && !state.finished) {
    changed = false;
    const inv = inventory(state, data);
    const have = new Set(inv.substances);
    const subs = inv.substances;
    const attempts = [
      ...data.reactions.filter((r) => r.reactants.every((e) => have.has(e.id))).map((r) => [...r.reactants.map((e) => e.id), ...inv.items]),
      ...data.nonReactions.filter((n) => n.substances.every((id) => have.has(id))).map((n) => n.substances),
      ...subs.filter((id) => data.substancesById.get(id).categories.includes('gas-nobre')).map((id) => [id, 'O2']),
      // Fase 2: qualquer par (com e sem ferramentas), como um jogador explorando
      ...subs.flatMap((a, i) => subs.slice(i + 1).flatMap((b) => [[a, b], [a, b, ...inv.items]])),
      ...subs.map((a) => [a, ...inv.items]),
    ];
    for (const sel of attempts) {
      const before = JSON.stringify(state);
      const { state: s, events } = applyResult(state, engine.combine(sel), data);
      state = s;
      allEvents.push(...events);
      if (JSON.stringify(state) !== before) changed = true;
      if (state.levelIndex !== startLevel || state.finished) break;
    }
    // Perguntas de estequiometria: o jogador "faz a conta" (a resposta certa calculada).
    for (const o of data.progression.levels[startLevel].objectives.filter((x) => ['stoich', 'kinetics', 'equilibrium', 'molecule', 'organic', ...FUNDAMENTAL_TYPES].includes(x.type))) {
      if (state.levelIndex !== startLevel || state.finished) break;
      const before = JSON.stringify(state);
      const answer =
        FUNDAMENTAL_TYPES.includes(o.type) ? fundamentalsAnswer(o, data) : o.type === 'kinetics' ? kineticsAnswer(o, data.kinetics) : o.type === 'equilibrium' ? equilibriumAnswer(o, data) : o.type === 'molecule' ? moleculeAnswer(o, data) : o.type === 'organic' ? organicAnswer(o, data) : stoichAnswer(o, data);
      state = answerObjective(state, o.id, answer, data).state;
      if (JSON.stringify(state) !== before) changed = true;
    }
    // Missões (Fase 3F): o jogador faz as que estão liberadas e ainda não concluiu.
    for (const m of data.missions) {
      if (state.levelIndex !== startLevel || state.finished) break;
      if ((state.missionsDone ?? []).includes(m.id)) continue;
      const before = JSON.stringify(state);
      const res = await playMission(state, m.id, data, engine);
      if (res.stuck === 'não liberada') continue;
      state = res.state;
      if (JSON.stringify(state) !== before) changed = true;
    }
  }
  return { state, events: allEvents };
}

test('o jogo inteiro pode ser concluído, nível por nível, só com o que está desbloqueado', async () => {
  let state = initialState(data);
  for (let i = 0; i < levels.length; i++) {
    // Um nível pode já chegar cumprido pelo histórico (ex.: água feita na bancada durante os
    // fundamentos); aí o jogo passa direto por ele.
    if (state.levelIndex > i || state.finished) {
      assert.ok(levels[i].objectives.every((o) => state.completedObjectives.includes(o.id)), `${levels[i].id}: pulado sem concluir`);
      continue;
    }
    assert.equal(state.levelIndex, i);
    const res = await playLevel(state);
    state = res.state;
    const pending = levels[i].objectives.filter((o) => !state.completedObjectives.includes(o.id)).map((o) => o.id);
    assert.deepEqual(pending, [], `Nível ${levels[i].id}: objetivos inalcançáveis`);
  }
  assert.equal(state.finished, true);
});

test('o jogo começa pelos fundamentos, com a bancada já liberada', () => {
  const s0 = initialState(data);
  assert.equal(levels[s0.levelIndex].id, 'f1');
  assert.ok(['H', 'O', 'Na', 'Cl'].every((x) => s0.unlockedElements.includes(x)));
  const s1 = skipFundamentals(s0);
  assert.equal(levels[s1.levelIndex].id, 'n1', 'respondendo às perguntas chega-se à bancada');
  // Reações feitas durante os fundamentos contam quando o nível n1 chega.
  let s = applyResult(s0, engine.combine(['H2', 'O2', 'faisca']), data).state;
  assert.equal(s.levelIndex, 0);
  s = skipFundamentals(s);
  assert.ok(s.completedObjectives.includes('n1-agua'));
});

test('produzir água completa o objetivo e gera eventos de descoberta', () => {
  const s0 = skipFundamentals(initialState(data));
  const { state, events } = applyResult(s0, engine.combine(['H2', 'O2', 'faisca']), data);
  assert.ok(state.produced.includes('H2O'));
  assert.ok(events.some((e) => e.type === 'discovered' && e.substance.id === 'H2O'));
  assert.ok(events.some((e) => e.type === 'objective' && e.objective.id === 'n1-agua'));
});

test('completar o nível 1 desbloqueia o nível 2', () => {
  let s = skipFundamentals(initialState(data));
  s = applyResult(s, engine.combine(['H2', 'O2', 'faisca']), data).state;
  const { state, events } = applyResult(s, engine.combine(['Na', 'Cl2']), data);
  assert.equal(state.levelIndex, idx('n2'));
  assert.ok(state.unlockedElements.includes('C'));
  assert.ok(events.some((e) => e.type === 'level-complete'));
});

test('save da versão 1 é migrado refazendo o caminho pelo histórico', () => {
  // Jogador da v1 que tinha concluído os níveis 1–3 antigos (o 3 incluía o cálcio) e estava no
  // nível "Ácidos e bases" (índice 3 na v1). Na v2 o nível 3 ganhou objetivos novos.
  let s = initialState(data);
  for (const sel of [['H2', 'O2', 'faisca'], ['Na', 'Cl2']]) s = applyResult(s, engine.combine(sel), data).state;
  const v1 = {
    ...s,
    version: 1,
    levelIndex: 3,
    unlockedElements: ['H', 'O', 'Na', 'Cl', 'C', 'S', 'Mg', 'Fe', 'Cu', 'Li', 'K', 'Ca'],
    produced: [...s.produced, 'CO2', 'MgO', 'NaOH', 'LiOH', 'KOH', 'Ca(OH)2', 'H2'],
    reactionsDone: [...s.reactionsDone, 'c-o2', 'mg-o2', 'ch4-o2', 'na-h2o', 'li-h2o', 'k-h2o', 'ca-h2o'],
    completedObjectives: ['n1-agua', 'n1-sal', 'n2-co2', 'n2-mgo', 'n2-ch4', 'n3-na', 'n3-li', 'n3-k', 'n3-ca'],
  };
  const restored = restoreState(JSON.parse(JSON.stringify(v1)), data);
  assert.equal(restored.version, STATE_VERSION);
  assert.equal(data.progression.levels[restored.levelIndex].id, 'n3', 'volta para o primeiro nível com objetivo novo');
  assert.ok(restored.completedObjectives.includes('n3-li') && !restored.completedObjectives.includes('n3-cs'));
  assert.ok(restored.unlockedElements.includes('Cs'), 'desbloqueios do nível atual são aplicados');
  assert.ok(restored.produced.includes('Ca(OH)2'), 'histórico preservado');
});

test('save da versão 2 (antes dos fundamentos) continua no mesmo nível', async () => {
  // Jogador da v2 que tinha concluído n1–n4 e estava no n5. Na v2 não havia os níveis de
  // fundamentos, então o levelIndex salvo era 5 posições menor.
  let s = skipFundamentals(initialState(data));
  while (levels[s.levelIndex].id !== 'n5') s = (await playLevel(s)).state;
  const fIds = new Set(levels.filter((l) => l.since === 3).flatMap((l) => l.objectives.map((o) => o.id)));
  const v2 = {
    ...s,
    version: 2,
    levelIndex: idx('n5') - levels.filter((l) => l.since === 3).length,
    stoichSolved: s.stoichSolved.filter((id) => !fIds.has(id)),
    completedObjectives: s.completedObjectives.filter((id) => !fIds.has(id)),
  };
  const restored = restoreState(JSON.parse(JSON.stringify(v2)), data);
  assert.equal(restored.version, STATE_VERSION);
  assert.equal(levels[restored.levelIndex].id, 'n5', 'não volta para os fundamentos');
  assert.ok([...fIds].every((id) => restored.completedObjectives.includes(id)), 'fundamentos contam como feitos');
  assert.deepEqual(restored.produced, s.produced);
});

test('save da versão atual é restaurado como está', () => {
  let s = initialState(data);
  s = applyResult(s, engine.combine(['H2', 'O2', 'faisca']), data).state;
  assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s)), data), s);
});

test('estequiometria: resposta errada não conta; certa (com vírgula e arredondada) conta', () => {
  const o = levels.flatMap((l) => l.objectives).find((x) => x.id === 'n10-co2');
  const s0 = initialState(data);
  assert.equal(answerObjective(s0, o.id, '40', data).correct, false);
  const { correct, state } = answerObjective(s0, o.id, '43,9', data);
  assert.equal(correct, true);
  assert.ok(state.stoichSolved.includes(o.id));
  const lim = levels.flatMap((l) => l.objectives).find((x) => x.id === 'n10-limite');
  assert.equal(stoichAnswer(lim, data), 'O2');
  assert.equal(answerObjective(s0, lim.id, 'H2', data).correct, false);
});

test('quem terminou a Fase 1 entra na Fase 2 ao carregar o jogo', async () => {
  let s = initialState(data);
  const phase1Last = levels.findLastIndex((l) => l.phase === 1);
  for (let i = 0; i <= phase1Last; i++) s = (await playLevel(s)).state;
  const oldSave = { ...s, finished: true, levelIndex: phase1Last };
  const restored = restoreState(JSON.parse(JSON.stringify(oldSave)), data);
  assert.equal(restored.finished, false);
  assert.equal(levels[restored.levelIndex].phase, 2);
  assert.ok(restored.unlockedSubstances.includes('BaCl2'));
});

test('estequiometria com unidades: litros de gás, solução e rendimento', () => {
  const find = (id) => levels.flatMap((l) => l.objectives).find((x) => x.id === id);
  const s0 = initialState(data);
  assert.ok(Math.abs(stoichAnswer(find('n11-litros'), data) - 3 * 24.47) < 0.01);
  assert.equal(answerObjective(s0, 'n11-litros', '73,4', data).correct, true);
  assert.equal(answerObjective(s0, 'n11-litros', '24,5', data).correct, false);
  assert.equal(answerObjective(s0, 'n11-solucao', '0,29', data).correct, true);
  assert.equal(answerObjective(s0, 'n11-solucao', '0,58', data).correct, false);
  assert.equal(answerObjective(s0, 'n11-rendimento', '93,1%', data).correct, true);
  assert.equal(answerObjective(s0, 'n11-rendimento', '107', data).correct, false);
});

test('Fase 3A: perguntas de calor', () => {
  const find = (id) => levels.flatMap((l) => l.objectives).find((x) => x.id === id);
  assert.ok(Math.abs(stoichAnswer(find('n12-metano'), data) - (16.0 / 16.043) * 890.36) < 0.5);
  assert.ok(Math.abs(stoichAnswer(find('n12-etanol'), data) - (23.0 / 46.069) * 1366.8) < 2);
  const s0 = initialState(data);
  assert.equal(answerObjective(s0, 'n12-metano', '888', data).correct, true);
  assert.equal(answerObjective(s0, 'n12-metano', '-888', data).correct, false, 'pergunta o calor liberado (positivo)');
});
