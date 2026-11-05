// Laboratório: utensílios, separação de misturas e teste de chama.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { separate, flameTest, sourcesOf } from '../src/core/lab.js';
import { cellPotential } from '../src/core/missions.js';

const data = loadData();
const L = data.lab;
const okSource = (s, what) => {
  assert.ok(data.sources[s.ref], `${what}: fonte ${s.ref}`);
  assert.ok(!data.complementarySources.includes(s.ref), `${what}: fonte de divulgação não vale`);
  assert.ok(s.topic && s.pages, `${what}: tópico e página`);
};

test('utensílios: dados completos e com fonte', () => {
  const groups = ['conter', 'medir', 'separar', 'aquecer', 'apoio'];
  assert.ok(L.glassware.length >= 15);
  for (const g of L.glassware) {
    assert.ok(g.name && g.use && groups.includes(g.group), g.id);
    okSource(g.source, g.id);
  }
  // Os instrumentos de medida exata e os graduados existem (as missões perguntam sobre eles).
  assert.equal(L.glasswareById.get('pipeta-volumetrica').precision, 'exata');
  assert.equal(L.glasswareById.get('bequer').precision, 'aproximada');
});

test('métodos: utensílios existentes, princípio, fonte e explicação de falha', () => {
  for (const m of L.methods) {
    assert.ok(m.name && m.icon && m.principle && m.failWhy.default, m.id);
    for (const g of m.glassware) assert.ok(L.glasswareById.has(g), `${m.id}: utensílio ${g}`);
    okSource(m.source, m.id);
  }
});

test('separação: toda combinação mistura × método tem resposta explicada', () => {
  for (const mix of L.mixtures) {
    for (const s of sourcesOf(mix)) okSource(s, mix.id);
    for (const [method, r] of Object.entries(mix.ok)) {
      assert.ok(L.methodsById.has(method), `${mix.id}: método ${method}`);
      assert.ok(r.text && r.obtains, `${mix.id}/${method}: resultado`);
      if (r.next) assert.ok(L.mixturesById.has(r.next), `${mix.id}: próxima mistura ${r.next}`);
    }
    for (const m of L.methods) {
      const r = separate(mix.id, m.id, L);
      assert.ok(r.text && r.text.length > 20, `${mix.id} × ${m.id}: sem explicação`);
      assert.equal(r.ok, !!mix.ok[m.id]);
    }
  }
  // Uma substância (composto) não se separa por métodos físicos.
  const fes = L.mixturesById.get('sulfeto-de-ferro');
  assert.equal(fes.type, 'substancia');
  assert.ok(L.methods.every((m) => !separate('sulfeto-de-ferro', m.id, L).ok));
});

test('separação: a química de cada caso', () => {
  // Filtração não tira o que está dissolvido; destilação tira; evaporação perde a água.
  assert.equal(separate('agua-salgada', 'filtracao', L).ok, false);
  assert.ok(separate('agua-salgada', 'destilacao-simples', L).ok);
  assert.match(separate('agua-salgada', 'evaporacao', L).obtains, /perde/);
  // Filtrar a água barrenta deixa água salgada (os sais passam pelo filtro).
  assert.equal(separate('agua-barrenta', 'filtracao', L).next, 'agua-salgada');
  // Imiscíveis: funil; miscíveis: destilação fracionada; o ímã só no ferro + enxofre.
  assert.ok(separate('agua-oleo', 'funil-separacao', L).ok);
  assert.equal(separate('agua-oleo', 'filtracao', L).ok, false);
  assert.ok(separate('agua-alcool', 'destilacao-fracionada', L).ok);
  assert.ok(separate('ferro-enxofre', 'separacao-magnetica', L).ok);
  assert.ok(L.mixtures.filter((m) => m.id !== 'ferro-enxofre').every((m) => !separate(m.id, 'separacao-magnetica', L).ok));
});

test('teste de chama: cores com fonte, pelo cátion do sal', () => {
  for (const [el, f] of Object.entries(L.flame)) {
    okSource(f.source, `chama ${el}`);
    assert.ok(f.text, el);
    assert.equal(f.color === null, f.css === null, `${el}: cor e css juntos`);
  }
  assert.equal(flameTest('NaCl', data).element, 'Na');
  assert.match(flameTest('NaCl', data).color, /amarela/);
  assert.equal(flameTest('SrCl2', data).element, 'Sr');
  assert.equal(flameTest('BaCl2', data).element, 'Ba');
  assert.equal(flameTest('CaCl2', data).element, 'Ca');
  assert.equal(flameTest('HCl', data).color, null, 'o HCl não dá cor');
  assert.equal(flameTest('KCl', data).element, 'K');
  assert.match(flameTest('CuSO4', data).color, /^verde$/);
  assert.match(flameTest('CuCl2', data).color, /verde-azulada/, 'haleto de cobre: verde-azulado');
  assert.equal(flameTest('ZnCl2', data), null, 'sem fonte para o zinco: o jogo não inventa a cor');
  for (const s of L.flameSource) okSource(s, 'chama');
});

test('pilha de Daniell: 1,10 V pelos potenciais-padrão', () => {
  const e = cellPotential({ cathode: 'Cu', anode: 'Zn' }, data);
  assert.ok(Math.abs(e.E - 1.1) < 1e-9, `${e.E}`);
});
