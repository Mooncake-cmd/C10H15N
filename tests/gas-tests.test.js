// Testes de identificação de gases: só para gases que existem no jogo, com fonte e página, e a
// reação "faça você mesmo" tem de existir e formar o que o texto promete.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';

const data = loadData();

test('cada teste: gás do jogo, textos, segurança e fonte com página', () => {
  assert.deepEqual(Object.keys(data.gasTests).sort(), ['CO2', 'H2', 'O2']);
  for (const [id, g] of Object.entries(data.gasTests)) {
    assert.equal(data.substancesById.get(id)?.state, 'g', `${id}: não é gás no jogo`);
    for (const k of ['test', 'result', 'why', 'safety']) assert.ok(g[k]?.length > 20, `${id}: ${k}`);
    assert.ok(g.source.length && g.source.every((s) => data.sources[s.ref] && /^\d/.test(s.pages)), `${id}: fonte`);
  }
});

test('as reações citadas existem e fazem o que o texto diz', () => {
  const h2 = data.reactionsById.get(data.gasTests.H2.reaction);
  assert.ok(h2.reactants.some((e) => e.id === 'H2') && h2.products.some((e) => e.id === 'H2O'));
  const co2 = data.reactionsById.get(data.gasTests.CO2.reaction);
  assert.ok(co2.reactants.some((e) => e.id === 'CO2') && co2.reactants.some((e) => e.id === 'Ca(OH)2'));
  assert.ok(co2.products.some((e) => e.id === 'CaCO3'), 'a água de cal turva por formar CaCO3');
  assert.match(data.gasTests.CO2.why, /CaCO3/);
});

test('aparecem em reações que liberam esses gases', () => {
  const releases = (gas) => data.reactions.filter((r) => r.products.some((e) => e.id === gas));
  assert.ok(releases('O2').some((r) => r.id === 'h2o2-decomposicao'));
  assert.ok(releases('H2').some((r) => r.id === 'zn-hcl'));
  assert.ok(releases('CO2').some((r) => r.id === 'caco3-hcl'));
});
