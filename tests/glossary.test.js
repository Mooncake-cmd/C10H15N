// Glossário: dados completos, termos encontrados do jeito certo nos textos e cobertura dos
// conceitos que o jogo usa.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { formsOf } from '../src/core/glossary.js';

const data = loadData();
const g = data.glossary;
const ids = (text) => g.find(text).map((m) => m.id);

test('verbetes completos, com fonte e relacionados válidos', () => {
  assert.ok(g.terms.length >= 80, `só ${g.terms.length} termos`);
  assert.equal(new Set(g.terms.map((t) => t.id)).size, g.terms.length, 'id repetido');
  for (const t of g.terms) {
    assert.ok(t.term && t.definition.length >= 40 && t.example?.length > 5, `${t.id}: texto`);
    assert.ok(data.sources[t.source?.ref] && t.source.topic && t.source.pages, `${t.id}: fonte`);
    assert.match(t.source.pages, /^(B\d+|F\d+|\d+)/, `${t.id}: página`);
    assert.ok(formsOf(t).length > 0, `${t.id}: nenhuma forma para achar no texto`);
    for (const r of t.related ?? []) {
      assert.ok(g.byId.has(r), `${t.id}: relacionado inexistente ${r}`);
      assert.notEqual(r, t.id);
    }
  }
});

test('nenhuma forma pertence a dois termos', () => {
  const seen = new Map();
  for (const t of g.terms) {
    for (const f of formsOf(t)) {
      assert.ok(!seen.has(f), `"${f}" está em ${seen.get(f)} e em ${t.id}`);
      seen.set(f, t.id);
    }
  }
});

test('acha termos: forma mais longa, plural, maiúsculas, acentos', () => {
  assert.deepEqual(ids('Ácidos fortes se separam em íons.'), ['acido-forte', 'ion']);
  assert.deepEqual(ids('O íon espectador fica na solução aquosa.'), ['ion-espectador', 'solucao-aquosa']);
  assert.deepEqual(ids('Os metais alcalinos têm 1 elétron de valência.'), ['metal-alcalino', 'eletrons-de-valencia']);
  assert.deepEqual(ids('Pela série de reatividade, o zinco desloca o cobre.'), ['serie-eletroquimica', 'simples-troca']);
  assert.deepEqual(ids('pH'), ['ph']);
});

test('não acha dentro de outras palavras nem em sentidos não químicos', () => {
  assert.deepEqual(ids('um gosto salgado'), []); // "sal"
  assert.deepEqual(ids('uma molécula'), ['molecula']); // e não "mol"
  assert.deepEqual(ids('Essa reação ainda não está na base.'), ['reacao-quimica']); // "base" = base de dados
  assert.deepEqual(ids('O hidróxido de sódio é uma base forte.'), ['hidroxido', 'base-forte']);
  assert.deepEqual(ids('produtos de limpeza'), []);
  assert.deepEqual(ids('baterias alcalinas'), []);
});

test('os textos do jogo usam o glossário', () => {
  // Toda introdução e lição de nível tem pelo menos um termo explicável.
  for (const l of data.progression.levels) {
    assert.ok(ids(`${l.intro} ${l.lesson}`).length > 0, `${l.id}: nenhum termo do glossário`);
  }
  // Os conceitos centrais aparecem em algum texto do jogo (níveis, reações, regras).
  const all = [
    ...data.progression.levels.flatMap((l) => [l.intro, l.lesson, ...l.objectives.flatMap((o) => [o.text, o.hint ?? ''])]),
    ...data.reactions.flatMap((r) => [r.explanation, r.why]),
    ...data.nonReactions.map((n) => n.reason),
    ...Object.values(data.rules.rules).flatMap((r) => [r.explanation, r.why]),
    ...Object.values(data.rules.outcomes).map((o) => o.reason),
  ].join(' \n ');
  const used = new Set(ids(all));
  for (const id of ['atomo', 'ion', 'cation', 'anion', 'eletron', 'acido', 'base', 'sal', 'precipitado', 'reagente', 'produto', 'equacao-quimica', 'oxidacao', 'mol', 'massa-molar', 'reagente-limitante', 'catalisador', 'energia-de-ativacao', 'serie-eletroquimica', 'grupo']) {
    assert.ok(used.has(id), `o conceito ${id} não aparece em nenhum texto do jogo`);
  }
});

test('verbo "misturar" não vira o substantivo "mistura"', () => {
  assert.deepEqual(ids('Quando você mistura duas soluções'), ['solucao']);
  assert.deepEqual(ids('É só uma mistura.'), ['mistura']);
});
