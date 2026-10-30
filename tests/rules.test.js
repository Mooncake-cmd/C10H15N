// Motor de regras (Fase 2).
//  1. Exemplos do livro (Atkins & Jones) e casos em que a química real foge da regra simples.
//  2. Coerência com a base curada: onde a regra se aplica a uma reação curada, ela tem de dar
//     exatamente os mesmos produtos e coeficientes; e nunca pode contradizer uma não-reação curada.
//  3. Varredura de TODOS os pares de substâncias (e substâncias sozinhas): toda equação gerada
//     passa pelas mesmas verificações das curadas (átomos, carga, coeficientes mínimos, estados,
//     equação iônica, segurança, fonte, desenho para a animação).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { createEngine, rulesFor, lookupReaction } from '../src/core/engine.js';
import { resolveSide, checkConservation, hasMinimalCoefficients } from '../src/core/equation.js';
import { layoutSide, pairAtoms } from '../src/core/structure.js';

const data = loadData();
const engine = createEngine(data);
const rules = rulesFor(data);
const ALL_ITEMS = data.items.map((i) => i.id);
const combine = (...ids) => engine.combine([...ids, ...ALL_ITEMS]);
const eq = (r) => [r.reactants.map((e) => `${e.coef} ${e.id}(${e.state})`).join(' + '), r.products.map((e) => `${e.coef} ${e.id}(${e.state})`).join(' + ')].join(' → ');

const reactionOf = (...ids) => {
  const r = combine(...ids);
  assert.equal(r.kind, 'reaction', `${ids.join(' + ')}: esperava reação, veio ${r.kind} (${r.title ?? ''})`);
  return r.reaction;
};
const reasonOf = (...ids) => combine(...ids).reasonId;

test('precipitação (seções I.2–I.4): produtos, estados e equação iônica', () => {
  const r = reactionOf('BaCl2', 'Na2SO4');
  assert.equal(eq(r), '1 BaCl2(aq) + 1 Na2SO4(aq) → 1 BaSO4(s) + 2 NaCl(aq)');
  assert.deepEqual(r.netIonic.reactants.map((x) => `${x.coef} ${x.formula}`), ['1 Ba^2+', '1 SO4^2-']);
  assert.deepEqual(r.netIonic.products.map((x) => `${x.coef} ${x.formula}`), ['1 BaSO4']);
  assert.equal(eq(reactionOf('CuSO4', 'NaOH')), '1 CuSO4(aq) + 2 NaOH(aq) → 1 Cu(OH)2(s) + 1 Na2SO4(aq)');
  assert.equal(eq(reactionOf('Na2CO3', 'CaCl2')), '1 Na2CO3(aq) + 1 CaCl2(aq) → 1 NaCl(aq) + 1 CaCO3(s)'.replace('1 NaCl', '2 NaCl'));
  assert.equal(eq(reactionOf('H2SO4', 'Ba(NO3)2')), '1 H2SO4(aq) + 1 Ba(NO3)2(aq) → 2 HNO3(aq) + 1 BaSO4(s)');
  // água de cal + carbonato de sódio (amaciamento da água, seção 15.8)
  assert.ok(reactionOf('Ca(OH)2', 'Na2CO3').products.some((p) => p.id === 'CaCO3' && p.state === 's'));
});

test('sem precipitado, íon em comum, pouco solúvel', () => {
  assert.equal(reasonOf('NaCl', 'KNO3'), 'rule:sem-precipitado');
  assert.equal(reasonOf('HCl', 'NaNO3'), 'rule:sem-precipitado');
  assert.equal(reasonOf('NaCl', 'KCl'), 'rule:mesmo-ion');
  assert.equal(combine('CaCl2', 'NaOH').kind, 'unknown'); // Ca(OH)2 é pouco solúvel
  assert.equal(reasonOf('CaCl2', 'NaOH'), 'rule:pouco-soluvel');
  assert.equal(reasonOf('H2SO4', 'AgNO3'), 'rule:pouco-soluvel'); // Ag2SO4
});

test('anomalias: o composto "da troca" não é o que se forma', () => {
  assert.equal(reasonOf('AgNO3', 'KOH'), 'rule:anomalia'); // forma Ag2O
  assert.equal(combine('AgNO3', 'KOH').source?.pages, '389', 'a exceção cita a página do livro');
  assert.equal(combine('AgNO3', 'NaOH').reaction?.id, 'agno3-naoh', 'com NaOH é a reação curada do livro (p. 389)');
  assert.equal(reasonOf('NH4Cl', 'NaOH'), 'rule:anomalia'); // forma NH3
  assert.equal(reasonOf('CuSO4', 'Na2CO3'), 'rule:anomalia'); // carbonato básico
  assert.equal(combine('CaCO3', 'NaCl').reasonId, 'rule:reagente-insoluvel');
});

