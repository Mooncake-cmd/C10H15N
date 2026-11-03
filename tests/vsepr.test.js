// Forma das moléculas (Fase 3D): o VSEPR deduzido das estruturas de Lewis tem de dar as formas,
// os ângulos e a polaridade do capítulo 3 de Atkins & Jones.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { analyzeMolecule, moleculeKeys, angleAt, atomSites, lewisFor, moleculeAnswer, vec } from '../src/core/vsepr.js';

const data = loadData();
const M = data.molecules;
const keys = moleculeKeys(data);

test('estruturas de Lewis coerentes: elétrons não ligantes ≥ 0 e octeto respeitado (H: dueto)', () => {
  assert.ok(keys.length >= 20);
  for (const k of keys) {
    for (const s of atomSites(lewisFor(k, data), data)) {
      assert.ok(s.nonbonding != null && s.nonbonding >= 0, `${k}: ${s.el}${s.i} com ${s.nonbonding} elétrons não ligantes`);
      if (s.el === 'H') assert.equal(s.bondSum + s.nonbonding, 1, `${k}: H`);
      if (['C', 'N', 'O', 'F'].includes(s.el)) assert.ok(s.bondSum * 2 + s.nonbonding <= 8, `${k}: ${s.el}${s.i} passa do octeto`);
    }
  }
});

test('formas do livro (Fig. 3.1 e seções 3.1–3.2)', () => {
  const shape = (k) => {
    const m = analyzeMolecule(k, data);
    return [m.shape, m.main?.axe ?? null];
  };
  assert.deepEqual(shape('CH4'), ['tetraédrica', 'AX₄']);
  assert.deepEqual(shape('H2O'), ['angular', 'AX₂E₂']);
  assert.deepEqual(shape('NH3'), ['pirâmide trigonal', 'AX₃E']);
  assert.deepEqual(shape('CO2'), ['linear', 'AX₂']); // ligação dupla conta como uma região (p. 96)
  assert.deepEqual(shape('SO2'), ['angular', 'AX₂E']);
  assert.deepEqual(shape('NO3-'), ['trigonal plana', 'AX₃']); // p. 97
  assert.deepEqual(shape('CO3^2-'), ['trigonal plana', 'AX₃']);
  assert.deepEqual(shape('SO4^2-'), ['tetraédrica', 'AX₄']);
  assert.deepEqual(shape('NH4+'), ['tetraédrica', 'AX₄']);
  assert.deepEqual(shape('HCl'), ['linear', null]);
  // Hibridização (Tabela 3.2)
  assert.equal(analyzeMolecule('CH4', data).main.hybridization, 'sp³');
  assert.equal(analyzeMolecule('CO2', data).main.hybridization, 'sp');
  assert.equal(analyzeMolecule('NO3-', data).main.hybridization, 'sp²');
});

test('geometria 3D: todo ângulo em volta de cada átomo é o ideal do seu arranjo, e nenhum átomo se sobrepõe', () => {
  for (const k of keys) {
    const m = analyzeMolecule(k, data);
    const { pos, sites } = m.geo;
    for (const c of m.centers) {
      const nb = sites[c.atom].neighbors;
      const ideal = c.regions === 3 ? [120] : c.regions === 2 ? [180] : c.regions === 4 ? [109.47] : [90, 120, 180];
      for (let a = 0; a < nb.length; a++) {
        for (let b = a + 1; b < nb.length; b++) {
          const ang = angleAt(pos, c.atom, nb[a], nb[b]);
          assert.ok(ideal.some((x) => Math.abs(ang - x) < 0.5), `${k}: ângulo ${ang.toFixed(1)}° em ${c.el}`);
        }
      }
    }
    const bonded = new Set(m.lewis.bonds.flatMap((b) => [`${b.a}-${b.b}`, `${b.b}-${b.a}`]));
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const d = vec.len(vec.sub(pos[i], pos[j]));
        if (bonded.has(`${i}-${j}`)) assert.ok(d > 60 && d < 200, `${k}: ligação de ${d} pm`);
        else assert.ok(d > 90, `${k}: átomos ${i} e ${j} a ${d.toFixed(0)} pm`);
      }
    }
  }
});

test('polaridade prevista × momentos de dipolo medidos (Tabela 3.1)', () => {
  let n = 0;
  for (const [f, mu] of Object.entries(M.dipoles)) {
    const m = keys.includes(f) ? analyzeMolecule(f, data) : null;
    if (!m) continue;
    assert.equal(m.polarity.polar, mu > 0, `${f}: medido ${mu} D`);
    n++;
  }
  assert.ok(n >= 5, `só ${n} moléculas conferidas`);
  // Hidrocarbonetos: apolares (Bernoulli v. 2, p. 78); moléculas de um só elemento também.
  for (const f of ['C3H8', 'CH4', 'H2', 'O2', 'N2', 'Cl2']) assert.equal(analyzeMolecule(f, data).polarity.polar, false, f);
  for (const f of ['C2H5OH', 'CH3COOH', 'SO2', 'HNO3']) assert.equal(analyzeMolecule(f, data).polarity.polar, true, f);
});

test('ângulos medidos (p. 95): pares isolados apertam as ligações', () => {
  for (const [f, { atom, angle }] of Object.entries(M.measuredAngles)) {
    const m = analyzeMolecule(f, data);
    assert.equal(m.main.el, atom);
    if (m.main.lonePairs > 0) assert.ok(angle < m.main.idealAngle, `${f}: ${angle} deveria ser menor que ${m.main.idealAngle}`);
    else assert.equal(angle, m.main.idealAngle);
  }
});

test('fontes com página e respostas dos objetivos de forma molecular', () => {
  for (const s of [M.shapesSource, M.hybridizationSource, M.measuredAnglesSource, M.dipolesSource, M.regionsSource, ...M.nonpolarBondsSource]) {
    assert.ok(data.sources[s.ref] && s.pages, 'fonte');
  }
  const objs = data.progression.levels.flatMap((l) => l.objectives).filter((o) => o.type === 'molecule');
  for (const o of objs) {
    const a = moleculeAnswer(o, data);
    if (o.choices) assert.ok(o.choices.some((c) => c.value === String(a)), `${o.id}: ${a} fora das opções`);
    else assert.ok(Number.isFinite(a), o.id);
  }
});
