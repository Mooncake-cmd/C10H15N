// Energia das reações (Fase 3A): ΔH°, ΔG° e ΔS° a 298 K pela lei de Hess, a partir das
// grandezas de formação de data/thermo.json. Puro (sem DOM).
//
//   ΔrH° = Σ ν·ΔfH°(produtos) − Σ ν·ΔfH°(reagentes)   (idem para ΔG° e S°)
//
// Atkins & Jones, seções 7.16–7.18 (lei de Hess, entalpias de formação, p. 265–271) e 8.13
// (energia livre de Gibbs, p. 318); Atkins FQ, tópico 2C (p. 50–57).
//
// Nunca estimamos: se falta o dado de uma espécie, o resultado diz qual falta e fica null.

import { parseFormula } from './formula.js';

export const T_STD = 298.15; // K

const keyOf = (formula, state) => `${formula}(${state})`;

/**
 * Dados de formação de uma espécie: da tabela; de um composto iônico dissolvido, pela soma dos
 * íons; de um elemento no estado de referência, zero por definição.
 * @returns {{ dH: number|null, dG: number|null, S: number|null, how: 'tabela'|'íons'|'referência', refs: object[] } | null}
 */
export function speciesThermo(sub, state, data) {
  const table = data.thermo ?? {};
  const t = table[keyOf(sub.formula, state)];
  if (t) return { dH: t.dH ?? null, dG: t.dG ?? null, S: t.S ?? null, how: 'tabela', refs: [{ ref: t.ref, page: t.page }] };

  // Elemento no estado de referência (a forma elementar do jogo no estado usual): ΔfH° = ΔfG° = 0.
  if (sub.elementOf && state === sub.state) {
    return { dH: 0, dG: 0, S: null, how: 'referência', refs: [] };
  }

  // Composto iônico (não ácido fraco) dissolvido: soma dos íons, como fazem as tabelas.
  const io = sub.ions;
  if (state === 'aq' && io && !sub.categories.includes('acido')) {
    const c = table[keyOf(io.cation.formula, 'aq')];
    const a = table[keyOf(io.anion.formula, 'aq')];
    if (c && a) {
      const sum = (k) => (c[k] == null || a[k] == null ? null : io.cation.count * c[k] + io.anion.count * a[k]);
      return { dH: sum('dH'), dG: sum('dG'), S: sum('S'), how: 'íons', refs: [{ ref: c.ref, page: c.page }, { ref: a.ref, page: a.page }] };
    }
  }
  return null;
}

/**
 * Grandezas de uma reação, para a equação como está escrita (por "mol de reação").
 * @returns {{ dH: number|null, dG: number|null, dS: number|null, missing: string[], refs: object[] }}
 *   dH e dG em kJ; dS em J/K. `missing`: espécies sem dado (fórmula(estado)).
 */
export function reactionThermo(reaction, data) {
  const missing = [];
  const refs = new Map();
  const tot = { dH: 0, dG: 0, S: 0 };
  const ok = { dH: true, dG: true, S: true };
  const side = (entries, sign) => {
    for (const e of entries) {
      const sub = data.substancesById.get(e.id);
      const state = e.state ?? sub.state;
      const d = speciesThermo(sub, state, data);
      if (!d) {
        missing.push(keyOf(sub.formula, state));
        ok.dH = ok.dG = ok.S = false;
        continue;
      }
      for (const r of d.refs) refs.set(`${r.ref}|${r.page}`, r);
      for (const k of ['dH', 'dG', 'S']) {
        if (d[k] == null) ok[k] = false;
        else tot[k] += sign * e.coef * d[k];
      }
    }
  };
  side(reaction.reactants, -1);
  side(reaction.products, +1);
  const round = (x, n) => Math.round(x * 10 ** n) / 10 ** n;
  return {
    dH: ok.dH ? round(tot.dH, 2) : null,
    dG: ok.dG ? round(tot.dG, 2) : null,
    dS: ok.S ? round(tot.S, 2) : null,
    missing,
    refs: [...refs.values()],
  };
}

/** Classificação para o jogador. */
export function describeEnergy(t) {
  return {
    heat: t.dH == null ? null : t.dH < 0 ? 'libera' : t.dH > 0 ? 'absorve' : 'neutro',
    favored: t.dG == null ? null : t.dG < 0,
  };
}

/** Calor trocado para uma certa extensão de reação (mol de "rodadas"): q = ξ·ΔH° (negativo = liberado). */
export const heatFor = (extentMol, dH) => (dH == null ? null : extentMol * dH);

/** Átomos de cada elemento numa fórmula (atalho usado pelos testes de consistência). */
export const atomsOf = (formula) => parseFormula(formula).atoms;
