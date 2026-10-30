// Estequiometria: exemplos das seções L e M de Atkins & Jones.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { stoichiometry } from '../src/core/stoichiometry.js';

const data = loadData();
const R = (id) => data.reactionsById.get(id);
const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${a} ≠ ${b}`);

test('seção L: 0,25 mol de O2 formam 0,50 mol (9,0 g) de água (p. F86)', () => {
  const s = stoichiometry(R('h2-o2'), data, { O2: 0.25 * 31.998 });
  const water = s.products.find((p) => p.id === 'H2O');
  close(water.mol, 0.5);
  close(water.grams, 9.0);
  close(s.reactants.find((r) => r.id === 'H2').used, 1.008); // 0,50 mol de H2
});

test('massa de produto: 16 g de metano dão 44 g de CO2', () => {
  const s = stoichiometry(R('ch4-o2'), data, { CH4: 16.043 });
  close(s.products.find((p) => p.id === 'CO2').grams, 44.01);
  close(s.products.find((p) => p.id === 'H2O').grams, 36.03);
});

test('seção M: reagente limitante e sobra', () => {
  // 4,0 g de H2 (≈2 mol) precisariam de 1 mol (32 g) de O2; só há 16 g → o O2 limita.
  const s = stoichiometry(R('h2-o2'), data, { H2: 4.0, O2: 16.0 });
  assert.equal(s.limiting, 'O2');
  close(s.products.find((p) => p.id === 'H2O').grams, 18.015);
  close(s.reactants.find((r) => r.id === 'H2').left, 4.0 - 2.016, 0.01); // 0,5 mol de O2 consomem 1 mol (2,016 g) de H2
  // conservação da massa: o que reagiu = o que se formou
  const used = s.reactants.reduce((a, r) => a + r.used, 0);
  const made = s.products.reduce((a, p) => a + p.grams, 0);
  close(used, made, 1e-9);
});

test('precisa de pelo menos um reagente', () => {
  assert.throws(() => stoichiometry(R('h2-o2'), data, {}));
});
