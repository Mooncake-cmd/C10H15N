// Número de oxidação (NOX) e análise de oxirredução. Puro (sem DOM).
//
// Regras do Toolbox K.1 de Atkins & Jones (p. F80), na ordem de prioridade do livro:
//   1. elemento sozinho (substância simples): 0;   2. a soma dos NOX é a carga da espécie;
//   F: −1;  grupos 1 e 2: +1 e +2;  H: +1 com ametais e −1 com metais (hidretos metálicos);
//   O: −2, exceto peróxidos (−1) e superóxidos (−½), que aparecem quando o −2 não fecha a soma;
//   Cl, Br, I: −1, exceto ligados a oxigênio ou a um halogênio acima no grupo.
// O elemento que sobra recebe o valor que fecha a soma (média, se houver mais de um átomo dele).
// Moléculas com estrutura de Lewis no jogo: NOX átomo por átomo, "quebrando" cada ligação e dando
// os elétrons ao átomo mais eletronegativo (Bernoulli v. 4, Frente C, Módulo 13, p. 31). Assim o
// propano tem carbonos −3 e −2 (não a média −8/3), e a esterificação não parece oxirredução: o C
// do ácido (+3) e o do álcool (−1) continuam iguais no éster.
// Compostos iônicos são resolvidos íon por íon: no NH4NO3, o N tem dois NOX (−3 no NH4⁺ e +5 no
// NO3⁻) — a média (+1) faria uma dupla troca parecer oxirredução.

import { parseFormula } from './formula.js';
import { lewisFor, valenceElectrons } from './vsepr.js';

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
/**
 * NOX átomo por átomo a partir da estrutura de Lewis: NOX = carga formal + Σ ordens das ligações −
 * elétrons de ligação que ficam com o átomo (todos se ele é o mais eletronegativo da ligação,
 * metade se empata, nenhum se é o menos eletronegativo).
 * @returns {{ [el]: {n,d}[] } | null} valores distintos de cada elemento
 */
export function oxidationStatesFromLewis(lewis, data) {
  const prof = oxidationProfileFromLewis(lewis, data);
  return prof && Object.fromEntries(Object.entries(prof).map(([el, list]) => [el, list.map((x) => x.v)]));
}

/** Como oxidationStatesFromLewis, mas com quantos átomos têm cada NOX: { el: [{ v, n }] }. */
export function oxidationProfileFromLewis(lewis, data) {
  const chi = (el) => data.elementsBySymbol.get(el)?.electronegativity;
  const out = {};
  for (let i = 0; i < lewis.atoms.length; i++) {
    const a = lewis.atoms[i];
    if (valenceElectrons(a.el, data) == null) return null;
    let bondSum = 0;
    let kept = 0;
    for (const b of lewis.bonds) {
      if (b.a !== i && b.b !== i) continue;
      const other = lewis.atoms[b.a === i ? b.b : b.a].el;
      bondSum += b.order;
      const d = other === a.el ? 0 : chi(a.el) - chi(other);
      if (d == null || Number.isNaN(d)) return null;
      kept += d > 0 ? 2 * b.order : d === 0 ? b.order : 0;
    }
    const f = frac(a.charge + bondSum - kept);
    const list = (out[a.el] ??= []);
    const hit = list.find((x) => fracEq(x.v, f));
    if (hit) hit.n++;
    else list.push({ v: f, n: 1 });
  }
  return out;
}

export function oxidationStates(sub, data) {
  if (sub.elementOf) return { [sub.elementOf]: [frac(0)] };
  const lewis = lewisFor(sub.id, data);
  if (lewis) {
    const byAtom = oxidationStatesFromLewis(lewis, data);
    if (byAtom) return byAtom;
  }
  const wrap = (m) => (m ? Object.fromEntries(Object.entries(m).map(([el, f]) => [el, [f]])) : null);
  // Íon: pela estrutura de Lewis do íon poliatômico, se houver; senão, pela fórmula.
  const ionStates = (formula) => {
    const l = data.structures?.ions?.[formula] ? lewisFor(formula, data) : null;
    return (l && oxidationStatesFromLewis(l, data)) ?? wrap(oxidationStatesOfFormula(formula, data));
  };
  const io = sub.ions;
  if (io) {
    const c = ionStates(io.cation.formula);
    const a = ionStates(io.anion.formula);
    if (c && a) {
      const out = { ...c };
      for (const [el, fs] of Object.entries(a)) {
        for (const f of fs) {
          if (!out[el]) out[el] = [f];
          else if (!out[el].some((x) => fracEq(x, f))) out[el] = [...out[el], f];
        }
      }
      return out;
    }
  }
  return wrap(oxidationStatesOfFormula(sub.formula, data));
}

