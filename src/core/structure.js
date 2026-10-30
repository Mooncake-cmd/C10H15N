// Estruturas 2D das substâncias (data/structures.json): desenho para ícones e bancada,
// "unidade-fórmula" para a animação das reações, e verificações usadas pelos testes.
//
// Puro (sem DOM). Coordenadas em comprimentos de ligação (≈ 1), y para baixo.
// Uma estrutura é { kind, atoms: [{ el, x, y, charge }], bonds: [{ a, b, order }] }.

import { parseFormula } from './formula.js';

/** Raio usado para calcular caixas e espaçamentos (o desenho usa raios menores). */
export const LAYOUT_RADIUS = 0.5;
const ION_GAP = 0.25;
const UNIT_GAP = 0.6;
const SPECIES_GAP = 1.6;

/**
 * Valência esperada (soma das ordens de ligação) por elemento e carga formal, em moléculas e
 * íons poliatômicos. Elemento fora da tabela não pode aparecer ligado.
 */
const VALENCE = {
  H: { 0: [1] },
  C: { 0: [4] },
  N: { 0: [3], 1: [4] },
  O: { 0: [2], '-1': [1], 1: [3] },
  S: { 0: [2, 4, 6] },
  Cl: { 0: [1] },
};

const toAtom = ([el, x, y, charge = 0]) => ({ el, x, y, charge });
const fromEntry = (e) => ({
  atoms: e.atoms.map(toAtom),
  bonds: e.bonds.map(([a, b, order]) => ({ a, b, order })),
  ...(e.radical ? { radical: true } : {}),
});

export function bbox(atoms, r = LAYOUT_RADIUS) {
  const xs = atoms.map((a) => a.x);
  const ys = atoms.map((a) => a.y);
  return { minX: Math.min(...xs) - r, maxX: Math.max(...xs) + r, minY: Math.min(...ys) - r, maxY: Math.max(...ys) + r };
}

/** Desloca a estrutura para que o centro da caixa fique em (cx, cy). */
function centerAt(struct, cx = 0, cy = 0) {
  const b = bbox(struct.atoms);
  const dx = cx - (b.minX + b.maxX) / 2;
  const dy = cy - (b.minY + b.maxY) / 2;
  return { ...struct, atoms: struct.atoms.map((a) => ({ ...a, x: a.x + dx, y: a.y + dy })) };
}

/** Estrutura de um íon: poliatômicos vêm de structures.json; monoatômicos, da fórmula. */
export function ionStructure(formula, data) {
  const entry = data.structures.ions[formula];
  if (entry) return fromEntry(entry);
  const { atoms, charge } = parseFormula(formula);
  const els = Object.entries(atoms);
  if (els.length === 1 && els[0][1] === 1) return { atoms: [{ el: els[0][0], x: 0, y: 0, charge }], bonds: [] };
  return null;
}

/** Junta estruturas lado a lado (centradas em y = 0), com `gap` entre as caixas. */
function row(structs, gap) {
  const atoms = [];
  const bonds = [];
  let x = 0;
  for (const s of structs) {
    const c = centerAt(s);
    const b = bbox(c.atoms);
    const dx = x - b.minX;
    const base = atoms.length;
    c.atoms.forEach((a) => atoms.push({ ...a, x: a.x + dx }));
    c.bonds.forEach((bd) => bonds.push({ ...bd, a: bd.a + base, b: bd.b + base }));
    x += b.maxX - b.minX + gap;
  }
  return centerAt({ atoms, bonds });
}

/**
 * Unidade-fórmula de um composto iônico: os íons alternados em fila, com o grupo mais numeroso
 * nas pontas (O Fe O Fe O; Li CO3 Li; Na Cl).
 */
function ionicUnit(cation, anion, data) {
  const cat = ionStructure(cation.formula, data);
  const an = ionStructure(anion.formula, data);
  if (!cat || !an) return null;
  const [major, nMajor, minor, nMinor] = anion.count > cation.count ? [an, anion.count, cat, cation.count] : [cat, cation.count, an, anion.count];
  const seq = [];
  let a = nMajor;
  let b = nMinor;
  while (a > 0 || b > 0) {
    if (a > 0) seq.push(major), a--;
    if (b > 0) seq.push(minor), b--;
  }
  return row(seq, ION_GAP);
}

