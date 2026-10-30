// Estruturas 2D: todo desenho tem de bater com a fórmula (átomos e carga), respeitar valências
// e ter geometria plausível. A animação depende disso para casar os átomos um a um.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { checkStructure, formulaUnit, displayStructure, structureKind, ionStructure, layoutSide, pairAtoms } from '../src/core/structure.js';

const data = loadData();
const KINDS = ['molecule', 'ionic', 'network', 'lattice', 'atom'];

test('o verificador detecta desenhos errados (sanidade do próprio teste)', () => {
  const s = (atoms, bonds = []) => ({ atoms: atoms.map(([el, x, y, charge = 0]) => ({ el, x, y, charge })), bonds: bonds.map(([a, b, order]) => ({ a, b, order })) });
  const agua = s([['O', 0, 0], ['H', -0.79, 0.61], ['H', 0.79, 0.61]], [[0, 1, 1], [0, 2, 1]]);
  assert.deepEqual(checkStructure(agua, 'H2O'), []);
  assert.notDeepEqual(checkStructure(agua, 'H2O2'), [], 'átomo faltando');
  assert.notDeepEqual(checkStructure(s([['O', 0, 0], ['H', -0.79, 0.61], ['H', 0.79, 0.61]], [[0, 1, 2], [0, 2, 1]]), 'H2O'), [], 'H com duas ligações');
  assert.notDeepEqual(checkStructure(s([['C', 0, 0], ['O', 1.1, 0]], [[0, 1, 2]]), 'CO'), [], 'C com só duas ligações');
  assert.notDeepEqual(checkStructure(s([['O', 0, 0], ['H', 3, 0], ['H', -0.79, 0.61]], [[0, 1, 1], [0, 2, 1]]), 'H2O'), [], 'ligação longa demais');
  assert.deepEqual(checkStructure(s([['O', 0, 0, -1], ['H', 0.95, 0]], [[0, 1, 1]]), 'OH-'), [], 'OH⁻ correto passa');
  assert.notDeepEqual(checkStructure(s([['O', 0, 0], ['H', 0.95, 0]], [[0, 1, 1]]), 'OH-'), [], 'carga formal faltando');
});

test('toda substância tem estrutura de um tipo conhecido', () => {
  for (const sub of data.substances) {
    const kind = structureKind(sub, data);
    assert.ok(KINDS.includes(kind), `${sub.id}: sem estrutura (adicione em data/structures.json)`);
    assert.ok(displayStructure(sub, data)?.atoms.length > 0, `${sub.id}: desenho vazio`);
  }
});

test('entradas de structures.json referem substâncias existentes e coerentes', () => {
  for (const [id, entry] of Object.entries(data.structures.substances)) {
    const sub = data.substancesById.get(id);
    assert.ok(sub, `structures.json: substância inexistente ${id}`);
    assert.ok(KINDS.includes(entry.kind), `${id}: kind ${entry.kind}`);
    if (entry.kind === 'molecule') assert.ok(!sub.ions || sub.categories.includes('acido'), `${id}: composto iônico desenhado como molécula`);
    if (entry.kind === 'ionic' && sub.ions) assert.deepEqual({ cation: entry.cation, anion: entry.anion }, sub.ions, `${id}: íons diferentes de substances.json`);
    if (entry.kind === 'network') assert.ok(entry.note, `${id}: explique o trecho de rede em 'note'`);
  }
});

test('íons poliatômicos: átomos, carga formal total e valências', () => {
  for (const [formula, entry] of Object.entries(data.structures.ions)) {
    const problems = checkStructure(ionStructure(formula, data), formula);
    assert.deepEqual(problems, [], `${formula}: ${problems.join('; ')}`);
  }
});

test('todo íon usado por um composto iônico tem desenho', () => {
  for (const sub of data.substances.filter((s) => structureKind(s, data) === 'ionic')) {
    const { cation, anion } = data.structures.substances[sub.id] ?? sub.ions;
    for (const ion of [cation, anion]) assert.ok(ionStructure(ion.formula, data), `${sub.id}: falta desenhar o íon ${ion.formula}`);
  }
});

for (const sub of data.substances) {
  test(`estrutura de ${sub.id} confere com a fórmula`, () => {
    const kind = structureKind(sub, data);
    const unit = formulaUnit(sub, data);
    // A unidade-fórmula (animação) tem exatamente os átomos da fórmula, para todos os tipos.
    const exact = checkStructure(unit, sub.formula, { covalent: kind === 'molecule' });
    assert.deepEqual(exact, [], `${sub.id}: ${exact.join('; ')}`);
    if (kind === 'network') {
      const shown = checkStructure(displayStructure(sub, data), sub.formula, { covalent: false, exactAtoms: false });
      assert.deepEqual(shown, [], `${sub.id}: ${shown.join('; ')}`);
    }
    if (kind === 'ionic') {
      assert.ok(unit.atoms.some((a) => a.charge > 0) && unit.atoms.some((a) => a.charge < 0), `${sub.id}: íons sem carga no desenho`);
    }
  });
}

test('animação: em toda reação, cada átomo dos reagentes casa com um dos produtos', () => {
  for (const r of data.reactions) {
    const left = layoutSide(r.reactants, data);
    const right = layoutSide(r.products, data);
    assert.equal(left.atoms.length, right.atoms.length, `${r.id}: número de átomos difere`);
    const match = pairAtoms(left.atoms, right.atoms);
    assert.ok(match.every((m) => m !== null), `${r.id}: átomo sem par`);
    assert.equal(new Set(match).size, match.length, `${r.id}: dois átomos no mesmo lugar`);
    match.forEach((m, i) => assert.equal(left.atoms[i].el, right.atoms[m].el, `${r.id}: elemento trocado`));
  }
});