/**
 * Perfil de NOX de uma substância: para cada elemento, os valores e quantos átomos (por fórmula)
 * têm cada um. Mesma lógica de oxidationStates (estrutura de Lewis, íon por íon ou fórmula).
 */
export function oxidationProfile(sub, data) {
  const count = (formula) => parseFormula(formula).atoms;
  if (sub.elementOf) return { [sub.elementOf]: [{ v: frac(0), n: count(sub.formula)[sub.elementOf] }] };
  const lewis = lewisFor(sub.id, data);
  if (lewis) {
    const p = oxidationProfileFromLewis(lewis, data);
    if (p) return p;
  }
  const fromFormula = (formula, times = 1) => {
    const ox = oxidationStatesOfFormula(formula, data);
    if (!ox) return null;
    const atoms = count(formula);
    return Object.fromEntries(Object.entries(ox).map(([el, v]) => [el, [{ v, n: atoms[el] * times }]]));
  };
  const ion = (formula, times) => {
    const l = data.structures?.ions?.[formula] ? lewisFor(formula, data) : null;
    const p = l && oxidationProfileFromLewis(l, data);
    return p ? Object.fromEntries(Object.entries(p).map(([el, list]) => [el, list.map((x) => ({ v: x.v, n: x.n * times }))])) : fromFormula(formula, times);
  };
  const io = sub.ions;
  if (io) {
    const c = ion(io.cation.formula, io.cation.count);
    const a = ion(io.anion.formula, io.anion.count);
    if (c && a) {
      const out = {};
      for (const part of [c, a]) {
        for (const [el, list] of Object.entries(part)) {
          for (const x of list) {
            const l = (out[el] ??= []);
            const hit = l.find((y) => fracEq(y.v, x.v));
            if (hit) hit.n += x.n;
            else l.push({ ...x });
          }
        }
      }
      return out;
    }
  }
  return fromFormula(sub.formula);
}

/**
 * Quem oxida e quem reduz numa reação.
 *
 * Um elemento oxida ou reduz quando muda o NOX dos seus átomos E também a média de cada molécula.
 * Assim: na esterificação os átomos mantêm o NOX (não é redox); na adição de H2O ou HCl ao eteno
 * um carbono sobe e o vizinho desce dentro da MESMA molécula (média igual: não é redox); e na
 * decomposição da água oxigenada o átomo que oxida e o que reduz vão para moléculas diferentes
 * (desproporcionamento: é redox).
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
  // Contagens (com os coeficientes) por NOX de átomo e por NOX médio de cada molécula.
  const key = (x) => String(Math.round(x * 1e6));
  const tally = (entries) => {
    const atom = {};
    const avg = {};
    for (const e of entries) {
      const prof = oxidationProfile(data.substancesById.get(e.id), data);
      for (const [el, list] of Object.entries(prof ?? {})) {
        const n = list.reduce((s, x) => s + x.n, 0);
        const mean = list.reduce((s, x) => s + fracValue(x.v) * x.n, 0) / n;
        for (const x of list) (atom[el] ??= {})[key(fracValue(x.v))] = (atom[el]?.[key(fracValue(x.v))] ?? 0) + e.coef * x.n;
        (avg[el] ??= {})[key(mean)] = (avg[el]?.[key(mean)] ?? 0) + e.coef * n;
      }
    }
    return { atom, avg };
  };
  const tr = tally(reaction.reactants);
  const tp = tally(reaction.products);
  const same = (a = {}, b = {}) => Object.keys({ ...a, ...b }).every((k) => Math.abs((a[k] ?? 0) - (b[k] ?? 0)) < 1e-9);
  const changes = [];
  const reducers = new Set();
  const oxidizers = new Set();
  const els = [...new Set(species.flatMap((s) => Object.keys(s.ox)))];
  for (const el of els) {
    if (same(tr.atom[el], tp.atom[el]) || same(tr.avg[el], tp.avg[el])) continue;
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
