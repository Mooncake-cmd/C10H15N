// Velocidade das reações (Fase 3B): dados transcritos das Tabelas 14.1 e 14.4 de Atkins & Jones
// têm de ser coerentes entre si, as equações têm de conservar átomos e cargas, e as contas têm de
// reproduzir os exemplos resolvidos do livro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { parseFormula } from '../src/core/formula.js';
import { arrheniusK, kRatio, fitArrhenius, kAt, concentrationAt, halfLife, simulate, activationEnergy, tempRange } from '../src/core/kinetics.js';
import { lookupReaction } from '../src/core/engine.js';

const data = loadData();
const K = data.kinetics;
const near = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${msg}: ${a} vs ${b}`);

test('cada reação tem fonte com página, lei de velocidade e dado de k', () => {
  assert.ok(K.reactions.length >= 10);
  assert.equal(new Set(K.reactions.map((r) => r.id)).size, K.reactions.length);
  for (const r of K.reactions) {
    assert.ok(r.source.length && r.source.every((s) => data.sources[s.ref] && /^\d/.test(s.pages)), `${r.id}: fonte`);
    assert.ok([1, 2].includes(r.order) && r.rateLaw && r.kUnit, `${r.id}: lei`);
    assert.ok(r.points?.length || r.arrhenius, `${r.id}: sem k nem Arrhenius`);
    assert.equal(r.kUnit, r.order === 1 ? 's⁻¹' : 'L·mol⁻¹·s⁻¹', `${r.id}: unidade de k não bate com a ordem`);
    const [lo, hi] = tempRange(r);
    assert.ok(lo <= hi && lo >= 200 && hi <= 1200, `${r.id}: faixa`);
    for (const [T, k] of r.points ?? []) assert.ok(T >= lo && T <= hi && k > 0, `${r.id}: ponto fora da faixa`);
    assert.ok(r.about.length > 40, `${r.id}: texto`);
  }
});

test('equações conservam átomos e carga', () => {
  for (const r of K.reactions) {
    const sum = (side) => {
      const atoms = {};
      let charge = 0;
      for (const { formula, coef } of side) {
        const p = parseFormula(formula);
        for (const [el, n] of Object.entries(p.atoms)) atoms[el] = (atoms[el] ?? 0) + coef * n;
        charge += coef * p.charge;
      }
      return { atoms, charge };
    };
    const a = sum(r.reactants);
    const b = sum(r.products);
    assert.deepEqual(a.atoms, b.atoms, `${r.id}: átomos`);
    assert.equal(a.charge, b.charge, `${r.id}: carga`);
  }
});

test('Tabela 14.1 × Tabela 14.4: o k medido bate com A·e^(−Ea/RT) (pega erro de transcrição)', () => {
  let n = 0;
  for (const r of K.reactions) {
    if (!r.arrhenius || !r.points) continue;
    for (const [T, k] of r.points) {
      near(arrheniusK(r.arrhenius.A, r.arrhenius.Ea, T), k, 0.3, `${r.id} a ${T} K`);
      n++;
    }
  }
  assert.ok(n >= 6, `só ${n} comparações`);
});

test('reta de Arrhenius pelos pontos do N2O5 dá a Ea da Tabela 14.4 (103 kJ/mol)', () => {
  const r = K.byId.get('n2o5');
  near(fitArrhenius(r.points).Ea, 103, 0.03, 'Ea do N2O5');
  // Os pontos de cada reação da Tabela 14.1 caem numa reta (comportamento de Arrhenius, p. 589).
  for (const e of K.reactions.filter((x) => (x.points ?? []).length >= 3)) {
    const fit = fitArrhenius(e.points);
    for (const [T, k] of e.points) near(arrheniusK(fit.A, fit.Ea, T), k, 0.35, `${e.id}: ${T} K fora da reta`);
    assert.ok(fit.Ea > 50 && fit.Ea < 300, `${e.id}: Ea ${fit.Ea}`);
  }
});

test('exemplo do livro (p. 573): N2O5 a 65 °C, 0,040 mol/L → 1,8 mmol/L depois de 600 s', () => {
  const r = K.byId.get('n2o5');
  const k = kAt(r, 338).k;
  assert.equal(k, 5.2e-3);
  near(concentrationAt(1, k, 0.04, 600), 0.0018, 0.03, '[N2O5]');
  near(halfLife(1, k), 133, 0.01, 't½');
});

test('meia-vida: 1ª ordem não depende de [A]₀; 2ª ordem dobra se [A]₀ cai pela metade', () => {
  assert.equal(halfLife(1, 0.01, 1), halfLife(1, 0.01, 0.1));
  near(halfLife(2, 0.5, 0.05), 2 * halfLife(2, 0.5, 0.1), 1e-12, '2ª ordem');
  // Depois de uma meia-vida, sobra metade, nas duas ordens.
  for (const order of [1, 2]) {
    const t = halfLife(order, 0.3, 0.2);
    near(concentrationAt(order, 0.3, 0.2, t), 0.1, 1e-9, `ordem ${order}`);
  }
});

test('temperatura: k cresce com T, e Ea maior = mais sensível à temperatura', () => {
  for (const r of K.reactions) {
    const [lo, hi] = tempRange(r);
    if (hi > lo) assert.ok(kAt(r, hi).k > kAt(r, lo).k, `${r.id}: k não cresce com T`);
  }
  assert.ok(kRatio(160, 300, 310) > kRatio(38, 300, 310));
  // "+10 °C costuma dobrar a velocidade" vale para Ea ≈ 50 kJ/mol perto de 25 °C (p. 587).
  near(kRatio(53, 298, 308), 2, 0.05, 'regra dos 10 °C');
});

test('nunca extrapola: fora da faixa medida não há k', () => {
  assert.equal(kAt(K.byId.get('n2o5'), 400), null);
  assert.equal(kAt(K.byId.get('h3o-oh'), 310), null);
  assert.equal(simulate(K.byId.get('hi'), { T: 300, A0: 0.1 }), null);
});

test('sacarose: o ácido é catalisador — k efetivo proporcional a [H3O⁺]', () => {
  const r = K.byId.get('sacarose');
  const a = simulate(r, { T: 298, A0: 0.1, fixed: 0.1 });
  const b = simulate(r, { T: 298, A0: 0.1, fixed: 0.2 });
  assert.equal(a.order, 1);
  near(b.kEff, 2 * a.kEff, 1e-12, 'dobrar o ácido dobra k');
  near(a.halfLife, 2 * b.halfLife, 1e-12, 'e corta a meia-vida pela metade');
});

test('ligações com o jogo apontam para reações que existem', () => {
  for (const [rid, g] of Object.entries(K.game)) {
    assert.ok(lookupReaction(data, rid), `${rid}: reação do jogo inexistente`);
    if (g.kinetics) assert.ok(K.byId.has(g.kinetics), `${rid}: ${g.kinetics}`);
    if (g.catalysis) assert.ok(lookupReaction(data, rid).conditions.flat().includes('catalisador'), `${rid}: não usa catalisador no jogo`);
    assert.ok(data.sources[g.source.ref] && g.source.pages && g.note.length > 40, `${rid}: fonte/nota`);
  }
  // Toda reação do jogo que exige catalisador tem a explicação ligada.
  for (const r of data.reactions.filter((x) => (x.conditions ?? []).flat().includes('catalisador'))) {
    assert.ok(K.game[r.id]?.catalysis, `${r.id}: usa catalisador, mas não tem a nota de catálise`);
  }
});

test('Ea usada pelo jogo', () => {
  assert.deepEqual(activationEnergy(K.byId.get('n2o5')), { Ea: 103, how: 'livro' });
  assert.equal(activationEnergy(K.byId.get('hi')).how, 'reta');
  assert.equal(activationEnergy(K.byId.get('h3o-oh')), null);
});

test('reações geradas: toda neutralização ácido forte + base forte liga-se a H3O⁺ + OH⁻', async () => {
  const { rulesFor } = await import('../src/core/engine.js');
  const { kineticsLink } = await import('../src/core/kinetics.js');
  const rules = rulesFor(data);
  let n = 0;
  for (const acid of ['HCl', 'HNO3', 'H2SO4']) {
    for (const base of ['NaOH', 'KOH', 'LiOH']) {
      const r = data.reactionsById.get(`${acid.toLowerCase()}-${base.toLowerCase()}`) ?? rules.evaluate([acid, base], [])?.reaction;
      assert.ok(r, `${acid} + ${base}`);
      assert.equal(kineticsLink(r, data)?.kinetics, 'h3o-oh', `${r.id}`);
      n++;
    }
  }
  assert.equal(n, 9);
  // Ácido fraco não: a etapa medida é outra.
  assert.equal(kineticsLink(rules.evaluate(['CH3COOH', 'NaOH'], []).reaction, data), null);
  assert.equal(kineticsLink(rules.evaluate(['CO2', 'NaOH'], []).reaction, data)?.kinetics, 'co2-oh');
});

test('respostas dos objetivos do nível 14', async () => {
  const { kineticsAnswer } = await import('../src/core/kinetics.js');
  const obj = Object.fromEntries(data.progression.levels.flatMap((l) => l.objectives).map((o) => [o.id, o]));
  near(kineticsAnswer(obj['n13-meia-vida'], K), 133.3, 0.005, 't½ N2O5');
  near(kineticsAnswer(obj['n13-exemplo'], K), 1.77, 0.01, 'mmol/L');
  near(kineticsAnswer(obj['n13-temperatura'], K), 3.86, 0.01, 'k35/k25');
  near(kineticsAnswer(obj['n13-segunda-ordem'], K), 5556, 0.001, 't½ HI');
});