export function structureKind(sub, data) {
  const entry = data.structures.substances[sub.id];
  if (entry) return entry.kind;
  if (sub.elementOf && sub.categories.includes('gas-nobre')) return 'atom';
  if (sub.elementOf && sub.categories.includes('metal')) return 'lattice';
  if (sub.ions && !sub.categories.includes('acido')) return 'ionic';
  return null;
}

/** Átomos da fórmula soltos em fila (metais, gases nobres e formas simplificadas como "S"). */
function looseAtoms(formula) {
  const atoms = [];
  for (const [el, n] of Object.entries(parseFormula(formula).atoms)) {
    for (let i = 0; i < n; i++) atoms.push({ el, x: atoms.length * 1.05, y: 0, charge: 0 });
  }
  return centerAt({ atoms, bonds: [] });
}

/**
 * Unidade-fórmula: exatamente os átomos da fórmula do jogo. É o que entra na animação, para que
 * os átomos de reagentes e produtos casem um a um (conservação).
 */
export function formulaUnit(sub, data) {
  const kind = structureKind(sub, data);
  const entry = data.structures.substances[sub.id];
  let s = null;
  if (kind === 'molecule') s = fromEntry(entry);
  else if (kind === 'ionic') {
    const { cation, anion } = entry ?? sub.ions;
    s = ionicUnit(cation, anion, data);
  } else if (kind) s = looseAtoms(sub.formula);
  return s && { kind, ...centerAt(s) };
}

/** Desenho para mostrar a substância (ícones, bancada): metais e redes aparecem como um trecho. */
export function displayStructure(sub, data) {
  const kind = structureKind(sub, data);
  if (kind === 'network') return { kind, ...centerAt(fromEntry(data.structures.substances[sub.id])) };
  if (kind === 'lattice') {
    const atoms = [{ el: sub.elementOf, x: 0, y: 0, charge: 0 }];
    for (let k = 0; k < 6; k++) atoms.push({ el: sub.elementOf, x: Math.cos((k * Math.PI) / 3), y: Math.sin((k * Math.PI) / 3), charge: 0 });
    return { kind, atoms, bonds: [] };
  }
  if (kind === 'atom') {
    const pos = [[-1, 0.35], [0.15, -0.4], [1.2, 0.3]];
    return { kind, atoms: pos.map(([x, y]) => ({ el: sub.elementOf, x, y, charge: 0 })), bonds: [] };
  }
  return formulaUnit(sub, data);
}

/**
 * Monta um lado da equação: cada espécie repetida `coef` vezes, espécies separadas por "+".
 * @param side [{ id, coef }]
 * @returns { atoms, bonds, plus: [x], width, height }
 */
export function layoutSide(side, data) {
  const atoms = [];
  const bonds = [];
  const plus = [];
  let x = 0;
  side.forEach((entry, i) => {
    if (i > 0) {
      plus.push(x - UNIT_GAP + SPECIES_GAP / 2);
      x += SPECIES_GAP - UNIT_GAP;
    }
    const unit = formulaUnit(data.substancesById.get(entry.id), data);
    if (!unit) throw new Error(`Sem estrutura para ${entry.id}`);
    const b = bbox(unit.atoms);
    for (let k = 0; k < entry.coef; k++) {
      const dx = x - b.minX;
      const base = atoms.length;
      unit.atoms.forEach((a) => atoms.push({ ...a, x: a.x + dx, species: i }));
      unit.bonds.forEach((bd) => bonds.push({ ...bd, a: bd.a + base, b: bd.b + base }));
      x += b.maxX - b.minX + UNIT_GAP;
    }
  });
  const width = x - UNIT_GAP;
  const shift = -width / 2;
  const box = bbox(atoms);
  return {
    atoms: atoms.map((a) => ({ ...a, x: a.x + shift })),
    bonds,
    plus: plus.map((p) => p + shift),
    width,
    height: box.maxY - box.minY,
  };
}

/**
 * Casa cada átomo dos reagentes com um átomo dos produtos do mesmo elemento, em ordem da esquerda
 * para a direita (movimento curto). Devolve match[i] = índice no lado direito, ou null se sobrar
 * átomo — o que nunca acontece numa equação balanceada.
 */
