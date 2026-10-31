// Energia das reações (Fase 3A): os dados de formação têm de ser coerentes entre si e com os
// livros, e cada reação curada marcada como exotérmica/endotérmica tem de ter o sinal certo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { reactionThermo, speciesThermo, T_STD } from '../src/core/thermo.js';
import { parseFormula } from '../src/core/formula.js';
import { balance } from '../src/core/balancer.js';

const data = loadData();
const T = data.thermo;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('cada espécie tem ΔfH°, fonte e página', () => {
  assert.ok(Object.keys(T).length > 80);
  for (const [k, v] of Object.entries(T)) {
    assert.match(k, /^[^()]+(\(.*\))?[^()]*\((s|l|g|aq)\)$/, `${k}: chave fórmula(estado)`);
    assert.equal(typeof v.dH, 'number', `${k}: ΔfH°`);
    assert.ok(data.sources[v.ref] && v.page, `${k}: fonte`);
  }
});

test('coerência interna: ΔfG° = ΔfH° − T·ΔfS° para todo composto neutro (pega colunas trocadas)', () => {
  const REF = { H: ['H2(g)', 2], O: ['O2(g)', 2], N: ['N2(g)', 2], Cl: ['Cl2(g)', 2], C: ['C(s)', 1], S: ['S(s)', 1] };
  let n = 0;
  for (const [k, v] of Object.entries(T)) {
    const p = parseFormula(k.slice(0, k.lastIndexOf('(')));
    if (p.charge !== 0 || v.S == null || v.dG == null) continue;
    let Se = 0;
    let ok = true;
    for (const [el, cnt] of Object.entries(p.atoms)) {
      const [rk, div] = REF[el] ?? [`${el}(s)`, 1];
      if (T[rk]?.S == null) ok = false;
      else Se += (cnt * T[rk].S) / div;
    }
    if (!ok) continue;
    near(v.dG, v.dH - (T_STD * (v.S - Se)) / 1000, 1.0, `${k}: ΔfG° ≠ ΔfH° − TΔfS°`);
    n++;
  }
  assert.ok(n >= 60, `só ${n} compostos conferidos`);
});

test('soma dos íons = composto dissolvido tabelado', () => {
  for (const [id, key] of [['HCl', 'HCl(aq)'], ['H2SO4', 'H2SO4(aq)'], ['Ca(OH)2', 'Ca(OH)2(aq)']]) {
    const sub = { ...data.substancesById.get(id), categories: ['base'] }; // força a soma dos íons
    const sum = speciesThermo(sub, 'aq', { ...data, thermo: Object.fromEntries(Object.entries(T).filter(([k]) => k !== key)) });
    near(sum.dH, T[key].dH, 0.5, `${id}: Σ íons`);
  }
});

test('combustão pela lei de Hess = entalpia de combustão medida (Tabela 2C.6)', () => {
  const sp = (id) => data.substancesById.get(id).formula;
  let n = 0;
  for (const [k, v] of Object.entries(T)) {
    if (v.dcH == null) continue;
    const fuel = k.slice(0, k.lastIndexOf('('));
    const st = k.slice(k.lastIndexOf('(') + 1, -1);
    const c = balance([fuel, 'O2'], ['CO2', 'H2O']);
    const dH = c.products[0] * T['CO2(g)'].dH + c.products[1] * T['H2O(l)'].dH - c.reactants[0] * v.dH;
    near(dH / c.reactants[0], v.dcH, 2.5, `${fuel}(${st})`);
    n++;
  }
  assert.ok(n >= 3);
  assert.ok(sp('C2H5OH'));
});

test('exemplos dos livros', () => {
  const r = (id) => reactionThermo(data.reactionsById.get(id), data);
  near(r('ch4-o2').dH, -890, 1, 'metano'); // Tabela 2C.6
  near(r('h2-o2').dH, 2 * -285.83, 0.01, 'água líquida');
  near(r('haber').dH, -92.2, 0.1, 'síntese da amônia');
  near(r('caco3-calor').dH, 178.3, 0.1, 'calcário');
  near(r('hcl-naoh').dH, -55.8, 0.1, 'neutralização ácido forte + base forte');
  // etanol: Atkins & Jones p. 270, C2H5OH(l) + 3 O2 → 2 CO2 + 3 H2O(l), ΔH° = −1368 kJ
  const eth = { reactants: [{ id: 'C2H5OH', coef: 1 }, { id: 'O2', coef: 3 }], products: [{ id: 'CO2', coef: 2 }, { id: 'H2O', coef: 3, state: 'l' }] };
  near(reactionThermo(eth, data).dH, -1368, 1.5, 'etanol');
});

test('reações curadas: a marca exotérmica/endotérmica bate com o sinal de ΔH°', () => {
  let n = 0;
  for (const r of data.reactions) {
    const t = reactionThermo(r, data);
    if (t.dH == null) continue;
    n++;
    if (r.tags.includes('exotermica')) assert.ok(t.dH < 0, `${r.id}: marcada exotérmica, mas ΔH° = ${t.dH}`);
    if (r.tags.includes('endotermica')) assert.ok(t.dH > 0, `${r.id}: marcada endotérmica, mas ΔH° = ${t.dH}`);
  }
  assert.ok(n >= 30, `só ${n} reações com ΔH°`);
});

test('dado faltante nunca vira número: aparece em missing', () => {
  const t = reactionThermo(data.reactionsById.get('nahco3-vinagre'), data);
  assert.equal(t.dH, null);
  assert.ok(t.missing.includes('NaHCO3(s)'));
});

test('varredura: nenhuma reação gerada pelas regras contradiz a própria marca exo/endo', async () => {
  const { rulesFor } = await import('../src/core/engine.js');
  const rules = rulesFor(data);
  const items = data.items.map((i) => i.id);
  const ids = data.substances.map((s) => s.id);
  let n = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i; j < ids.length; j++) {
      const r = rules.evaluate(i === j ? [ids[i]] : [ids[i], ids[j]], items)?.reaction;
      if (!r) continue;
      const t = reactionThermo(r, data);
      if (t.dH == null) continue;
      n++;
      if (r.tags.includes('exotermica')) assert.ok(t.dH < 0, `${r.id}: exotérmica com ΔH° = ${t.dH}`);
      if (r.tags.includes('endotermica')) assert.ok(t.dH > 0, `${r.id}: endotérmica com ΔH° = ${t.dH}`);
    }
  }
  assert.ok(n > 200, `só ${n} reações geradas com ΔH°`);
});
