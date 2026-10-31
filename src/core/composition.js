// Composição em massa, fórmula mínima e as leis ponderais (Proust e Dalton). Puro (sem DOM).
//
// Atkins & Jones, seção F (p. F45–F51): composição percentual em massa (Exemplo F.1), fórmula
// empírica a partir da composição (F.2–F.3) e fórmula molecular (F.4); lei da composição
// constante (glossário, p. B16). Bernoulli v. 1, Frente C, Módulo 01 (p. 36): leis de Proust e
// de Dalton; Frente D, Módulo 02: cálculos de fórmulas.

import { parseFormula, molarMass } from './formula.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** % em massa de cada elemento: [{ el, count, mass, pct }], na ordem da fórmula. */
export function massComposition(formula, masses) {
  const { atoms } = parseFormula(formula);
  const total = molarMass(formula, masses);
  return Object.entries(atoms).map(([el, count]) => ({ el, count, mass: count * masses[el], pct: (100 * count * masses[el]) / total }));
}

/** Escreve contagens de átomos como fórmula: { C: 3, H: 4, O: 3 } → "C3H4O3". */
export const formulaFromCounts = (counts) => Object.entries(counts).map(([el, n]) => `${el}${n > 1 ? n : ''}`).join('');

/** Fórmula mínima (empírica): divide todos os índices pelo MDC. CH3COOH → CH2O. */
export function empiricalFormula(formula) {
  const { atoms } = parseFormula(formula);
  const g = Object.values(atoms).reduce(gcd);
  return { formula: formulaFromCounts(Object.fromEntries(Object.entries(atoms).map(([el, n]) => [el, n / g]))), factor: g };
}

/**
 * Fórmula mínima a partir da composição em massa (%), como nos Exemplos F.2 e F.3:
 * mol de cada elemento em 100 g → divide pelo menor → multiplica até ficarem inteiros.
 * @returns {{ counts: object, formula: string, ratios: object } | null}
 */
export function empiricalFromPercent(pcts, masses, tolerance = 0.1) {
  const els = Object.keys(pcts);
  if (!els.length || els.some((el) => !(pcts[el] > 0) || !masses[el])) return null;
  const mol = Object.fromEntries(els.map((el) => [el, pcts[el] / masses[el]]));
  const min = Math.min(...Object.values(mol));
  const ratios = Object.fromEntries(els.map((el) => [el, mol[el] / min]));
  for (let k = 1; k <= 12; k++) {
    const scaled = els.map((el) => ratios[el] * k);
    if (scaled.every((x) => Math.abs(x - Math.round(x)) <= tolerance)) {
      const counts = Object.fromEntries(els.map((el, i) => [el, Math.round(scaled[i])]));
      return { counts, formula: formulaFromCounts(counts), ratios };
    }
  }
  return null;
}

/** Fórmula molecular: a fórmula mínima vezes n = massa molar ÷ massa da fórmula mínima (Exemplo F.4). */
export function molecularFromEmpirical(empirical, molarMassValue, masses) {
  const n = Math.round(molarMassValue / molarMass(empirical, masses));
  if (n < 1) return null;
  const { atoms } = parseFormula(empirical);
  return { n, formula: formulaFromCounts(Object.fromEntries(Object.entries(atoms).map(([el, c]) => [el, c * n]))) };
}

/** Lei de Proust: em um composto, a razão entre as massas de dois elementos é sempre a mesma. */
export function massRatio(formula, masses) {
  const comp = massComposition(formula, masses);
  if (comp.length < 2) return null;
  const [a, ...rest] = comp;
  return { base: a, others: rest.map((x) => ({ ...x, perGram: x.mass / a.mass })) };
}

/**
 * Lei de Dalton (proporções múltiplas): dois compostos dos mesmos dois elementos. Fixada a massa
 * do primeiro elemento, as massas do segundo estão numa razão de números inteiros pequenos.
 * @returns {{ a: string, b: string, ratio: [number, number] } | null}
 */
export function multipleProportions(f1, f2) {
  const x = parseFormula(f1).atoms;
  const y = parseFormula(f2).atoms;
  const els = Object.keys(x);
  if (els.length !== 2 || Object.keys(y).length !== 2 || !els.every((el) => y[el])) return null;
  const [a, b] = els;
  // massa de b por massa fixa de a ∝ (n_b / n_a): razão entre os dois compostos
  let p = x[b] * y[a];
  let q = y[b] * x[a];
  const g = gcd(p, q);
  p /= g;
  q /= g;
  if (p === q) return null; // mesma proporção: é o mesmo composto (ou múltiplo dele)
  return { a, b, ratio: [p, q] };
}

/** Outras substâncias do jogo feitas exatamente dos mesmos dois elementos (para a lei de Dalton). */
export function sameElementsPartners(formula, substances) {
  const els = Object.keys(parseFormula(formula).atoms).sort().join(',');
  if (els.split(',').length !== 2) return [];
  return substances.filter((s) => s.formula !== formula && Object.keys(parseFormula(s.formula).atoms).sort().join(',') === els && multipleProportions(formula, s.formula));
}
