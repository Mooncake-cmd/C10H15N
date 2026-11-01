// Equilíbrio químico (Fase 3C): dados das tabelas de Atkins & Jones conferidos entre si e com a
// termodinâmica da Fase 3A; contas que reproduzem os exemplos resolvidos do livro.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import {
  kFromDeltaG, vantHoff, deltaNGas, kFromKc, leChatelier, reactionQuotient, direction, solutionPH, bufferPH,
  molarSolubility, precipitates, indicatorColor, atomsOfSide, findSpecies, equilibriumAnswer, interpretK,
} from '../src/core/equilibrium.js';
import { compoundFormula, solubility } from '../src/core/ions.js';

const data = loadData();
const E = data.equilibrium;
const near = (a, b, rel, msg) => assert.ok(Math.abs(a - b) <= rel * Math.abs(b), `${msg}: ${a} vs ${b}`);
const nearAbs = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('Tabela 10.2: equações balanceadas e K = Kc·(RT/P°)^Δn em todos os pontos (pega erro de transcrição)', () => {
  for (const g of E.gas) {
    assert.deepEqual(atomsOfSide(g.reactants), atomsOfSide(g.products), `${g.id}: átomos`);
    for (const [T, K, Kc] of g.points) near(kFromKc(Kc, T, deltaNGas(g)), K, 0.12, `${g.id} a ${T} K`);
  }
});

test('Tabela 10.2 × termodinâmica da Fase 3A: K = e^(−ΔG°/RT), corrigido para a temperatura da tabela', () => {
  let n = 0;
  for (const g of E.gas) {
    const keys = [...g.reactants, ...g.products].map((e) => `${e.formula}(g)`);
    if (keys.some((k) => !data.thermo[k])) continue;
    const sum = (side, f) => side.reduce((a, e) => a + e.coef * data.thermo[`${e.formula}(g)`][f], 0);
    const dG = sum(g.products, 'dG') - sum(g.reactants, 'dG');
    const dH = sum(g.products, 'dH') - sum(g.reactants, 'dH');
    const [T0, K0] = g.points[0];
    const K = vantHoff(kFromDeltaG(dG).K, 298.15, T0, dH);
    const ratio = Math.abs(Math.log10(K / K0));
    if (g.divergence) assert.ok(ratio > 0.5, `${g.id}: marcada como divergente, mas concorda`);
    else assert.ok(ratio < 0.3, `${g.id}: K calculado ${K.toExponential(2)} × tabela ${K0}`);
    n++;
  }
  assert.ok(n >= 3, `só ${n} reações conferidas`);
});

test('Exemplo 10.3 (p. 394): ΔG° = +1,70 kJ/mol → K = 0,50', () => {
  near(kFromDeltaG(1.7).K, 0.504, 0.01, 'K');
  assert.equal(interpretK(kFromDeltaG(-32.9).log10K), 'produtos');
  assert.equal(interpretK(kFromDeltaG(1.7).log10K), 'ambos');
});

test('Exemplo 10.13 (p. 412): van ’t Hoff leva o K da amônia de 298 K a 400 K perto do medido (41)', () => {
  const K400 = vantHoff(6.8e5, 298, 400, -92.22);
  near(K400, 41, 0.35, 'K a 400 K');
  assert.ok(K400 < 6.8e5, 'exotérmica: K cai com a temperatura');
});

test('Q × K e Le Chatelier', () => {
  const nh3 = E.gasById.get('nh3');
  const Q = reactionQuotient(nh3, { N2: 1, H2: 1, NH3: 1 });
  assert.equal(direction(Q, 6.8e5), 'produtos');
  assert.equal(direction(1e9, 6.8e5), 'reagentes');
  assert.deepEqual(leChatelier({ dn: deltaNGas(nh3), dH: -92.22 }), {
    addReactant: 'produtos', removeProduct: 'produtos', compress: 'produtos', expand: 'reagentes', heat: 'reagentes', cool: 'produtos',
  });
  assert.equal(leChatelier({ dn: deltaNGas(E.gasById.get('n2o4')), dH: 57.2 }).compress, 'reagentes');
  assert.equal(leChatelier({ dn: deltaNGas(E.gasById.get('hi')), dH: null }).compress, 'nao-muda');
});

test('pH: exemplos do livro', () => {
  const ac = findSpecies(E, 'CH3COOH');
  const r = solutionPH(ac.kind, 0.08, ac.params);
  nearAbs(r.pH, 2.92, 0.01, 'Exemplo 11.7: pH do ácido acético 0,080 M');
  nearAbs(r.percent, 1.5, 0.05, 'Exemplo 11.7: % desprotonada');
  nearAbs(solutionPH('strongAcid', 0.05, findSpecies(E, 'H2SO4').params).pH, 1.23, 0.01, 'Self-Test 11.15A: H2SO4 0,050 M');
  nearAbs(solutionPH('strongAcid', 0.01).pH, 2.0, 1e-6, 'HCl 0,010 M');
  nearAbs(solutionPH('strongBase', 0.01, findSpecies(E, 'Ba(OH)2').params).pH, 12.3, 0.01, 'Ba(OH)2 0,010 M (2 OH⁻)');
  const veryDilute = solutionPH('strongAcid', 1e-8).pH;
  assert.ok(veryDilute < 7 && veryDilute > 6.9, `ácido muito diluído não fica básico (seção 11.18): ${veryDilute}`);
  const nh3 = solutionPH('weakBase', 0.1, findSpecies(E, 'NH3').params);
  nearAbs(nh3.pH + nh3.pOH, 14, 1e-9, 'pH + pOH = 14');
  assert.ok(nh3.pH > 11 && nh3.pH < 11.2, `NH3 0,10 M: ${nh3.pH}`);
});

