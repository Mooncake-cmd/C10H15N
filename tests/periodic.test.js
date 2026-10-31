// Propriedades periódicas: os dados do dataset aberto têm de mostrar as tendências que o jogo
// ensina (Atkins & Jones, seções 1.15–1.18; Bernoulli v. 2, Frente C, Módulo 06).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { PROPERTIES } from '../src/ui/periodic-table.js';

const data = loadData();
const el = (s) => data.elementsBySymbol.get(s);
const v = (s, k) => el(s)[k];
const increasing = (syms, k) => syms.every((s, i) => i === 0 || v(s, k) > v(syms[i - 1], k));

test('campos novos, com unidades plausíveis', () => {
  for (const e of data.elements) {
    if (e.covalentRadius != null) assert.ok(e.covalentRadius > 20 && e.covalentRadius < 300, `${e.symbol}: raio`);
    if (e.ionizationEnergy != null) assert.ok(e.ionizationEnergy > 300 && e.ionizationEnergy < 2500, `${e.symbol}: EI`);
    if (e.electronAffinity != null) assert.ok(e.electronAffinity > -250 && e.electronAffinity < 400, `${e.symbol}: AE`);
  }
  // Os elementos jogáveis têm todos os dados.
  for (const s of data.substances.filter((x) => x.elementOf)) {
    for (const k of ['covalentRadius', 'ionizationEnergy']) assert.ok(v(s.elementOf, k) != null, `${s.elementOf}: ${k}`);
  }
  for (const k of Object.keys(PROPERTIES)) assert.ok(data.elements.some((e) => e[k] != null), k);
});

test('raio atômico: cresce descendo o grupo, diminui ao longo do período', () => {
  assert.ok(increasing(['Li', 'Na', 'K', 'Rb', 'Cs'], 'covalentRadius'));
  assert.ok(increasing(['F', 'Cl', 'Br', 'I'], 'covalentRadius'));
  // No raio covalente simples, O (63 pm) e F (64 pm) ficam praticamente iguais: a tendência do
  // período vale no conjunto, mas não estrita nesse par.
  assert.ok(increasing(['F', 'N', 'C', 'B', 'Be', 'Li'], 'covalentRadius'));
  assert.ok(Math.abs(v('O', 'covalentRadius') - v('F', 'covalentRadius')) <= 2);
  assert.ok(increasing(['Cl', 'S', 'P', 'Si', 'Al', 'Mg', 'Na'], 'covalentRadius'));
});

test('energia de ionização: diminui descendo o grupo; gás nobre é o máximo de cada período', () => {
  assert.ok(increasing(['Cs', 'Rb', 'K', 'Na', 'Li'], 'ionizationEnergy'));
  for (let period = 1; period <= 6; period++) {
    const row = data.elements.filter((e) => e.period === period && e.ionizationEnergy != null);
    const max = row.reduce((a, b) => (b.ionizationEnergy > a.ionizationEnergy ? b : a));
    assert.equal(max.family, 'gas-nobre', `período ${period}: máximo em ${max.symbol}`);
    const min = row.reduce((a, b) => (b.ionizationEnergy < a.ionizationEnergy ? b : a));
    if (period > 1) assert.equal(min.family, 'metal-alcalino', `período ${period}: mínimo em ${min.symbol}`);
  }
});

test('afinidade eletrônica: o cloro tem a maior; halogênios lideram cada período', () => {
  const best = data.elements.filter((e) => e.electronAffinity != null).reduce((a, b) => (b.electronAffinity > a.electronAffinity ? b : a));
  assert.equal(best.symbol, 'Cl');
  for (const [hal, others] of [['F', ['Li', 'B', 'C', 'O']], ['Cl', ['Na', 'Al', 'Si', 'P', 'S']]]) {
    for (const o of others) assert.ok(v(hal, 'electronAffinity') > v(o, 'electronAffinity'), `${hal} > ${o}`);
  }
});

test('os exemplos do glossário batem com os dados', () => {
  assert.equal(Math.round(v('Na', 'ionizationEnergy')), 496);
  assert.equal(Math.round(v('Ne', 'ionizationEnergy')), 2081);
  assert.equal(v('Cs', 'covalentRadius'), 232);
  assert.equal(v('Li', 'covalentRadius'), 133);
  assert.equal(Math.round(v('Cl', 'electronAffinity')), 349);
});
