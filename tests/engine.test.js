import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { createEngine } from '../src/core/engine.js';

const data = loadData();
const { combine } = createEngine(data);

test('reação curada simples', () => {
  const r = combine(['Na', 'Cl2']);
  assert.equal(r.kind, 'reaction');
  assert.equal(r.reaction.id, 'na-cl2');
});

test('ordem e repetição não importam', () => {
  assert.equal(combine(['Cl2', 'Na', 'Na']).reaction.id, 'na-cl2');
});

test('faltando condição: avisa qual', () => {
  const r = combine(['H2', 'O2']);
  assert.equal(r.kind, 'needs-condition');
  assert.equal(r.reaction.id, 'h2-o2');
  assert.deepEqual(r.missing, [['faisca', 'calor']]);
  assert.equal(combine(['H2', 'O2', 'faisca']).kind, 'reaction');
  assert.equal(combine(['H2', 'O2', 'calor']).kind, 'reaction');
});

test('condições múltiplas (E): Haber precisa de calor E catalisador', () => {
  assert.equal(combine(['N2', 'H2', 'calor']).kind, 'needs-condition');
  assert.deepEqual(combine(['N2', 'H2', 'calor']).missing, [['catalisador']]);
  assert.equal(combine(['N2', 'H2', 'calor', 'catalisador']).reaction.id, 'haber');
});

test('decomposição com uma substância + ferramenta', () => {
  assert.equal(combine(['H2O', 'eletricidade']).reaction.id, 'h2o-eletrolise');
  assert.equal(combine(['CaCO3', 'calor']).reaction.id, 'caco3-calor');
  assert.equal(combine(['H2O2']).kind, 'needs-condition');
});

test('não-reação curada tem prioridade sobre regras genéricas', () => {
  const r = combine(['Cu', 'HCl']);
  assert.equal(r.kind, 'no-reaction');
  assert.equal(r.reasonId, 'nr-cu-hcl');
});

test('regra: gás nobre', () => {
  const r = combine(['He', 'O2', 'calor']);
  assert.equal(r.kind, 'no-reaction');
  assert.equal(r.reasonId, 'rule:gas-nobre');
  assert.match(r.reason, /1s2/);
});

test('regra: só metais → liga, não composto', () => {
  assert.equal(combine(['Fe', 'Cu']).reasonId, 'rule:so-metais');
});

test('regra: série de reatividade — menos reativo não desloca (confiante)', () => {
  const r = combine(['Au', 'CuSO4']);
  assert.equal(r.kind, 'no-reaction');
  assert.equal(r.reasonId, 'rule:reatividade');
  assert.equal(combine(['Cu', 'CH3COOH']).reasonId, 'rule:reatividade');
});

test('Fase 2: metal mais reativo desloca o do sal — equação gerada e balanceada', () => {
  const r = combine(['Zn', 'CuSO4']);
  assert.equal(r.kind, 'reaction');
  assert.ok(r.reaction.generated);
  assert.deepEqual(r.reaction.products.map((p) => [p.id, p.coef]), [['ZnSO4', 1], ['Cu', 1]]);
});

test('Fase 2: metal que ataca a água não "desloca" o do sal — fica como desconhecido', () => {
  const r = combine(['Na', 'CuSO4']);
  assert.equal(r.kind, 'unknown');
  assert.equal(r.reasonId, 'rule:reage-com-agua');
});

test('mesmo metal', () => {
  assert.equal(combine(['Cu', 'CuSO4']).reasonId, 'rule:mesmo-metal');
});

test('substância sozinha', () => {
  assert.equal(combine(['NaCl']).reasonId, 'rule:sozinha');
  assert.equal(combine(['NaCl', 'calor']).kind, 'unknown');
});

test('bancada inválida', () => {
  assert.equal(combine([]).kind, 'invalid');
  assert.equal(combine(['calor']).kind, 'invalid');
});

test('combinação desconhecida é honesta (unknown, não no-reaction)', () => {
  const r = combine(['C', 'Cl2']);
  assert.equal(r.kind, 'unknown');
});

test('todas as reações da base são alcançáveis pelo motor com suas condições', () => {
  for (const r of data.reactions) {
    const items = r.conditions.map((anyOf) => anyOf[0]);
    const res = combine([...r.reactants.map((e) => e.id), ...items]);
    assert.equal(res.kind, 'reaction', r.id);
    assert.equal(res.reaction.id, r.id);
  }
});

test('todas as não-reações curadas são retornadas pelo motor', () => {
  for (const nr of data.nonReactions) {
    const res = combine(nr.substances);
    assert.equal(res.kind, 'no-reaction', nr.id);
    assert.equal(res.reasonId, nr.id);
  }
});
