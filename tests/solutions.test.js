// Concentração, diluição e mistura de soluções (Atkins & Jones, seção G; Bernoulli v. 5, Módulos 09–10).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertConcentration, dilution, mixSameSolute } from '../src/core/solutions.js';

const near = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${msg}: ${a} vs ${b}`);

test('Exemplo G.4 (p. F57): 250 mL de NaOH 1,25 × 10⁻³ M a partir de estoque 0,0380 M → 8,22 mL', () => {
  const d = dilution({ c1: 0.038, c2: 1.25e-3, V2: 250 });
  near(d.V1, 8.22, 0.002, 'V1');
  near(d.water, 250 - 8.22, 0.001, 'água');
  near(d.c1 * d.V1, d.c2 * d.V2, 1e-12, 'n conservado');
});

test('diluição: resolve qualquer incógnita, e não aceita "diluir" para uma concentração maior', () => {
  near(dilution({ c1: 2, V1: 50, V2: 200 }).c2, 0.5, 1e-12, 'c2');
  near(dilution({ V1: 10, c2: 0.1, V2: 100 }).c1, 1, 1e-12, 'c1');
  assert.equal(dilution({ c1: 1, V1: 10 }), null); // faltam dois
  assert.equal(dilution({ c1: 0.1, V1: 10, c2: 0.5 }).impossible, true);
});

test('conversões: mol/L ↔ g/L ↔ mg/L (≈ ppm) ↔ % (m/V)', () => {
  const c = convertConcentration(0.1, 'mol/L', 58.44); // NaCl 0,10 mol/L
  near(c['g/L'], 5.844, 1e-9, 'g/L');
  near(c['mg/L'], 5844, 1e-9, 'mg/L');
  near(c['% (m/V)'], 0.5844, 1e-9, '%');
  near(convertConcentration(0.358, 'g/L', 205.17)['mg/L'], 358, 1e-9, 'sacarina do rótulo (Bernoulli v. 5, p. 3)');
  assert.equal(convertConcentration(-1, 'g/L', 10), null);
});

test('mistura do mesmo soluto: a quantidade se soma, os volumes também', () => {
  const m = mixSameSolute([{ c: 1, V: 100 }, { c: 0.5, V: 300 }]);
  near(m.c, 0.625, 1e-12, 'c final');
  assert.equal(m.V, 400);
  // Fica sempre entre as duas concentrações.
  assert.ok(m.c > 0.5 && m.c < 1);
});