test('Exemplo 12.1 (p. 477): tampão 0,080 M CH3COOH + 0,040 M CH3COO⁻ → pH 4,45', () => {
  nearAbs(bufferPH(1.8e-5, 0.08, 0.04), 4.45, 0.01, 'pH');
});

test('Kps: Exemplo 12.8 (p. 498) e efeito do íon comum', () => {
  near(molarSolubility(E.kspByFormula.get('Cr(IO3)3')), 0.021, 0.02, 'Cr(IO3)3');
  const agcl = E.kspByFormula.get('AgCl');
  near(molarSolubility(agcl), Math.sqrt(1.6e-10), 1e-9, 'AgCl puro');
  near(molarSolubility(agcl, { anion: 0.1 }), 1.6e-9, 0.01, 'AgCl em NaCl 0,10 M');
  assert.equal(precipitates(agcl, 1e-3, 1e-3).precipitates, true);
  assert.equal(precipitates(agcl, 1e-6, 1e-6).precipitates, false);
});

test('Kps × Tabela I.1: os "insolúveis" do jogo dissolvem menos que os "pouco solúveis"', () => {
  const cats = [...data.ions.cationsByFormula.keys()];
  const ans = [...data.ions.anionsByFormula.keys()];
  const byClass = { insoluble: [], slightly: [] };
  for (const k of E.ksp) {
    if (!cats.includes(k.cation.formula) || !ans.includes(k.anion.formula)) continue;
    assert.equal(compoundFormula(k.cation.formula, k.anion.formula), k.formula, `${k.formula}: íons e fórmula`);
    const sol = solubility(k.cation.formula, k.anion.formula, data.ions)?.result;
    if (byClass[sol]) byClass[sol].push(molarSolubility(k));
  }
  assert.ok(byClass.insoluble.length >= 10 && byClass.slightly.length >= 1);
  assert.ok(Math.max(...byClass.insoluble) < Math.min(...byClass.slightly), 'ordem das classes');
  for (const s of byClass.insoluble) assert.ok(s < 0.01, `insolúvel com s = ${s}`);
});

test('indicadores: faixa coerente com o pKIn e cores nas pontas', () => {
  for (const ind of E.indicators) {
    assert.ok(ind.range[0] < ind.pKIn && ind.pKIn < ind.range[1], ind.name);
    assert.equal(indicatorColor(ind, ind.range[0] - 1).color, ind.acid);
    assert.equal(indicatorColor(ind, ind.range[1] + 1).color, ind.base);
  }
  const fenolf = E.indicators.find((i) => i.name === 'fenolftaleína');
  assert.equal(indicatorColor(fenolf, 3).color, 'incolor');
  assert.equal(indicatorColor(fenolf, 12).color, 'rosa');
});

test('ligações com o jogo apontam para o que existe', () => {
  for (const g of E.gas.filter((x) => x.game)) assert.ok(data.reactionsById.get(g.game), `${g.id}: ${g.game}`);
  for (const a of [...E.acids, ...E.bases, ...E.strong.acids, ...E.strong.bases].filter((x) => x.game)) {
    assert.equal(data.substancesById.get(a.game)?.formula, a.formula, `${a.formula}: substância do jogo`);
  }
  for (const s of [E.Kw.source, E.strong.source, E.kspSource, E.indicatorSource, ...E.acidSource, ...E.baseSource]) {
    assert.ok(data.sources[s.ref] && s.pages, 'fonte');
  }
});

test('respostas dos objetivos de equilíbrio são calculáveis', () => {
  const objs = data.progression.levels.flatMap((l) => l.objectives).filter((o) => o.type === 'equilibrium');
  for (const o of objs) {
    const a = equilibriumAnswer(o, data);
    if (o.choices) assert.ok(o.choices.some((c) => c.value === a), `${o.id}: resposta ${a} fora das opções`);
    else assert.ok(Number.isFinite(a), `${o.id}`);
  }
});

test('perguntas de Le Chatelier com calor usam o ΔH° da própria reação do jogo (Fase 3A)', async () => {
  const { reactionThermo } = await import('../src/core/thermo.js');
  const objs = data.progression.levels.flatMap((l) => l.objectives).filter((o) => o.type === 'equilibrium' && o.dH != null);
  assert.ok(objs.length);
  for (const o of objs) {
    const g = E.gasById.get(o.gas);
    const dH = reactionThermo(data.reactionsById.get(g.game), data).dH;
    assert.ok(Math.abs(dH - o.dH) < 0.5, `${o.id}: ΔH ${o.dH} × ${dH}`);
  }
});