test('ácido + base, óxido e carbonato (seções J.3 e 11.3)', () => {
  assert.equal(eq(reactionOf('HNO3', 'KOH')), '1 HNO3(aq) + 1 KOH(aq) → 1 KNO3(aq) + 1 H2O(l)');
  assert.equal(eq(reactionOf('H2SO4', 'NaOH')), '1 H2SO4(aq) + 2 NaOH(aq) → 1 Na2SO4(aq) + 2 H2O(l)');
  assert.equal(eq(reactionOf('MgO', 'HCl')), '1 MgO(s) + 2 HCl(aq) → 1 MgCl2(aq) + 1 H2O(l)'); // p. 428
  assert.equal(eq(reactionOf('Al2O3', 'HCl')), '1 Al2O3(s) + 6 HCl(aq) → 2 AlCl3(aq) + 3 H2O(l)'); // p. 429
  assert.equal(eq(reactionOf('Na2CO3', 'HCl')), '1 Na2CO3(aq) + 2 HCl(aq) → 2 NaCl(aq) + 1 H2O(l) + 1 CO2(g)');
  assert.equal(eq(reactionOf('NH3', 'HNO3')), '1 NH3(g) + 1 HNO3(aq) → 1 NH4NO3(aq)');
  assert.equal(eq(reactionOf('NaOH', 'CO2')), '2 NaOH(aq) + 1 CO2(g) → 1 Na2CO3(aq) + 1 H2O(l)'); // p. 428
  assert.equal(reasonOf('CuO', 'CH3COOH'), 'rule:oxido-acido-fraco');
  assert.equal(reasonOf('HCl', 'CH3COOH'), 'rule:dois-acidos');
  assert.equal(reasonOf('HNO3', 'HCl'), 'rule:agua-regia');
  assert.equal(reasonOf('NaOH', 'KOH'), 'rule:duas-bases');
  assert.equal(reasonOf('Al(OH)3', 'NaOH'), 'rule:anfotero');
});

test('metais: série eletroquímica (seção 13.7) e as exceções', () => {
  assert.equal(eq(reactionOf('Mg', 'CuSO4')), '1 Mg(s) + 1 CuSO4(aq) → 1 MgSO4(aq) + 1 Cu(s)'); // ex. da p. F84
  assert.equal(eq(reactionOf('Al', 'HCl')), '2 Al(s) + 6 HCl(aq) → 2 AlCl3(aq) + 3 H2(g)');
  assert.equal(eq(reactionOf('Cu', 'AgNO3')), '1 Cu(s) + 2 AgNO3(aq) → 1 Cu(NO3)2(aq) + 2 Ag(s)');
  assert.equal(reactionOf('K', 'HCl').safety.level, 'perigo');
  assert.equal(reasonOf('Zn', 'HNO3'), 'rule:acido-oxidante'); // produtos dependem da concentração
  assert.equal(combine('Cu', 'HNO3').reaction?.id, 'cu-hno3'); // o caso do livro (p. 519) é curado
  assert.equal(reasonOf('Al', 'CH3COOH'), 'rule:acido-fraco-metal'); // película de óxido
  assert.equal(reasonOf('Zn', 'NaOH'), 'rule:metal-anfotero-base'); // não é "não reage"!
  assert.equal(reasonOf('Be', 'NaOH'), 'rule:metal-anfotero-base'); // p. 626
  assert.equal(rules.evaluate(['Cu', 'H2O']).outcome.reasonId, 'rule:metal-nobre-agua'); // também é curada (nr-cu-h2o)
  assert.equal(reasonOf('Ca', 'CuSO4'), 'rule:reage-com-agua');
  assert.equal(reasonOf('Mg', 'CuSO4') ?? 'reação', 'reação', 'Mg não está na lista do livro de metais que atacam a água fria');
  assert.equal(reasonOf('Mg', 'Al2(SO4)3'), 'rule:nao-deposita'); // Al não se deposita de solução aquosa
  assert.notEqual(combine('Be', 'HCl').reasonId, 'rule:anomalia');
});

test('óxidos + água, combustão e decomposição', () => {
  assert.equal(eq(reactionOf('BaO', 'H2O')), '1 BaO(s) + 1 H2O(l) → 1 Ba(OH)2(aq)');
  assert.equal(reasonOf('CuO', 'H2O'), 'rule:oxido-insoluvel');
  assert.equal(reasonOf('Na2O2', 'H2O'), 'rule:peroxido-agua');
  assert.notEqual(combine('CH3COOH', 'O2').kind, 'reaction', 'o CH3COOH do jogo é vinagre: não queima');
  assert.equal(eq(reactionOf('MgCO3', 'calor')), '1 MgCO3(s) → 1 MgO(s) + 1 CO2(g)');
  assert.equal(engine.combine(['MgCO3']).kind, 'needs-condition');
  assert.equal(reasonOf('Na2CO3'), 'rule:decomposicao-alta');
});

test('coerência: onde a regra se aplica a uma reação curada, dá o mesmo resultado', () => {
  let reproduced = 0;
  for (const r of data.reactions) {
    const got = rules.evaluate(r.reactants.map((e) => e.id), ALL_ITEMS);
    if (!got) continue;
    assert.ok(!got.outcome || got.outcome.kind !== 'no-reaction', `${r.id}: a regra diz que não reage, mas a base curada tem a reação`);
    if (!got.reaction) continue;
    const norm = (side) => side.map((e) => `${e.coef} ${e.id}`).sort();
    assert.deepEqual(norm(got.reaction.products), norm(r.products), `${r.id}: regra ≠ curada`);
    assert.deepEqual(norm(got.reaction.reactants), norm(r.reactants), `${r.id}: coeficientes diferentes`);
    reproduced++;
  }
  assert.ok(reproduced >= 12, `só ${reproduced} reações curadas reproduzidas pelas regras`);
});

