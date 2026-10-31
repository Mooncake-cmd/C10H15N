// Curiosidades dos elementos (leitura complementar, livro da DK): cobertura dos 118 elementos,
// citação de página, texto em português escrito para o jogo, e conferência de algumas afirmações
// numéricas contra o dataset aberto dos elementos (data/source/).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData, loadRaw } from './helpers.js';

const data = loadData();
const raw = loadRaw().elementFacts;
const F = data.elementFacts;
const texts = (f) => [f.summary, ...f.facts];
const src = JSON.parse(readFileSync(new URL('../data/source/PeriodicTableJSON.json', import.meta.url), 'utf8')).elements;
const bySym = new Map(src.map((e) => [e.symbol, e]));

test('a fonte é o livro da DK, marcado como só complementar', () => {
  assert.equal(raw._meta.ref, 'dk-elements');
  assert.ok(data.sources[raw._meta.ref], 'fonte em sources.json');
  assert.ok(data.complementarySources.includes(raw._meta.ref), 'precisa estar em complementaryOnly');
  assert.ok(raw._meta.corrections.length > 0, 'as correções feitas ao livro ficam registradas');
});

test('todos os 118 elementos, e só eles, têm curiosidades com página', () => {
  const syms = data.elements.map((e) => e.symbol);
  assert.equal(syms.length, 118);
  assert.deepEqual(Object.keys(F).sort(), [...syms].sort());
  for (const [s, f] of Object.entries(F)) {
    assert.ok(Array.isArray(f.pages) && f.pages.length >= 1 && f.pages.length <= 2, `${s}: páginas`);
    for (const p of f.pages) assert.ok(Number.isInteger(p) && p >= 10 && p <= 208, `${s}: página ${p} fora do livro`);
    if (f.pages.length === 2) assert.equal(f.pages[1], f.pages[0] + 1, `${s}: páginas seguidas`);
    assert.ok(f.summary.length >= 40 && f.summary.length <= 360, `${s}: descrição curta`);
    assert.ok(Array.isArray(f.facts) && f.facts.length >= 1 && f.facts.length <= 4, `${s}: 1 a 4 curiosidades`);
    for (const t of f.facts) assert.ok(t.length >= 20 && t.length <= 330, `${s}: curiosidade de tamanho razoável`);
  }
});

test('as páginas seguem a ordem do livro dentro de cada família', () => {
  // O livro é organizado por grupos: dentro de um grupo, Z maior → página maior (ou a mesma).
  const groups = new Map();
  for (const e of data.elements) {
    const k = e.family === 'lantanideo' || e.family === 'actinideo' ? e.family : `g${e.group}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  for (const [k, els] of groups) {
    const pages = els.sort((a, b) => a.Z - b.Z).filter((e) => !(k === 'g1' && e.symbol === 'H')).map((e) => [e.symbol, F[e.symbol].pages[0]]);
    // Os elementos superpesados (Z ≥ 104) do bloco p ficam no fim de cada grupo; os do bloco d, numa seção própria.
    for (let i = 1; i < pages.length; i++) {
      const [s, p] = pages[i];
      const [s0, p0] = pages[i - 1];
      if (data.elementsBySymbol.get(s).Z >= 104 && data.elementsBySymbol.get(s).block === 'd') continue;
      assert.ok(p >= p0, `${k}: ${s} (p. ${p}) antes de ${s0} (p. ${p0})`);
    }
  }
});

test('texto em português, escrito para o jogo (sem trechos em inglês do livro)', () => {
  const english = /(?<!\p{L})(the|and|which|with|this|is|was|of|its)(?!\p{L})/u;
  for (const [s, f] of Object.entries(F)) {
    for (const t of texts(f)) {
      assert.ok(!english.test(t), `${s}: parece inglês: "${t}"`);
      assert.ok(!t.includes('"'), `${s}: use aspas tipográficas`);
      assert.match(t, /[.!?)]$/, `${s}: frase terminada`);
    }
    assert.equal(new Set(texts(f)).size, texts(f).length, `${s}: texto repetido`);
  }
});

test('afirmações numéricas batem com o dataset aberto', () => {
  const K = 273.15;
  const metals = src.filter((e) => /metal|lanthanide|actinide/.test(e.category) && !/nonmetal|metalloid/.test(e.category));
  const max = (arr, k) => arr.filter((e) => e[k] != null).reduce((a, b) => (b[k] > a[k] ? b : a));
  const min = (arr, k) => arr.filter((e) => e[k] != null).reduce((a, b) => (b[k] < a[k] ? b : a));
  assert.ok(F.Li.summary.includes('metal mais leve') && min(metals, 'density').symbol === 'Li', 'Li: metal menos denso');
  assert.ok(F.W.summary.includes('ponto de fusão mais alto') && max(metals, 'melt').symbol === 'W', 'W: maior ponto de fusão entre os metais');
  assert.ok(bySym.get('W').melt - K > 3400, 'W: acima de 3 400 °C');
  const top = (k, n) => src.filter((e) => e[k] != null).sort((a, b) => b[k] - a[k]).slice(0, n).map((e) => e.symbol);
  assert.ok(F.Re.facts[0].includes('mais altos') && top('boil', 3).includes('Re') && top('melt', 3).includes('Re'), 'Re: entre os maiores pontos de fusão e ebulição');
  assert.deepEqual(top('melt', 3).filter((x) => x !== 'Re'), ['C', 'W'], 'Re: só abaixo de C e W na fusão');
  assert.ok(F.Os.summary.includes('mais denso') && max(src.filter((e) => e.number <= 94), 'density').symbol === 'Os', 'Os: o natural mais denso');
  assert.ok(Math.abs(bySym.get('Ga').melt - K - 30) < 1, 'Ga: derrete a cerca de 30 °C');
  assert.ok(Math.abs(bySym.get('Mo').melt - K - 2620) < 10, 'Mo: cerca de 2 620 °C');
  assert.ok(Math.abs(bySym.get('N').boil - K + 196) < 1, 'N2 líquido: cerca de −196 °C');
  // Os dois únicos elementos líquidos à temperatura ambiente.
  assert.deepEqual(src.filter((e) => e.number <= 103 && e.melt != null && e.melt < 298 && e.boil > 298).map((e) => e.symbol).sort(), ['Br', 'Hg']);
  assert.ok(F.Br.summary.includes('dois únicos elementos líquidos'));
});

test('os termos novos do glossário aparecem e são explicados', () => {
  const all = Object.values(F).flatMap(texts).join(' \n ');
  const used = new Set(data.glossary.find(all).map((m) => m.id));
  for (const id of ['radioatividade', 'meia-vida', 'fissao-nuclear', 'reator-nuclear', 'acelerador-de-particulas', 'lantanideo', 'actinideo', 'minerio', 'espectro', 'isotopo', 'liga']) {
    assert.ok(used.has(id), `${id} não aparece nas curiosidades`);
  }
});
