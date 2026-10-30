// Equações químicas: contagem de átomos, carga, conservação de massa e formatação.
//
// Uma "espécie" numa equação é { formula, coef, state? }. As reações da base usam ids de
// substâncias (data/substances.json); `resolveSide` converte para fórmulas antes de verificar.
//
// Ponto de extensão (Fase 2): um balanceador automático deve produzir exatamente este formato
// (lista de { formula, coef }), para reaproveitar verificação, formatação e estequiometria.

import { parseFormula, formatFormulaHTML, molarMass } from './formula.js';

const STATE_LABEL = { s: 's', l: 'l', g: 'g', aq: 'aq' };

/** Converte entradas { id, coef, state? } em espécies { formula, coef, state }. */
export function resolveSide(entries, substancesById) {
  return entries.map((e) => {
    if (e.formula) return { formula: e.formula, coef: e.coef ?? 1, state: e.state };
    const sub = substancesById.get(e.id);
    if (!sub) throw new Error(`Substância desconhecida: ${e.id}`);
    return { formula: sub.formula, coef: e.coef ?? 1, state: e.state ?? sub.state, id: sub.id };
  });
}

/** Soma de átomos de um lado da equação, já multiplicada pelos coeficientes. */
export function countAtoms(side) {
  const total = {};
  for (const sp of side) {
    const { atoms } = parseFormula(sp.formula);
    for (const [el, n] of Object.entries(atoms)) total[el] = (total[el] || 0) + n * sp.coef;
  }
  return total;
}

export function totalCharge(side) {
  return side.reduce((acc, sp) => acc + parseFormula(sp.formula).charge * sp.coef, 0);
}

/**
 * Verifica conservação de átomos e de carga.
 * @returns {{ok: boolean, atoms: {element: string, left: number, right: number}[], charge: {left: number, right: number}, problems: string[]}}
 */
export function checkConservation(reactants, products) {
  const left = countAtoms(reactants);
  const right = countAtoms(products);
  const elements = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
  const atoms = elements.map((element) => ({ element, left: left[element] || 0, right: right[element] || 0 }));
  const charge = { left: totalCharge(reactants), right: totalCharge(products) };
  const problems = [];
  for (const a of atoms) {
    if (a.left !== a.right) problems.push(`${a.element}: ${a.left} nos reagentes, ${a.right} nos produtos`);
  }
  if (charge.left !== charge.right) problems.push(`carga: ${charge.left} nos reagentes, ${charge.right} nos produtos`);
  for (const sp of [...reactants, ...products]) {
    if (!Number.isInteger(sp.coef) || sp.coef < 1) problems.push(`coeficiente inválido (${sp.coef}) para ${sp.formula}`);
  }
  return { ok: problems.length === 0, atoms, charge, problems };
}

/** Massa total de cada lado (g, para os coeficientes em mol). */
export function sideMass(side, atomicMasses) {
  return side.reduce((acc, sp) => acc + molarMass(sp.formula, atomicMasses) * sp.coef, 0);
}

/** Coeficientes inteiros mínimos? (ex.: 4 H2 + 2 O2 → 4 H2O deveria ser 2 H2 + O2 → 2 H2O) */
export function hasMinimalCoefficients(reactants, products) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  return [...reactants, ...products].reduce((g, sp) => gcd(g, sp.coef), 0) === 1;
}

export function formatEquationHTML(reactants, products, { reversible = false, showStates = true } = {}) {
  const fmt = (side) =>
    side
      .map((sp) => {
        const coef = sp.coef > 1 ? `<span class="coef">${sp.coef}</span>` : '';
        const st = showStates && sp.state ? `<span class="state">(${STATE_LABEL[sp.state] ?? sp.state})</span>` : '';
        return `${coef}${formatFormulaHTML(sp.formula)}${st}`;
      })
      .join(' <span class="op">+</span> ');
  const arrow = reversible ? '⇌' : '→';
  return `${fmt(reactants)} <span class="arrow">${arrow}</span> ${fmt(products)}`;
}
