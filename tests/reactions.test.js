// Correção química da base de reações: TODA reação (e toda equação iônica líquida) precisa
// conservar átomos e carga. Se alguém adicionar uma reação errada em data/reactions.json,
// o teste dela falha com uma mensagem dizendo qual elemento não fecha.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { resolveSide, checkConservation, sideMass, hasMinimalCoefficients } from '../src/core/equation.js';

const data = loadData();
const TYPES = ['sintese', 'decomposicao', 'simples_troca', 'dupla_troca', 'combustao', 'acido_base'];
const STATES = ['s', 'l', 'g', 'aq'];
const SAFETY = ['seguro', 'cuidado', 'perigo'];

test('ids de reação são únicos', () => {
  const ids = data.reactions.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('o verificador detecta equações erradas (sanidade do próprio teste)', () => {
  const sp = (formula, coef) => ({ formula, coef });
  assert.equal(checkConservation([sp('Na', 2), sp('Cl2', 1)], [sp('NaCl', 1)]).ok, false); // desbalanceada
  assert.equal(checkConservation([sp('H+', 1), sp('OH-', 2)], [sp('H2O', 1)]).ok, false); // carga e átomos
  assert.equal(checkConservation([sp('Fe', 1), sp('Cu^2+', 1)], [sp('Fe^3+', 1), sp('Cu', 1)]).ok, false); // só carga
  assert.equal(checkConservation([sp('Na', 2), sp('Cl2', 1)], [sp('NaCl', 2)]).ok, true);
});

for (const r of data.reactions) {
  describe(`reação ${r.id} (${r.name})`, () => {
    const reactants = resolveSide(r.reactants, data.substancesById);
    const products = resolveSide(r.products, data.substancesById);

    test('conserva átomos e carga', () => {
      const res = checkConservation(reactants, products);
      assert.ok(res.ok, `Equação desbalanceada: ${res.problems.join('; ')}`);
    });

    test('coeficientes são os menores inteiros possíveis', () => {
      assert.ok(hasMinimalCoefficients(reactants, products), 'Todos os coeficientes têm um divisor comum: simplifique.');
    });

    test('conserva massa (consequência, mas confere os dados de massa atômica)', () => {
      const l = sideMass(reactants, data.atomicMasses);
      const p = sideMass(products, data.atomicMasses);
      assert.ok(Math.abs(l - p) < 1e-6, `massa reagentes ${l} ≠ produtos ${p}`);
    });

    if (r.netIonic) {
      test('equação iônica líquida conserva átomos e carga', () => {
        const res = checkConservation(r.netIonic.reactants, r.netIonic.products);
        assert.ok(res.ok, `Iônica desbalanceada: ${res.problems.join('; ')}`);
      });
    }

    test('substâncias, estados, tipos e condições existem', () => {
      for (const e of [...r.reactants, ...r.products]) {
        assert.ok(data.substancesById.has(e.id), `substância inexistente: ${e.id}`);
        if (e.state) assert.ok(STATES.includes(e.state), `estado inválido: ${e.state}`);
      }
      for (const sp of [...(r.netIonic?.reactants ?? []), ...(r.netIonic?.products ?? [])]) {
        assert.ok(STATES.includes(sp.state), `estado inválido na iônica: ${sp.formula}`);
      }
      assert.ok(r.types.length > 0 && r.types.every((t) => TYPES.includes(t)), `tipos inválidos: ${r.types}`);
      assert.ok(Array.isArray(r.conditions));
      for (const anyOf of r.conditions) {
        assert.ok(Array.isArray(anyOf) && anyOf.length > 0, 'cada condição deve ser uma lista (alternativas)');
        for (const id of anyOf) assert.ok(data.itemsById.has(id), `ferramenta inexistente: ${id}`);
      }
      const ids = r.reactants.map((e) => e.id);
      assert.equal(new Set(ids).size, ids.length, 'reagente repetido');
    });

    test('tipo coerente com a forma da equação', () => {
      if (r.types.includes('decomposicao')) assert.equal(r.reactants.length, 1, 'decomposição tem 1 reagente');
      if (r.types.includes('sintese')) assert.equal(r.products.length, 1, 'síntese tem 1 produto');
      if (r.types.includes('combustao')) assert.ok(r.reactants.some((e) => e.id === 'O2'), 'combustão usa O2');
      if (r.types.includes('simples_troca')) {
        const elementais = (side) => side.filter((e) => data.substancesById.get(e.id).elementOf).length;
        assert.ok(elementais(r.reactants) >= 1 && elementais(r.products) >= 1, 'simples troca: um elemento entra e outro sai');
      }
    });

    test('tem explicação, fonte e justificativa', () => {
      assert.ok(r.explanation?.length > 20, 'falta explanation');
      assert.ok(r.why?.length > 20, 'falta why');
      assert.ok(data.sources[r.source?.ref], `fonte desconhecida: ${r.source?.ref}`);
      assert.ok(r.source.topic?.length > 3, 'falta source.topic');
      assert.ok(r.source.justification?.length > 10, 'falta source.justification');
    });

    test('segurança: nível válido e, se houver risco, explica o porquê e o "em casa"', () => {
      assert.ok(SAFETY.includes(r.safety?.level), `safety.level inválido: ${r.safety?.level}`);
      if (r.safety.level !== 'seguro') {
        assert.ok(r.safety.why?.length > 20, 'reação de risco sem explicar o perigo');
        assert.ok(r.safety.home?.length > 10, 'reação de risco sem orientação "em casa"');
      }
    });
  });
}

test('reações com o mesmo conjunto de reagentes diferem nas condições', () => {
  const seen = new Map();
  for (const r of data.reactions) {
    const key = [...r.reactants.map((e) => e.id)].sort().join('+') + '|' + JSON.stringify(r.conditions);
    assert.ok(!seen.has(key), `${r.id} é ambígua com ${seen.get(key)}`);
    seen.set(key, r.id);
  }
});
