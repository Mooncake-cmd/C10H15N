// Progressão: todo objetivo precisa ser alcançável com o que já está desbloqueado, e o jogo
// inteiro precisa ser "zerável". Simulamos um jogador que tenta tudo o que tem à mão.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { createEngine } from '../src/core/engine.js';
import { initialState, applyResult, inventory, OBJECTIVE_TYPES } from '../src/core/progression.js';

const data = loadData();
const engine = createEngine(data);
const levels = data.progression.levels;

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
      if (o.type === 'nonReaction' && !o.reasonId.startsWith('rule:')) assert.ok(nrIds.has(o.reasonId), o.id);
    }
  }
});

test('todo elemento jogável é desbloqueado em algum nível', () => {
  const unlocked = new Set(levels.flatMap((l) => l.unlocks?.elements ?? []));
  for (const s of data.substances.filter((x) => x.elementOf)) assert.ok(unlocked.has(s.elementOf), s.elementOf);
});

/** Um "jogador exaustivo": tenta todas as reações e não-reações possíveis com o inventário atual. */
function playLevel(state) {
  let changed = true;
  const allEvents = [];
  const startLevel = state.levelIndex;
  while (changed && state.levelIndex === startLevel && !state.finished) {
    changed = false;
    const inv = inventory(state, data);
    const have = new Set(inv.substances);
    const attempts = [
      ...data.reactions.filter((r) => r.reactants.every((e) => have.has(e.id))).map((r) => [...r.reactants.map((e) => e.id), ...inv.items]),
      ...data.nonReactions.filter((n) => n.substances.every((id) => have.has(id))).map((n) => n.substances),
      ...inv.substances.filter((id) => data.substancesById.get(id).categories.includes('gas-nobre')).map((id) => [id, 'O2']),
    ];
    for (const sel of attempts) {
      const before = JSON.stringify(state);
      const { state: s, events } = applyResult(state, engine.combine(sel), data);
      state = s;
      allEvents.push(...events);
      if (JSON.stringify(state) !== before) changed = true;
      if (state.levelIndex !== startLevel || state.finished) break;
    }
  }
  return { state, events: allEvents };
}

test('o jogo inteiro pode ser concluído, nível por nível, só com o que está desbloqueado', () => {
  let state = initialState(data);
  for (let i = 0; i < levels.length; i++) {
    assert.equal(state.levelIndex, i);
    const res = playLevel(state);
    state = res.state;
    const pending = levels[i].objectives.filter((o) => !state.completedObjectives.includes(o.id)).map((o) => o.id);
    assert.deepEqual(pending, [], `Nível ${levels[i].id}: objetivos inalcançáveis`);
  }
  assert.equal(state.finished, true);
});

test('produzir água completa o objetivo e gera eventos de descoberta', () => {
  const s0 = initialState(data);
  const { state, events } = applyResult(s0, engine.combine(['H2', 'O2', 'faisca']), data);
  assert.ok(state.produced.includes('H2O'));
  assert.ok(events.some((e) => e.type === 'discovered' && e.substance.id === 'H2O'));
  assert.ok(events.some((e) => e.type === 'objective' && e.objective.id === 'n1-agua'));
});

test('completar o nível 1 desbloqueia o nível 2', () => {
  let s = initialState(data);
  s = applyResult(s, engine.combine(['H2', 'O2', 'faisca']), data).state;
  const { state, events } = applyResult(s, engine.combine(['Na', 'Cl2']), data);
  assert.equal(state.levelIndex, 1);
  assert.ok(state.unlockedElements.includes('C'));
  assert.ok(events.some((e) => e.type === 'level-complete'));
});
