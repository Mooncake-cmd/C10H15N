// Fase 4A: fundamentos. Respostas calculadas (átomo, elétrons, estado, nomes), alternativas
// explicadas e o porquê dos erros mais comuns.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import {
  FUNDAMENTAL_TYPES,
  aufbauConfig,
  expandConfig,
  atomParticles,
  valenceElectrons,
  fundamentalsAnswer,
  isFundamentalsAnswerRight,
  fundamentalsExplain,
  fundamentalsMistake,
} from '../src/core/fundamentals.js';

const data = loadData();
const objectives = data.progression.levels.flatMap((l) => l.objectives).filter((o) => FUNDAMENTAL_TYPES.includes(o.type));
const O = (id) => objectives.find((o) => o.id === id);
const sorted = (conf) => conf.split(' ').sort().join(' ');

test('diagrama de Pauling: bate com o dataset, fora as exceções conhecidas', () => {
  assert.equal(aufbauConfig(11), '1s2 2s2 2p6 3s1');
  assert.equal(aufbauConfig(26), '1s2 2s2 2p6 3s2 3p6 4s2 3d6');
  const exceptions = data.elements.filter((e) => sorted(aufbauConfig(e.Z)) !== sorted(expandConfig(e.symbol, data))).map((e) => e.symbol);
  // As exceções de verdade são só metais de transição, lantanídeos, actinídeos e superpesados
  // (Cr e Cu são as clássicas). Nenhum elemento representativo leve pode aparecer aqui.
  assert.ok(exceptions.includes('Cr') && exceptions.includes('Cu'), exceptions.join(' '));
  for (const s of exceptions) {
    const e = data.elementsBySymbol.get(s);
    assert.ok(e.Z > 20 && (e.group == null || (e.group >= 3 && e.group <= 12) || e.Z > 100), `${s} não deveria ser exceção`);
  }
  // Os elementos perguntados no jogo seguem a regra.
  for (const o of objectives.filter((x) => x.type === 'electrons')) {
    const e = data.elementsBySymbol.get(o.element);
    assert.ok(!exceptions.includes(o.element), `${o.id}: ${o.element} é exceção ao diagrama`);
    assert.equal(e.shells.reduce((a, b) => a + b, 0), e.Z, `${o.id}: camadas do dataset`);
  }
});

test('partículas do átomo e elétrons de valência', () => {
  assert.deepEqual(atomParticles({ element: 'Na', massNumber: 23 }, data), { protons: 11, neutrons: 12, electrons: 11, Z: 11 });
  assert.equal(atomParticles({ element: 'Cl', massNumber: 35, charge: -1 }, data).electrons, 18);
  assert.equal(atomParticles({ element: 'Mg', massNumber: 24, charge: 2 }, data).electrons, 10);
  assert.equal(valenceElectrons('Cl', data), 7);
  assert.equal(valenceElectrons('Na', data), 1);
  assert.throws(() => valenceElectrons('Fe', data), /representativos/);
});

test('toda pergunta dos fundamentos tem resposta, fonte e alternativas explicadas', () => {
  assert.ok(objectives.length >= 20);
  for (const o of objectives) {
    const right = fundamentalsAnswer(o, data);
    assert.ok(right !== undefined && right !== null && right !== '', `${o.id}: sem resposta`);
    assert.ok(isFundamentalsAnswerRight(o, right, data), `${o.id}: a própria resposta não confere`);
    assert.ok(fundamentalsExplain(o, data).length > 20, `${o.id}: sem explicação`);
    if (o.type !== 'state') {
      assert.ok(data.sources[o.source?.ref] && o.source.topic && o.source.pages, `${o.id}: fonte`);
      assert.ok(!data.complementarySources.includes(o.source.ref), `${o.id}: fonte de divulgação`);
    }
    if (o.choices) {
      const values = o.choices.map((c) => c.value);
      assert.equal(new Set(values).size, values.length, `${o.id}: alternativa repetida`);
      assert.ok(values.includes(right), `${o.id}: a resposta calculada (${right}) não está entre as alternativas`);
      for (const c of o.choices) {
        assert.ok(c.why && c.why.length > 15, `${o.id}/${c.value}: sem porquê`);
        assert.equal(isFundamentalsAnswerRight(o, c.value, data), c.value === right, `${o.id}/${c.value}`);
        if (c.value !== right) assert.equal(fundamentalsMistake(o, c.value, data), c.why);
      }
    }
    if (o.type === 'atom' || o.type === 'electrons') assert.ok(o.unitLabel, `${o.id}: unitLabel`);
    // Estado físico vem do dataset (0 °C): só elementos que não mudam de estado até 25 °C.
    if (o.type === 'state') assert.ok(!['Ga', 'Cs', 'Rb', 'Fr'].includes(o.element), `${o.id}: funde perto da temperatura ambiente`);
  }
});

test('respostas aceitas: vírgulas, espaços, sobrescritos e maiúsculas', () => {
  assert.ok(isFundamentalsAnswerRight(O('f3-na-camadas'), '2,8,1', data));
  assert.ok(isFundamentalsAnswerRight(O('f3-na-camadas'), 'K=2 L=8 M=1', data));
  assert.ok(!isFundamentalsAnswerRight(O('f3-na-camadas'), '2, 8, 1, 0', data));
  assert.ok(isFundamentalsAnswerRight(O('f3-o-config'), '1s²2s²2p⁴', data));
  assert.ok(isFundamentalsAnswerRight(O('f3-o-config'), '1S2 2S2 2P4', data));
  assert.ok(!isFundamentalsAnswerRight(O('f3-o-config'), '1s2 2p4 2s2', data), 'a ordem conta');
  assert.ok(isFundamentalsAnswerRight(O('f2-na-n'), ' 12 ', data));
  assert.ok(!isFundamentalsAnswerRight(O('f2-na-n'), '23', data));
  assert.ok(!isFundamentalsAnswerRight(O('f2-na-n'), 'doze', data));
  assert.ok(isFundamentalsAnswerRight(O('f4-br'), 'l', data));
  assert.equal(fundamentalsAnswer(O('f5-fecl3'), data), 'Cloreto de ferro(III)');
  assert.equal(fundamentalsAnswer(O('f5-al2o3'), data), 'Al2O3');
});

test('erros comuns são explicados sem entregar a resposta', () => {
  const cases = [
    ['f2-na-n', '23', /número de massa/],
    ['f2-na-n', '11', /prótons/],
    ['f2-na-p', '12', /nêutrons/],
    ['f2-cl-ion', '17', /átomo neutro/],
    ['f2-cl-ion', '16', /sinal/],
    ['f3-cl-valencia', '17', /total de elétrons/],
    ['f3-na-camadas', '2, 8, 2', /somam 12/],
    ['f3-na-camadas', '2, 9', /no máximo 8/],
    ['f3-o-config', '1s2 2s4 2p2', /subcamada s comporta no máximo 2/],
    ['f3-o-config', '1s2 2p6', /ordem das subcamadas/],
    ['f3-o-config', '1s22s22p3', /somam 7/],
  ];
  for (const [id, answer, re] of cases) {
    const o = O(id);
    const text = fundamentalsMistake(o, answer, data);
    assert.match(text, re, `${id} ← ${answer}`);
    const right = String(fundamentalsAnswer(o, data));
    if (/^\d+$/.test(right)) assert.ok(!new RegExp(`(^|[^\\d])${right}([^\\d]|$)`).test(text.replace(/Z = \d+|\d+ elétrons \(/g, '')), `${id}: entregou a resposta: ${text}`);
  }
});