test('as regras nunca geram reação para uma não-reação curada', () => {
  for (const nr of data.nonReactions) {
    const got = rules.evaluate(nr.substances, ALL_ITEMS);
    assert.ok(!got?.reaction, `${nr.id}: regra gerou ${got?.reaction?.id}`);
  }
});

// ---------- Varredura de todos os pares ----------
const subs = data.substances.map((s) => s.id);
const generated = new Map();
const outcomes = [];
for (let i = 0; i < subs.length; i++) {
  for (let j = i; j < subs.length; j++) {
    const ids = i === j ? [subs[i]] : [subs[i], subs[j]];
    const got = rules.evaluate(ids, ALL_ITEMS);
    if (got?.reaction) generated.set(got.reaction.id, got.reaction);
    if (got?.outcome) outcomes.push([ids, got.outcome]);
  }
}

test(`varredura: as regras geram muitas reações (${generated.size}) e explicações (${outcomes.length})`, () => {
  assert.ok(generated.size > 150);
  assert.ok(outcomes.length > 150);
});

test('varredura: toda reação gerada é química válida e completa', () => {
  const TYPES = ['sintese', 'decomposicao', 'simples_troca', 'dupla_troca', 'combustao', 'acido_base', 'oxirreducao'];
  for (const r of generated.values()) {
    const L = resolveSide(r.reactants, data.substancesById);
    const P = resolveSide(r.products, data.substancesById);
    const c = checkConservation(L, P);
    assert.ok(c.ok, `${r.id}: ${c.problems.join('; ')}`);
    assert.ok(hasMinimalCoefficients(L, P), `${r.id}: coeficientes não simplificados`);
    if (r.netIonic) {
      const n = checkConservation(r.netIonic.reactants, r.netIonic.products);
      assert.ok(n.ok, `${r.id} (iônica): ${n.problems.join('; ')}`);
    }
    for (const e of [...r.reactants, ...r.products]) assert.ok(['s', 'l', 'g', 'aq'].includes(e.state), `${r.id}: estado ${e.state}`);
    assert.ok(r.types.every((t) => TYPES.includes(t)), r.id);
    assert.ok(r.name && r.explanation.length > 20 && r.why.length > 20, `${r.id}: textos`);
    assert.ok(!/\{\w+\}/.test(r.name + r.explanation + r.why + r.safety.why), `${r.id}: marcador sem preencher`);
    assert.ok(data.sources[r.source.ref] && r.source.topic && r.source.pages, `${r.id}: fonte`);
    assert.ok(['seguro', 'cuidado', 'perigo'].includes(r.safety.level) && r.safety.why && r.safety.home, `${r.id}: segurança`);
    const match = pairAtoms(layoutSide(r.reactants, data).atoms, layoutSide(r.products, data).atoms);
    assert.ok(match.every((m) => m !== null), `${r.id}: animação sem par de átomos`);
    assert.equal(lookupReaction(data, r.id)?.id, r.id, `${r.id}: não pode ser recuperada pelo id (progresso salvo)`);
  }
});

test('varredura: toda explicação de regra é completa', () => {
  for (const [ids, o] of outcomes) {
    assert.ok(['no-reaction', 'unknown'].includes(o.kind), ids.join('+'));
    assert.ok(o.title && o.reason.length > 40, `${ids.join('+')}: texto`);
    assert.ok(!/\{\w+\}/.test(o.title + o.reason), `${ids.join('+')}: marcador sem preencher (${o.title})`);
    if (o.kind === 'no-reaction') assert.ok(data.sources[o.source?.ref], `${ids.join('+')}: "não reage" precisa de fonte`);
  }
});

test('bicarbonato é anfiprótico: com OH⁻ forma carbonato (p. 627)', () => {
  assert.equal(eq(reactionOf('NaHCO3', 'NaOH')), '1 NaHCO3(aq) + 1 NaOH(aq) → 1 Na2CO3(aq) + 1 H2O(l)');
  assert.equal(combine('NaHCO3', 'KOH').kind, 'unknown');
});

test('metal alcalino + cloro (seção 15.5) e exceções com fonte', () => {
  assert.equal(eq(reactionOf('K', 'Cl2')), '2 K(s) + 1 Cl2(g) → 2 KCl(s)');
  assert.equal(eq(reactionOf('Cs', 'Cl2')), '2 Cs(s) + 1 Cl2(g) → 2 CsCl(s)');
  assert.notEqual(combine('Fe', 'Cl2').kind, 'reaction', 'Fe + Cl2 não tem regra (o produto depende)');
  assert.equal(combine('CuSO4', 'Na2CO3').source?.pages, '677–678');
  assert.equal(combine('NH4Cl', 'KOH').source?.pages, '425, 436');
});