export function pairAtoms(left, right) {
  const match = new Array(left.length).fill(null);
  const byEl = (list) => {
    const m = new Map();
    list.forEach((a, i) => (m.get(a.el) ?? m.set(a.el, []).get(a.el)).push(i));
    for (const idx of m.values()) idx.sort((p, q) => list[p].x - list[q].x || list[p].y - list[q].y);
    return m;
  };
  const L = byEl(left);
  const R = byEl(right);
  for (const [el, li] of L) {
    const ri = R.get(el) ?? [];
    li.forEach((p, k) => (match[p] = ri[k] ?? null));
  }
  return match;
}

/**
 * Problemas de uma estrutura em relação à fórmula esperada (lista vazia = ok).
 * `covalent`: confere valências (moléculas e íons poliatômicos).
 * `exactAtoms`: os átomos têm de ser exatamente os da fórmula (falso para trechos de rede).
 */
export function checkStructure(struct, formula, { covalent = true, exactAtoms = true } = {}) {
  const problems = [];
  const { atoms: expected, charge } = parseFormula(formula);
  const counts = {};
  struct.atoms.forEach((a) => (counts[a.el] = (counts[a.el] ?? 0) + 1));
  if (exactAtoms) {
    for (const el of new Set([...Object.keys(expected), ...Object.keys(counts)])) {
      if ((expected[el] ?? 0) !== (counts[el] ?? 0)) problems.push(`${el}: desenho tem ${counts[el] ?? 0}, fórmula tem ${expected[el] ?? 0}`);
    }
    const total = struct.atoms.reduce((s, a) => s + a.charge, 0);
    if (total !== charge) problems.push(`carga total ${total}, esperada ${charge}`);
  } else if (Object.keys(counts).sort().join() !== Object.keys(expected).sort().join()) {
    problems.push(`elementos do desenho (${Object.keys(counts)}) diferem da fórmula (${Object.keys(expected)})`);
  }

  const order = new Array(struct.atoms.length).fill(0);
  const seen = new Set();
  for (const { a, b, order: o } of struct.bonds) {
    if (!struct.atoms[a] || !struct.atoms[b] || a === b) {
      problems.push(`ligação inválida ${a}-${b}`);
      continue;
    }
    if (![1, 2, 3].includes(o)) problems.push(`ordem de ligação inválida ${o}`);
    const key = [a, b].sort().join('-');
    if (seen.has(key)) problems.push(`ligação repetida ${key}`);
    seen.add(key);
    order[a] += o;
    order[b] += o;
    const d = Math.hypot(struct.atoms[a].x - struct.atoms[b].x, struct.atoms[a].y - struct.atoms[b].y);
    if (d < 0.7 || d > 1.4) problems.push(`ligação ${struct.atoms[a].el}${a}-${struct.atoms[b].el}${b} com comprimento ${d.toFixed(2)}`);
  }
  for (let i = 0; i < struct.atoms.length; i++) {
    for (let j = i + 1; j < struct.atoms.length; j++) {
      if (seen.has(`${i}-${j}`)) continue;
      const d = Math.hypot(struct.atoms[i].x - struct.atoms[j].x, struct.atoms[i].y - struct.atoms[j].y);
      if (d < 0.75) problems.push(`átomos ${struct.atoms[i].el}${i} e ${struct.atoms[j].el}${j} sobrepostos (${d.toFixed(2)})`);
    }
  }
  if (covalent) {
    // Radical (ex.: NO): exatamente UM átomo tem um elétron desemparelhado, ou seja, uma
    // ligação a menos do que o normal. Qualquer outro desvio continua sendo erro.
    let unpaired = 0;
    struct.atoms.forEach((at, i) => {
      const allowed = VALENCE[at.el]?.[at.charge];
      if (!allowed) problems.push(`${at.el}${i} com carga ${at.charge} não pode aparecer ligado`);
      else if (struct.radical && allowed.some((v) => v - 1 === order[i]) && !allowed.includes(order[i])) unpaired++;
      else if (!allowed.includes(order[i])) problems.push(`${at.el}${i} faz ${order[i]} ligações (esperado ${allowed.join(' ou ')})`);
    });
    if (struct.radical && unpaired !== 1) problems.push(`radical precisa de exatamente 1 átomo com elétron desemparelhado (tem ${unpaired})`);
  }
  return problems;
}
