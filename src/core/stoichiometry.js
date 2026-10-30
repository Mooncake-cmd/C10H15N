// Estequiometria (Fase 2): massa/mol/volume de gás/solução → mol → razão molar → produtos,
// reagente limitante e rendimento. Segue as seções G, L e M de Atkins & Jones (p. F54, F85–F99)
// e a lei dos gases ideais (seção 4.5, p. 141–142).

import { molarMass } from './formula.js';

/**
 * Volume de 1 mol de gás ideal a 25 °C e 1 atm: V = nRT/P = 0,082057 × 298,15 / 1 ≈ 24,47 L.
 * (A 0 °C e 1 atm seria cerca de 22,4 L, como na p. 140.)
 */
export const MOLAR_VOLUME_L = 24.47;

/**
 * Quantidade em mol a partir de uma "medida":
 *   número (gramas, para compatibilidade) | { g } | { mol } | { L } (gás a 25 °C, 1 atm) | { mL, M } (solução: mL × mol/L)
 * @returns {number | null} null se a medida for inválida
 */
export function molesOf(measure, molarMassValue) {
  const ok = (x) => Number.isFinite(x) && x >= 0;
  if (typeof measure === 'number') return ok(measure) ? measure / molarMassValue : null;
  if (!measure || typeof measure !== 'object') return null;
  if ('g' in measure) return ok(measure.g) ? measure.g / molarMassValue : null;
  if ('mol' in measure) return ok(measure.mol) ? measure.mol : null;
  if ('L' in measure) return ok(measure.L) ? measure.L / MOLAR_VOLUME_L : null;
  if ('mL' in measure && 'M' in measure) return ok(measure.mL) && ok(measure.M) ? (measure.mL / 1000) * measure.M : null;
  return null;
}

/** Rendimento percentual: obtido ÷ teórico × 100 (seção M, p. F95). */
export const percentYield = (actual, theoretical) => (theoretical > 0 ? (100 * actual) / theoretical : NaN);

/**
 * @param reaction reação (curada ou gerada) com reactants/products { id, coef, state? }
 * @param data dados do jogo (substancesById, atomicMasses)
 * @param given { [idDoReagente]: medida } — pelo menos um reagente (ver molesOf)
 * @returns {{
 *   extent: number,                // quantas "rodadas" da equação, em mol
 *   limiting: string | null,       // reagente que acaba primeiro (null se só um foi informado)
 *   reactants: { id, formula, coef, molarMass, mol: number|null, given: number|null, used: number, left: number|null }[],
 *   products: { id, formula, coef, molarMass, gas: boolean, mol: number, grams: number, liters: number|null }[]
 * }}  massas em gramas; `given`/`left` em gramas
 */
export function stoichiometry(reaction, data, given) {
  const info = (e) => {
    const s = data.substancesById.get(e.id);
    return { id: e.id, formula: s.formula, coef: e.coef, molarMass: molarMass(s.formula, data.atomicMasses), gas: (e.state ?? s.state) === 'g' };
  };
  const reactants = reaction.reactants.map(info).map((r) => ({ ...r, mol: given && r.id in given ? molesOf(given[r.id], r.molarMass) : null }));
  const known = reactants.filter((r) => r.mol !== null);
  if (!known.length) throw new Error('Informe a quantidade de pelo menos um reagente.');

  // Cada reagente informado permite no máximo mol/coef "rodadas" da equação; o menor manda.
  const min = known.map((r) => ({ id: r.id, n: r.mol / r.coef })).reduce((a, b) => (b.n < a.n ? b : a));
  const extent = min.n;
  const limiting = known.length > 1 ? min.id : null;

  return {
    extent,
    limiting,
    reactants: reactants.map((r) => {
      const g = r.mol === null ? null : r.mol * r.molarMass;
      const used = extent * r.coef * r.molarMass;
      return { ...r, given: g, used, left: g === null ? null : Math.max(0, g - used) };
    }),
    products: reaction.products.map(info).map((p) => {
      const mol = extent * p.coef;
      return { ...p, mol, grams: mol * p.molarMass, liters: p.gas ? mol * MOLAR_VOLUME_L : null };
    }),
  };
}
