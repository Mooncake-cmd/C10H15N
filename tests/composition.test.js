// Composição em massa, fórmula mínima e leis ponderais: exemplos resolvidos da seção F de
// Atkins & Jones (p. F46–F49).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { massComposition, empiricalFormula, empiricalFromPercent, molecularFromEmpirical, multipleProportions, sameElementsPartners, massRatio } from '../src/core/composition.js';
import { parseFormula } from '../src/core/formula.js';

const data = loadData();
const M = data.atomicMasses;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('Exemplo F.1: a água tem 11,19% de hidrogênio em massa', () => {
  const c = massComposition('H2O', M);
  near(c.find((x) => x.el === 'H').pct, 11.19, 0.01, '%H');
  near(c.reduce((a, x) => a + x.pct, 0), 100, 1e-9, 'soma');
});

test('Exemplos F.2–F.4: vitamina C (C3H4O3 → C6H8O6) e o composto da coagulação (C11H12N2)', () => {
  assert.equal(empiricalFromPercent({ C: 40.9, H: 4.58, O: 54.5 }, M).formula, 'C3H4O3');
  assert.equal(empiricalFromPercent({ C: 76.71, H: 7.02, N: 16.27 }, M).formula, 'C11H12N2');
  assert.deepEqual(molecularFromEmpirical('C3H4O3', 176.12, M), { n: 2, formula: 'C6H8O6' });
  assert.equal(empiricalFromPercent({ C: 0, H: 10 }, M), null);
});

test('fórmula mínima pelo MDC', () => {
  assert.deepEqual(empiricalFormula('CH3COOH'), { formula: 'CH2O', factor: 2 });
  assert.deepEqual(empiricalFormula('H2O2'), { formula: 'HO', factor: 2 });
  assert.deepEqual(empiricalFormula('C3H8'), { formula: 'C3H8', factor: 1 });
  // Ida e volta: a composição em massa de cada composto do jogo devolve a sua fórmula mínima.
  let n = 0;
  for (const sub of data.substances) {
    const atoms = parseFormula(sub.formula).atoms;
    if (Object.keys(atoms).length < 2) continue;
    const pcts = Object.fromEntries(massComposition(sub.formula, M).map((x) => [x.el, x.pct]));
    const got = empiricalFromPercent(pcts, M, 0.02);
    if (!got) continue; // índices grandes demais para a busca até ×12
    const sorted = (o) => JSON.stringify(Object.entries(o).sort());
    assert.equal(sorted(got.counts), sorted(parseFormula(empiricalFormula(sub.formula).formula).atoms), sub.id);
    n++;
  }
  assert.ok(n > 80, `só ${n} compostos conferidos`);
});

test('lei de Proust: a razão das massas é fixa', () => {
  const r = massRatio('H2O', M);
  assert.equal(r.base.el, 'H');
  near(r.others[0].perGram, 15.999 / 2.016, 0.01, 'g de O por g de H');
});

test('lei de Dalton: H2O e H2O2, CO e CO2 — razão 1 : 2', () => {
  assert.deepEqual(multipleProportions('H2O', 'H2O2'), { a: 'H', b: 'O', ratio: [1, 2] });
  assert.deepEqual(multipleProportions('CO', 'CO2'), { a: 'C', b: 'O', ratio: [1, 2] });
  assert.deepEqual(multipleProportions('FeO', 'Fe2O3'), { a: 'Fe', b: 'O', ratio: [2, 3] });
  assert.equal(multipleProportions('H2O', 'NaCl'), null);
  assert.equal(multipleProportions('NO2', 'N2O4'), null); // mesma proporção
  assert.ok(sameElementsPartners('H2O', data.substances).some((s) => s.formula === 'H2O2'));
});
