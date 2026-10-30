import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFormula, formatFormulaHTML, molarMass, FormulaError } from '../src/core/formula.js';

test('fórmulas simples', () => {
  assert.deepEqual(parseFormula('H2O'), { atoms: { H: 2, O: 1 }, charge: 0 });
  assert.deepEqual(parseFormula('NaCl'), { atoms: { Na: 1, Cl: 1 }, charge: 0 });
  assert.deepEqual(parseFormula('CH3COOH'), { atoms: { C: 2, H: 4, O: 2 }, charge: 0 });
});

test('parênteses, colchetes e hidratos', () => {
  assert.deepEqual(parseFormula('Ca(OH)2').atoms, { Ca: 1, O: 2, H: 2 });
  assert.deepEqual(parseFormula('Al2(SO4)3').atoms, { Al: 2, S: 3, O: 12 });
  assert.deepEqual(parseFormula('[Cu(NH3)4]SO4').atoms, { Cu: 1, N: 4, H: 12, S: 1, O: 4 });
  assert.deepEqual(parseFormula('CuSO4·5H2O').atoms, { Cu: 1, S: 1, O: 9, H: 10 });
});

test('cargas', () => {
  assert.equal(parseFormula('Na+').charge, 1);
  assert.equal(parseFormula('Cl-').charge, -1);
  assert.equal(parseFormula('SO4^2-').charge, -2);
  assert.deepEqual(parseFormula('SO4^2-').atoms, { S: 1, O: 4 });
  assert.equal(parseFormula('Fe^3+').charge, 3);
  assert.deepEqual(parseFormula('Fe^3+').atoms, { Fe: 1 });
  assert.equal(parseFormula('NH4+').charge, 1);
  assert.deepEqual(parseFormula('NH4+').atoms, { N: 1, H: 4 });
});

test('fórmulas inválidas lançam erro', () => {
  for (const bad of ['', 'h2o', 'Ca(OH2', 'NaCl)', '2', '+']) {
    assert.throws(() => parseFormula(bad), FormulaError, bad);
  }
});

test('formatação HTML', () => {
  assert.equal(formatFormulaHTML('H2O'), 'H<sub>2</sub>O');
  assert.equal(formatFormulaHTML('SO4^2-'), 'SO<sub>4</sub><sup>2−</sup>');
  assert.equal(formatFormulaHTML('Na+'), 'Na<sup>+</sup>');
});

test('massa molar', () => {
  const m = { H: 1.008, O: 15.999 };
  assert.ok(Math.abs(molarMass('H2O', m) - 18.015) < 1e-9);
});
