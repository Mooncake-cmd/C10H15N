// Íons, solubilidade (Tabela I.1 de Atkins & Jones, p. F69) e compostos gerados a partir deles.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { solubility, compoundFormula, compoundName, pairProblem, sameComposition } from '../src/core/ions.js';
import { parseFormula } from '../src/core/formula.js';

const data = loadData();
const ions = data.ions;
const sol = (c, a) => solubility(c, a, ions)?.result;

test('Tabela I.1: casos da tabela e das notas de rodapé', () => {
  // Grupo 1 e amônio: sempre solúveis
  assert.equal(sol('Na+', 'CO3^2-'), 'soluble');
  assert.equal(sol('NH4+', 'CO3^2-'), 'soluble');
  assert.equal(sol('K+', 'OH-'), 'soluble');
  // Nitratos e acetatos
  assert.equal(sol('Ag+', 'NO3-'), 'soluble');
  assert.equal(sol('Fe^3+', 'NO3-'), 'soluble');
  assert.equal(sol('Ag+', 'CH3COO-'), 'soluble');
  // Cloretos: exceção da prata
  assert.equal(sol('Ag+', 'Cl-'), 'insoluble');
  assert.equal(sol('Cu^2+', 'Cl-'), 'soluble');
  // Sulfatos: exceções Ca, Sr, Ba (insolúveis) e Ag (pouco solúvel)
  assert.equal(sol('Ba^2+', 'SO4^2-'), 'insoluble');
  assert.equal(sol('Ca^2+', 'SO4^2-'), 'insoluble');
  assert.equal(sol('Ag+', 'SO4^2-'), 'slightly');
  assert.equal(sol('Cu^2+', 'SO4^2-'), 'soluble');
  assert.equal(sol('Mg^2+', 'SO4^2-'), 'soluble');
  // Carbonatos insolúveis
  assert.equal(sol('Ca^2+', 'CO3^2-'), 'insoluble');
  assert.equal(sol('Ba^2+', 'CO3^2-'), 'insoluble');
  // Hidróxidos: Ba solúvel, Ca e Sr pouco, Mg só muito ligeiramente (tratado como insolúvel)
  assert.equal(sol('Ba^2+', 'OH-'), 'soluble');
  assert.equal(sol('Ca^2+', 'OH-'), 'slightly');
  assert.equal(sol('Sr^2+', 'OH-'), 'slightly');
  assert.equal(sol('Mg^2+', 'OH-'), 'insoluble');
  assert.equal(sol('Cu^2+', 'OH-'), 'insoluble');
  assert.equal(sol('Fe^3+', 'OH-'), 'insoluble');
});

test('fórmulas e nomes montados pela carga', () => {
  assert.equal(compoundFormula('Al^3+', 'SO4^2-'), 'Al2(SO4)3');
  assert.equal(compoundFormula('NH4+', 'CO3^2-'), '(NH4)2CO3');
  assert.equal(compoundFormula('Fe^3+', 'OH-'), 'Fe(OH)3');
  assert.equal(compoundFormula('Ca^2+', 'NO3-'), 'Ca(NO3)2');
  assert.equal(compoundFormula('Fe^3+', 'O^2-'), 'Fe2O3');
  assert.equal(compoundFormula('Na+', 'Cl-'), 'NaCl');
  assert.equal(compoundName('Fe^2+', 'Cl-', ions), 'Cloreto de ferro(II)');
  assert.equal(compoundName('Ba^2+', 'SO4^2-', ions), 'Sulfato de bário');
  assert.ok(sameComposition('CH3COONa', 'NaCH3COO'));
  assert.ok(!sameComposition('FeCl2', 'FeCl3'));
});

test('compostos que não existem não são gerados', () => {
  for (const [c, a] of [['Ag+', 'OH-'], ['Cu^2+', 'CO3^2-'], ['Fe^3+', 'CO3^2-'], ['Al^3+', 'CO3^2-'], ['NH4+', 'OH-'], ['Ca^2+', 'HCO3-']]) {
    assert.ok(pairProblem(c, a, ions), `${c} + ${a} deveria ser recusado`);
    assert.ok(!data.substancesById.has(compoundFormula(c, a)), `${compoundFormula(c, a)} não deveria existir`);
  }
});

test('compostos derivados: sem duplicar os curados, íons corretos, nome e solubilidade na descrição', () => {
  const derived = data.substances.filter((s) => s.derived);
  assert.ok(derived.length > 50);
  const curated = data.substances.filter((s) => !s.derived);
  for (const d of derived) {
    assert.ok(!curated.some((c) => sameComposition(c.formula, d.formula)), `${d.id} duplica um composto curado`);
    assert.equal(d.id, d.formula);
    assert.match(d.description, /solúvel|insolúvel/);
    assert.equal(parseFormula(d.formula).charge, 0);
  }
  assert.ok(data.substancesById.get('BaSO4').description.includes('insolúvel'));
  assert.equal(data.substancesById.get('BaCl2').hazard, 'Compostos solúveis de bário são tóxicos se ingeridos.');
  assert.equal(data.substancesById.get('BaSO4').hazard, undefined, 'BaSO4 é insolúvel: é o contraste do raio X');
});
