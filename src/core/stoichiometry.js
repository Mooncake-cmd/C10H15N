// Estequiometria (Fase 2): massa → mol → razão molar → mol → massa, e reagente limitante.
// Segue o procedimento das seções L e M de Atkins & Jones (p. F85–F99).

import { molarMass } from './formula.js';

/**
 * @param reaction reação (curada ou gerada) com reactants/products { id, coef }
 * @param data dados do jogo (substancesById, atomicMasses)
 * @param given { [idDoReagente]: gramas } — pelo menos um reagente
 * @returns {{
 *   extent: number,                // "quantas vezes" a equação acontece, em mol
 *   limiting: string | null,       // reagente que acaba primeiro (null se só um foi informado)
 *   reactants: { id, formula, coef, molarMass, given: number|null, mol: number|null, used: number, left: number|null }[],
 *   products: { id, formula, coef, molarMass, mol: number, grams: number }[]
 * }}
 */
export function stoichiometry(reaction, data, given) {
  const info = (e) => {
    const s = data.substancesById.get(e.id);
    return { id: e.id, formula: s.formula, coef: e.coef, molarMass: molarMass(s.formula, data.atomicMasses) };
  };
  const reactants = reaction.reactants.map(info);
  const known = reactants.filter((r) => Number.isFinite(given?.[r.id]) && given[r.id] >= 0);
  if (!known.length) throw new Error('Informe a massa de pelo menos um reagente.');

  // Cada reagente informado permite no máximo mol/coef "rodadas" da equação; o menor manda.
  const rounds = known.map((r) => ({ id: r.id, n: given[r.id] / r.molarMass / r.coef }));
  const min = rounds.reduce((a, b) => (b.n < a.n ? b : a));
  const extent = min.n;
  const limiting = known.length > 1 ? min.id : null;

  return {
    extent,
    limiting,
    reactants: reactants.map((r) => {
      const g = Number.isFinite(given?.[r.id]) ? given[r.id] : null;
      const used = extent * r.coef * r.molarMass;
      return { ...r, given: g, mol: g === null ? null : g / r.molarMass, used, left: g === null ? null : Math.max(0, g - used) };
    }),
    products: reaction.products.map(info).map((p) => ({ ...p, mol: extent * p.coef, grams: extent * p.coef * p.molarMass })),
  };
}
