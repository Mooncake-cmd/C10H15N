// Balanceamento automático de equações (Fase 2).
//
// Monta a matriz "elemento (e carga) × espécie", com os produtos de sinal trocado, e procura o
// espaço nulo com aritmética exata de frações (BigInt): nada de arredondar números de ponto
// flutuante. Se o espaço nulo tem dimensão 1, a solução é única a menos de escala e vira os
// menores coeficientes inteiros positivos. Dimensão 0 = impossível balancear com essas espécies;
// dimensão > 1 = há mais de um jeito (a equação mistura reações independentes) e não escolhemos.
//
// Referência do método: ATKINS & JONES, Chemical Principles, 5. ed., seção H.2 (p. F62–F64)
// para o balanceamento por inspeção; o método da matriz dá o mesmo resultado de forma sistemática.

import { parseFormula } from './formula.js';

export class BalanceError extends Error {}

const abs = (a) => (a < 0n ? -a : a);
const gcd = (a, b) => {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

/** Fração exata { n, d } com d > 0, sempre simplificada. */
function frac(n, d = 1n) {
  if (d === 0n) throw new Error('divisão por zero');
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
}
const sub = (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => frac(a.n * b.n, a.d * b.d);
const div = (a, b) => frac(a.n * b.d, a.d * b.n);
const isZero = (a) => a.n === 0n;

/** Forma escalonada reduzida (in place). Devolve as colunas-pivô. */
function rref(m) {
  const rows = m.length;
  const cols = m[0]?.length ?? 0;
  const pivots = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    const p = m.findIndex((row, i) => i >= r && !isZero(row[c]));
    if (p < 0) continue;
    [m[r], m[p]] = [m[p], m[r]];
    const pv = m[r][c];
    m[r] = m[r].map((x) => div(x, pv));
    for (let i = 0; i < rows; i++) {
      if (i === r || isZero(m[i][c])) continue;
      const f = m[i][c];
      m[i] = m[i].map((x, j) => sub(x, mul(f, m[r][j])));
    }
    pivots.push(c);
    r++;
  }
  return pivots;
}

/**
 * Balanceia reagentes → produtos (fórmulas; podem ter carga, ex.: "Cu^2+").
 * @param {string[]} reactants
 * @param {string[]} products
 * @returns {{ reactants: number[], products: number[] }} menores coeficientes inteiros
 * @throws {BalanceError} se não houver solução única com todos os coeficientes positivos
 */
export function balance(reactants, products) {
  const species = [...reactants, ...products];
  if (!reactants.length || !products.length) throw new BalanceError('A equação precisa de reagentes e produtos.');
  const parsed = species.map((f) => parseFormula(f));
  const elements = [...new Set(parsed.flatMap((p) => Object.keys(p.atoms)))].sort();
  const sign = (j) => (j < reactants.length ? 1n : -1n);
  const m = elements.map((el) => parsed.map((p, j) => frac(BigInt(p.atoms[el] ?? 0) * sign(j))));
  if (parsed.some((p) => p.charge !== 0)) m.push(parsed.map((p, j) => frac(BigInt(p.charge) * sign(j))));

  const pivots = rref(m);
  const free = species.map((_, j) => j).filter((j) => !pivots.includes(j));
  if (free.length === 0) throw new BalanceError('Impossível balancear: os átomos não fecham com essas substâncias.');
  if (free.length > 1) throw new BalanceError('Mais de uma forma de balancear: a equação mistura reações independentes.');

  // Variável livre = 1; as variáveis-pivô saem das linhas da forma reduzida.
  const f = free[0];
  const x = species.map(() => frac(0n));
  x[f] = frac(1n);
  pivots.forEach((c, i) => (x[c] = frac(-m[i][f].n, m[i][f].d)));

  const lcm = x.reduce((l, v) => (l * v.d) / gcd(l, v.d), 1n);
  let ints = x.map((v) => (v.n * lcm) / v.d);
  if (ints.every((v) => v <= 0n)) ints = ints.map((v) => -v);
  if (ints.some((v) => v <= 0n)) throw new BalanceError('Não há balanceamento com todos os coeficientes positivos: essas substâncias não formam essa reação.');
  const g = ints.reduce((a, b) => gcd(a, b));
  const coefs = ints.map((v) => Number(v / g));
  return { reactants: coefs.slice(0, reactants.length), products: coefs.slice(reactants.length) };
}
