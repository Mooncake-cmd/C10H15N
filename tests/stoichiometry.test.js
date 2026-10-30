// Estequiometria: exemplos das seções L e M de Atkins & Jones.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { stoichiometry, molesOf, percentYield, MOLAR_VOLUME_L } from '../src/core/stoichiometry.js';

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

test('medidas: gramas, mol, litros de gás e solução (mL × mol/L)', () => {
  close(molesOf(36.03, 18.015), 2);
  close(molesOf({ mol: 0.5 }, 18.015), 0.5);
  close(molesOf({ L: 24.47 }, 44.01), 1); // gás ideal a 25 °C e 1 atm
  close(molesOf({ mL: 50, M: 0.1 }, 36.46), 0.005); // seção G.3: mol = L × mol/L
  assert.equal(molesOf({ mL: -1, M: 1 }, 1), null);
  close(MOLAR_VOLUME_L, (0.082057 * 298.15) / 1, 0.001);
});

test('produtos gasosos também em litros', () => {
  const s = stoichiometry(R('ch4-o2'), data, { CH4: { mol: 1 } });
  close(s.products.find((p) => p.id === 'CO2').liters, 24.47);
  assert.equal(s.products.find((p) => p.id === 'H2O').liters, null, 'a água sai líquida');
});

test('solução: 50 mL de HCl 0,10 mol/L neutralizados dão 0,29 g de NaCl', () => {
  const s = stoichiometry(R('hcl-naoh'), data, { HCl: { mL: 50, M: 0.1 } });
  close(s.products.find((p) => p.id === 'NaCl').grams, 0.005 * 58.44);
});

test('rendimento percentual: exercício M (p. F103) — 17,5 g de CO2 de 42,73 g de CaCO3', () => {
  const s = stoichiometry(R('caco3-calor'), data, { CaCO3: 42.73 });
  const co2 = s.products.find((p) => p.id === 'CO2');
  close(co2.grams, 18.79);
  close(percentYield(17.5, co2.grams), 93.1);
});
