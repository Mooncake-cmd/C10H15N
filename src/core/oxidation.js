// Número de oxidação (NOX) e análise de oxirredução. Puro (sem DOM).
//
// Regras do Toolbox K.1 de Atkins & Jones (p. F80), na ordem de prioridade do livro:
//   1. elemento sozinho (substância simples): 0;   2. a soma dos NOX é a carga da espécie;
//   F: −1;  grupos 1 e 2: +1 e +2;  H: +1 com ametais e −1 com metais (hidretos metálicos);
//   O: −2, exceto peróxidos (−1) e superóxidos (−½), que aparecem quando o −2 não fecha a soma;
//   Cl, Br, I: −1, exceto ligados a oxigênio ou a um halogênio acima no grupo.
// O elemento que sobra recebe o valor que fecha a soma (média, se houver mais de um átomo dele:
// no C3H8, o C fica com −8/3, como no ensino médio — Bernoulli v. 4, Frente C, Módulo 13).
// Compostos iônicos são resolvidos íon por íon: no NH4NO3, o N tem dois NOX (−3 no NH4⁺ e +5 no
// NO3⁻) — a média (+1) faria uma dupla troca parecer oxirredução.

import { parseFormula } from './formula.js';

const METAL_FAMILIES = new Set(['metal-alcalino', 'metal-alcalino-terroso', 'metal-de-transicao', 'outro-metal', 'lantanideo', 'actinideo']);
const HALOGEN_ORDER = ['F', 'Cl', 'Br', 'I'];

/** Fração reduzida {n, d}, com d > 0. */
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
export function frac(n, d = 1) {
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g, d: (s * d) / g };
}
export const fracValue = (f) => f.n / f.d;
const fracEq = (a, b) => a.n * b.d === b.n * a.d;

/** "+2", "−1", "0", "−8/3" (com sinal de menos tipográfico). */
export function formatOx(f) {
  if (f.n === 0) return '0';
  const sign = f.n > 0 ? '+' : '−';
  return `${sign}${Math.abs(f.n)}${f.d > 1 ? `/${f.d}` : ''}`;
}

/** NOX de cada elemento de uma fórmula (sem usar íons). null se as regras não bastam. */
export function oxidationStatesOfFormula(formula, data) {
  const { atoms, charge } = parseFormula(formula);
  const els = Object.keys(atoms);
  if (els.length === 1) return { [els[0]]: frac(charge, atoms[els[0]]) };
  const info = (s) => data.elementsBySymbol.get(s);
  const isMetal = (s) => METAL_FAMILIES.has(info(s)?.family);
  const fixed = new Map();
  for (const s of els) {
    const e = info(s);
    if (s === 'F') fixed.set(s, -1);
    else if (e?.group === 1 && s !== 'H') fixed.set(s, 1);
    else if (e?.group === 2) fixed.set(s, 2);
    else if (s === 'H') fixed.set(s, els.filter((x) => x !== 'H').every(isMetal) ? -1 : 1);
    else if (s === 'O' && !els.includes('F')) fixed.set(s, -2);
    else if (HALOGEN_ORDER.includes(s)) {
      const higher = HALOGEN_ORDER.slice(0, HALOGEN_ORDER.indexOf(s));
      if (!els.includes('O') && !els.some((x) => higher.includes(x))) fixed.set(s, -1);
    }
  }
  const solve = (assigned) => {
    const unknown = els.filter((s) => !assigned.has(s));
    const rest = charge - [...assigned].reduce((a, [s, v]) => a + v * atoms[s], 0);
    if (unknown.length === 1) return { ...Object.fromEntries([...assigned].map(([s, v]) => [s, frac(v)])), [unknown[0]]: frac(rest, atoms[unknown[0]]) };
    if (unknown.length === 0 && rest === 0) return Object.fromEntries([...assigned].map(([s, v]) => [s, frac(v)]));
    return null;
  };
  const res = solve(fixed);
  if (res) return res;
  // O −2 não fecha a soma: peróxido (O2²⁻) ou superóxido (O2⁻) — o oxigênio fica com o que sobra.
  if (fixed.get('O') === -2 && els.filter((s) => !fixed.has(s)).length === 0) {
    const relaxed = new Map(fixed);
    relaxed.delete('O');
    return solve(relaxed);
  }
  return null;
}

/**
 * NOX de uma substância do jogo, por elemento, como lista de valores distintos ("sítios"):
 * compostos iônicos íon por íon; os demais pela fórmula.
 * @returns {{ [el: string]: {n,d}[] } | null}
 */
export function oxidationStates(sub, data) {
  if (sub.elementOf) return { [sub.elementOf]: [frac(0)] };
  const wrap = (m) => (m ? Object.fromEntries(Object.entries(m).map(([el, f]) => [el, [f]])) : null);
  const io = sub.ions;
  if (io) {
    const c = oxidationStatesOfFormula(io.cation.formula, data);
    const a = oxidationStatesOfFormula(io.anion.formula, data);
    if (c && a) {
      const out = wrap(c);
      for (const [el, f] of Object.entries(a)) {
        if (!out[el]) out[el] = [f];
        else if (!out[el].some((x) => fracEq(x, f))) out[el].push(f);
      }
      return out;
    }
  }
  return wrap(oxidationStatesOfFormula(sub.formula, data));
}

/**
 * Quem oxida e quem reduz numa reação.
 * @returns {{ known: boolean, species: { id, ox }[], changes: { el, transitions: { from, to, dir: 'oxida'|'reduz', in: string[], out: string[] }[] }[],
 *   reducers: string[], oxidizers: string[] }}
 */
export function redoxAnalysis(reaction, data) {
  const describe = (entries) =>
    entries.map((e) => {
      const sub = data.substancesById.get(e.id);
      return { id: e.id, formula: sub.formula, ox: oxidationStates(sub, data) };
    });
  const R = describe(reaction.reactants);
  const P = describe(reaction.products);
  const species = [...R, ...P];
  if (species.some((s) => !s.ox)) return { known: false, species, changes: [], reducers: [], oxidizers: [] };
  const values = (side, el) => {
    const out = [];
    for (const s of side) for (const v of s.ox[el] ?? []) {
      const hit = out.find((x) => fracEq(x.v, v));
      if (hit) hit.ids.push(s.id);
      else out.push({ v, ids: [s.id] });
    }
    return out;
  };
  const changes = [];
  const reducers = new Set();
  const oxidizers = new Set();
  const els = [...new Set(species.flatMap((s) => Object.keys(s.ox)))];
  for (const el of els) {
    const rv = values(R, el);
    const pv = values(P, el);
    const inB = (list, v) => list.some((x) => fracEq(x.v, v));
    const from = rv.filter((x) => !inB(pv, x.v));
    const to = pv.filter((x) => !inB(rv, x.v));
    if (!from.length && !to.length) continue;
    const F = from.length ? from : rv;
    const T = to.length ? to : pv;
    const transitions = [];
    for (const f of F) for (const t of T) {
      if (fracEq(f.v, t.v)) continue;
      const dir = fracValue(t.v) > fracValue(f.v) ? 'oxida' : 'reduz';
      transitions.push({ from: f.v, to: t.v, dir, in: f.ids, out: t.ids });
      for (const id of f.ids) (dir === 'oxida' ? reducers : oxidizers).add(id);
    }
    if (transitions.length) changes.push({ el, transitions });
  }
  return { known: true, species, changes, reducers: [...reducers], oxidizers: [...oxidizers] };
}

/** Elétrons perdidos por átomo numa transição (positivo = perde). */
export const electronsPerAtom = (t) => fracValue(t.to) - fracValue(t.from);
