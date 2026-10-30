// Integridade dos dados: elementos (contra a IUPAC), substâncias, não-reações e série de reatividade.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData, loadRaw } from './helpers.js';
import { parseFormula } from '../src/core/formula.js';
import { checkConservation } from '../src/core/equation.js';
import { setKey } from '../src/core/data.js';

const data = loadData();
const raw = loadRaw();

// IUPAC/CIAAW 2021, "abridged standard atomic weights" (5 algarismos significativos).
const IUPAC = {
  H: 1.008, He: 4.0026, Li: 6.94, C: 12.011, N: 14.007, O: 15.999, Ne: 20.18, Na: 22.99, Mg: 24.305, Al: 26.982,
  S: 32.06, Cl: 35.45, Ar: 39.95, K: 39.098, Ca: 40.078, Fe: 55.845, Cu: 63.546, Zn: 65.38, Ag: 107.87, Au: 196.97,
};

test('118 elementos, Z sequencial, símbolos únicos', () => {
  assert.equal(data.elements.length, 118);
  data.elements.forEach((e, i) => assert.equal(e.Z, i + 1));
  assert.equal(new Set(data.elements.map((e) => e.symbol)).size, 118);
  for (const e of data.elements) {
    assert.ok(e.name && e.period >= 1 && e.period <= 7, `${e.symbol}`);
    assert.ok(e.xpos >= 1 && e.xpos <= 18 && e.ypos >= 1 && e.ypos <= 10, `${e.symbol} posição`);
  }
});

test('massas atômicas dos elementos jogáveis batem com a IUPAC', () => {
  for (const [sym, m] of Object.entries(IUPAC)) {
    const e = data.elementsBySymbol.get(sym);
    assert.ok(Math.abs(e.atomicMass - m) <= 0.01, `${sym}: ${e.atomicMass} vs IUPAC ${m}`);
  }
});

test('grupo e período de elementos conhecidos', () => {
  const g = (s) => data.elementsBySymbol.get(s);
  assert.deepEqual([g('Na').group, g('Na').period], [1, 3]);
  assert.deepEqual([g('Cl').group, g('Cl').period], [17, 3]);
  assert.deepEqual([g('Fe').group, g('Fe').period], [8, 4]);
  assert.deepEqual([g('Au').group, g('Au').period], [11, 6]);
  assert.equal(g('La').group, null);
  assert.equal(g('O').family, 'ametal');
  assert.equal(g('Ar').family, 'gas-nobre');
});

test('posições na tabela não se repetem', () => {
  const pos = data.elements.map((e) => `${e.xpos},${e.ypos}`);
  assert.equal(new Set(pos).size, pos.length);
});

test('substâncias: ids únicos, fórmulas válidas, elementos existentes, categorias conhecidas', () => {
  const ids = data.substances.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  const cats = raw.substances._meta.categories;
  for (const s of data.substances) {
    const { atoms, charge } = parseFormula(s.formula);
    assert.equal(charge, 0, `${s.id} deveria ser neutra`);
    for (const el of Object.keys(atoms)) assert.ok(data.elementsBySymbol.has(el), `${s.id}: elemento ${el}`);
    assert.ok(['s', 'l', 'g', 'aq'].includes(s.state), `${s.id}: estado`);
    assert.ok(s.categories.every((c) => cats.includes(c)), `${s.id}: categoria desconhecida`);
    assert.ok(s.name && s.description, `${s.id}: nome/descrição`);
  }
});

test('formas elementares contêm só o próprio elemento e há no máximo uma por elemento', () => {
  const seen = new Set();
  for (const s of data.substances.filter((x) => x.elementOf)) {
    assert.deepEqual(Object.keys(parseFormula(s.formula).atoms), [s.elementOf], s.id);
    assert.ok(!seen.has(s.elementOf), `duas formas elementares para ${s.elementOf}`);
    seen.add(s.elementOf);
    assert.ok(s.categories.includes('elemento'), s.id);
    const fam = data.elementsBySymbol.get(s.elementOf).family;
    if (s.categories.includes('metal')) assert.match(fam, /metal/, `${s.id} marcado como metal mas família é ${fam}`);
    if (s.categories.includes('gas-nobre')) assert.equal(fam, 'gas-nobre');
  }
});

test('composição iônica fecha com a fórmula (átomos e carga zero)', () => {
  for (const s of data.substances.filter((x) => x.ions)) {
    const { cation, anion } = s.ions;
    const res = checkConservation(
      [{ formula: cation.formula, coef: cation.count }, { formula: anion.formula, coef: anion.count }],
      [{ formula: s.formula, coef: 1 }],
    );
    assert.ok(res.ok, `${s.id}: ${res.problems.join('; ')}`);
    assert.ok(parseFormula(cation.formula).charge > 0 && parseFormula(anion.formula).charge < 0, `${s.id}: sinais das cargas`);
  }
});

test('ácidos têm cátion H⁺; sais não', () => {
  for (const s of data.substances) {
    if (s.categories.includes('acido')) assert.equal(s.ions?.cation.formula, 'H+', s.id);
    if (s.categories.includes('sal')) assert.notEqual(s.ions?.cation.formula, 'H+', s.id);
  }
});

test('não-reações: ids únicos, substâncias existem, têm motivo e não contradizem a base de reações', () => {
  const reactionKeys = new Set(data.reactions.map((r) => setKey(r.reactants.map((e) => e.id))));
  const ids = data.nonReactions.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const nr of data.nonReactions) {
    nr.substances.forEach((id) => assert.ok(data.substancesById.has(id), `${nr.id}: ${id}`));
    assert.ok(!reactionKeys.has(setKey(nr.substances)), `${nr.id} contradiz uma reação curada`);
    assert.ok(nr.reason.length > 40 && nr.title, nr.id);
    assert.ok(data.sources[nr.source?.ref], `${nr.id}: fonte`);
  }
});

test('série de reatividade ordenada por E° e com cátions válidos', () => {
  const s = data.reactivitySeries;
  for (let i = 1; i < s.length; i++) assert.ok(s[i].E0 > s[i - 1].E0, `${s[i].metal} fora de ordem`);
  for (const e of s) {
    assert.deepEqual(Object.keys(parseFormula(e.cation).atoms), [e.metal]);
    assert.ok(parseFormula(e.cation).charge > 0);
  }
  assert.ok(data.sources[data.reactivitySeriesSource.ref]);
});

test('ferramentas têm ids únicos, nome e ícone', () => {
  assert.equal(new Set(data.items.map((i) => i.id)).size, data.items.length);
  for (const i of data.items) assert.ok(i.name && i.icon && i.description, i.id);
});
