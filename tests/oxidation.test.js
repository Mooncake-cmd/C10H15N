// Número de oxidação (Toolbox K.1 de Atkins & Jones, p. F80; Bernoulli v. 4, Frente C, Módulo 13).
// A análise de NOX é independente da marcação das reações: se as duas discordam, uma está errada.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { oxidationStates, oxidationStatesOfFormula, redoxAnalysis, formatOx } from '../src/core/oxidation.js';
import { rulesFor } from '../src/core/engine.js';

const data = loadData();
const nox = (formula) => {
  const s = data.substances.find((x) => x.formula === formula);
  return Object.fromEntries(Object.entries(oxidationStates(s, data)).map(([el, v]) => [el, v.map(formatOx).join('/')]));
};

test('exemplos clássicos', () => {
  assert.deepEqual(nox('H2O'), { H: '+1', O: '−2' });
  assert.deepEqual(nox('H2O2'), { H: '+1', O: '−1' }); // peróxido
  assert.deepEqual(nox('Na2O2'), { Na: '+1', O: '−1' });
  assert.deepEqual(nox('CuSO4'), { Cu: '+2', S: '+6', O: '−2' });
  assert.deepEqual(nox('HNO3'), { H: '+1', N: '+5', O: '−2' });
  assert.deepEqual(nox('NH3'), { H: '+1', N: '−3' });
  assert.deepEqual(nox('Fe2O3'), { Fe: '+3', O: '−2' });
  assert.deepEqual(nox('C3H8'), { H: '+1', C: '−8/3' }); // NOX médio
  assert.deepEqual(nox('Cl2'), { Cl: '0' });
  assert.equal(nox('NH4NO3').N, '−3/+5'); // íon por íon
});

test('regras do livro: hidreto metálico, superóxido, halogênio com oxigênio, carga do íon', () => {
  const f = (x) => Object.fromEntries(Object.entries(oxidationStatesOfFormula(x, data)).map(([el, v]) => [el, formatOx(v)]));
  assert.deepEqual(f('NaH'), { Na: '+1', H: '−1' });
  assert.deepEqual(f('KO2'), { K: '+1', O: '−1/2' });
  assert.deepEqual(f('HClO4'), { H: '+1', Cl: '+7', O: '−2' });
  assert.deepEqual(f('ICl'), { I: '+1', Cl: '−1' });
  assert.deepEqual(f('SO4^2-'), { S: '+6', O: '−2' });
  assert.deepEqual(f('MnO4-'), { Mn: '+7', O: '−2' });
  assert.deepEqual(f('OF2'), { F: '−1', O: '+2' });
});

test('toda substância do jogo (curada ou derivada de íons) tem NOX, e a soma dá a carga', () => {
  for (const s of data.substances) {
    const ox = oxidationStates(s, data);
    assert.ok(ox, `${s.id}: sem NOX`);
  }
});

/** Todas as reações: curadas e as que as regras geram para qualquer par. */
function allReactions() {
  const rules = rulesFor(data);
  const items = data.items.map((i) => i.id);
  const ids = data.substances.map((s) => s.id);
  const out = [...data.reactions];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i; j < ids.length; j++) {
      const r = rules.evaluate(i === j ? [ids[i]] : [ids[i], ids[j]], items)?.reaction;
      if (r) out.push(r);
    }
  }
  return out;
}

test('varredura: NOX muda ⇔ reação marcada como oxirredução (curadas e geradas)', () => {
  const all = allReactions();
  assert.ok(all.length > 600);
  for (const r of all) {
    const a = redoxAnalysis(r, data);
    assert.ok(a.known, `${r.id}: sem NOX`);
    assert.equal(a.changes.length > 0, r.tags.includes('redox'), `${r.id}: marcação redox × NOX`);
    if (a.changes.length) {
      assert.ok(a.reducers.length && a.oxidizers.length, `${r.id}: oxida sem reduzir (ou o contrário)`);
    }
  }
});

test('Cu + HNO3 diluído: Cu oxida, N reduz (+5 → +2); H2O2: o oxigênio se desproporciona', () => {
  const cu = redoxAnalysis(data.reactionsById.get('cu-hno3'), data);
  const t = (a, el) => a.changes.find((c) => c.el === el).transitions.map((x) => `${formatOx(x.from)}→${formatOx(x.to)} ${x.dir}`);
  assert.deepEqual(t(cu, 'Cu'), ['0→+2 oxida']);
  assert.deepEqual(t(cu, 'N'), ['+5→+2 reduz']);
  assert.deepEqual([cu.reducers, cu.oxidizers], [['Cu'], ['HNO3']]);
  const h2o2 = redoxAnalysis(data.reactionsById.get('h2o2-decomposicao'), data);
  assert.deepEqual(new Set(t(h2o2, 'O')), new Set(['−1→−2 reduz', '−1→0 oxida']));
});
