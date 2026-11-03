// Química orgânica (Fase 3E): grupos funcionais, nomes oficiais e isomeria deduzidos das
// estruturas de Lewis têm de bater com os nomes escritos à mão e com os exemplos do livro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { analyzeOrganic, functionalGroups, iupacName, isomerType, organicAnswer, molecularFormula } from '../src/core/organic.js';
import { lewisFor } from '../src/core/vsepr.js';

const data = loadData();
const org = (id) => analyzeOrganic(id, data);

test('o nome deduzido da estrutura é o nome IUPAC escrito para cada substância', () => {
  const named = data.substances.filter((s) => s.iupac);
  assert.ok(named.length >= 18);
  for (const s of named) assert.equal(org(s.id)?.iupac.name, s.iupac, s.id);
});

test('funções orgânicas (Tabela 19.1)', () => {
  const fn = (id) => org(id).fn;
  assert.equal(fn('CH4'), 'alcano');
  assert.equal(fn('C2H4'), 'alceno');
  assert.equal(fn('C2H2'), 'alcino');
  assert.equal(fn('C2H5OH'), 'alcool');
  assert.equal(fn('CH3OCH3'), 'eter');
  assert.equal(fn('CH3CHO'), 'aldeido');
  assert.equal(fn('CH3COCH3'), 'cetona');
  assert.equal(fn('CH3COOH'), 'acido');
  assert.equal(fn('CH3COOC2H5'), 'ester');
  assert.equal(fn('CH3Cl'), 'haleto');
  // O éster não é contado também como álcool, éter ou cetona.
  assert.deepEqual(org('CH3COOC2H5').types, ['ester']);
  assert.deepEqual(org('CH3COOH').types, ['acido']);
});

test('não orgânicos ficam de fora (CO2, ácido carbônico, íons, água)', () => {
  for (const k of ['CO2', 'H2CO3', 'H2O', 'NH3', 'HNO3', 'CH3COO-', 'HCO3-']) assert.equal(analyzeOrganic(k, data), null, k);
});

test('nomes: prefixo + infixo + sufixo, localizadores só quando precisa', () => {
  const name = (id) => org(id).iupac.name;
  assert.equal(name('CH3CH2CH2OH'), 'propan-1-ol');
  assert.equal(name('CH3CH(OH)CH3'), 'propan-2-ol');
  assert.equal(name('CH3COCH3'), 'propanona'); // a cetona de 3 carbonos só pode estar no C2
  assert.equal(name('CH(CH3)3'), 'metilpropano');
  assert.equal(name('CH2ClCH2Cl'), '1,2-dicloroetano');
  assert.equal(name('CH3COOH'), 'ácido etanoico'); // "acetic acid is ethanoic acid" (p. 766)
  const parts = org('CH3CH(OH)CH3').iupac.parts.map((p) => p.text);
  assert.deepEqual(parts, ['prop', 'an', 'ol']);
});

test('isomeria plana: função, cadeia e posição', () => {
  const L = (id) => lewisFor(id, data);
  assert.equal(isomerType(L('C2H5OH'), L('CH3OCH3')), 'função');
  assert.equal(isomerType(L('CH3CH2CH2CH3'), L('CH(CH3)3')), 'cadeia');
  assert.equal(isomerType(L('CH3CH2CH2OH'), L('CH3CH(OH)CH3')), 'posição');
  assert.equal(molecularFormula('C2H5OH'), molecularFormula('CH3OCH3'));
  assert.deepEqual(org('C2H5OH').isomers, [{ id: 'CH3OCH3', type: 'função' }]);
  // Todo par de isômeros do jogo é reconhecido dos dois lados.
  for (const s of data.substances) {
    const a = org(s.id);
    if (!a) continue;
    for (const i of a.isomers) assert.ok(org(i.id).isomers.some((x) => x.id === s.id && x.type === i.type), `${s.id} × ${i.id}`);
  }
});

test('reações orgânicas coerentes com o tipo (cap. 18–19)', () => {
  const byType = (t) => data.reactions.filter((r) => r.types.includes(t));
  for (const r of byType('adicao')) {
    assert.ok(r.reactants.some((e) => ['alceno', 'alcino'].includes(org(e.id)?.fn)), `${r.id}: adição sem ligação múltipla`);
    assert.ok(org(r.products[0].id).saturated, `${r.id}: o produto da adição deveria ficar saturado`);
  }
  for (const r of byType('substituicao')) assert.ok(r.reactants.some((e) => org(e.id)?.fn === 'alcano'), `${r.id}: substituição em alcano`);
  for (const r of byType('condensacao')) {
    const fns = r.reactants.map((e) => org(e.id)?.fn).sort();
    assert.deepEqual(fns, ['acido', 'alcool'], `${r.id}: esterificação = ácido + álcool`);
    assert.ok(r.products.some((e) => org(e.id)?.fn === 'ester'));
  }
  assert.ok(byType('adicao').length >= 4 && byType('substituicao').length >= 1 && byType('condensacao').length >= 1);
});

test('respostas dos objetivos de orgânica estão entre as opções', () => {
  const objs = data.progression.levels.flatMap((l) => l.objectives).filter((o) => o.type === 'organic');
  assert.ok(objs.length >= 4);
  for (const o of objs) {
    const a = organicAnswer(o, data);
    assert.ok(a != null && o.choices.some((c) => c.value === a), `${o.id}: resposta ${a}`);
  }
});

test('grupos funcionais achados nas estruturas também nos íons orgânicos', () => {
  // O acetato (CH3COO⁻) tem carga, então não entra como molécula orgânica, mas a função é detectável.
  assert.ok(functionalGroups(lewisFor('CH3COOH', data)).some((g) => g.type === 'acido'));
  assert.equal(iupacName(lewisFor('CO2', data)), null);
});
