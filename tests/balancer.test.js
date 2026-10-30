// Balanceamento automático: tem de reproduzir os coeficientes de TODAS as reações curadas
// (conferidas à mão com fonte) e recusar equações impossíveis ou ambíguas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { balance, BalanceError } from '../src/core/balancer.js';

const data = loadData();
const formula = (id) => data.substancesById.get(id).formula;

test('exemplos clássicos', () => {
  assert.deepEqual(balance(['H2', 'O2'], ['H2O']), { reactants: [2, 1], products: [2] });
  assert.deepEqual(balance(['CH4', 'O2'], ['CO2', 'H2O']), { reactants: [1, 2], products: [1, 2] });
  assert.deepEqual(balance(['Fe2O3', 'CO'], ['Fe', 'CO2']), { reactants: [1, 3], products: [2, 3] }); // Atkins & Jones, ex. L.1
  assert.deepEqual(balance(['C8H18', 'O2'], ['CO2', 'H2O']), { reactants: [2, 25], products: [16, 18] });
  assert.deepEqual(balance(['Al', 'CuSO4'], ['Al2(SO4)3', 'Cu']), { reactants: [2, 3], products: [1, 3] });
});

test('equações iônicas: conserva carga também', () => {
  assert.deepEqual(balance(['Zn', 'Cu^2+'], ['Zn^2+', 'Cu']), { reactants: [1, 1], products: [1, 1] });
  assert.deepEqual(balance(['Al', 'H+'], ['Al^3+', 'H2']), { reactants: [2, 6], products: [2, 3] });
  assert.deepEqual(balance(['Pb^2+', 'PO4^3-'], ['Pb3(PO4)2']), { reactants: [3, 2], products: [1] }); // ex. I.2
});

test('recusa o impossível e o ambíguo', () => {
  assert.throws(() => balance(['H2'], ['H2O']), BalanceError); // falta oxigênio
  assert.throws(() => balance(['NaCl'], ['Na', 'Cl2', 'KCl']), BalanceError); // K não existe à esquerda
  assert.throws(() => balance(['H2', 'O2'], ['H2O', 'H2O2']), BalanceError); // duas reações misturadas
  assert.throws(() => balance(['Zn', 'Cu^2+'], ['Zn^2+', 'Cu^2+']), BalanceError); // carga não fecha
});

for (const r of data.reactions) {
  test(`reproduz os coeficientes da reação curada ${r.id}`, () => {
    const got = balance(r.reactants.map((e) => formula(e.id)), r.products.map((e) => formula(e.id)));
    assert.deepEqual(got, { reactants: r.reactants.map((e) => e.coef), products: r.products.map((e) => e.coef) });
  });
}
