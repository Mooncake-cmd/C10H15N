// Forma das moléculas (Fase 3D) pelo modelo VSEPR, a partir das estruturas de Lewis de
// structures.json. Puro (sem DOM).
//
// Atkins & Jones, cap. 3: regiões de densidade eletrônica em volta de cada átomo (ligação simples,
// dupla ou tripla = 1 região; par isolado = 1; elétron desemparelhado = 1), arranjo eletrônico e
// forma (seções 3.1–3.2, Fig. 3.1, p. 94–100); polaridade pela soma dos dipolos das ligações
// (seção 3.3, p. 101–102); hibridização (Tabela 3.2, p. 109).

import { parseFormula } from './formula.js';

// ---------------- Estrutura de Lewis → regiões ----------------

/** Elétrons de valência de um elemento dos grupos principais (H: 1; grupos 13–18: grupo − 10). */
export function valenceElectrons(el, data) {
  const e = data.elementsBySymbol.get(el);
  if (!e?.group) return null;
  if (e.group <= 2) return e.group;
  if (e.group >= 13) return e.group - 10;
  return null; // metais de transição: fora do modelo
}

/** Lê uma entrada de structures.json para { atoms: [{el, charge}], bonds: [{a, b, order}] }. */
export function lewisFrom(entry) {
  if (!entry?.atoms || !entry.bonds) return null;
  return {
    atoms: entry.atoms.map(([el, , , charge = 0]) => ({ el, charge })),
    bonds: entry.bonds.map(([a, b, order]) => ({ a, b, order })),
    radical: !!entry.radical,
  };
}

/**
 * Para cada átomo: vizinhos, soma das ordens, elétrons não ligantes, pares isolados, elétron
 * desemparelhado e número de regiões (VSEPR).
 */
export function atomSites(lewis, data) {
  return lewis.atoms.map((atom, i) => {
    const bonds = lewis.bonds.filter((b) => b.a === i || b.b === i);
    const neighbors = bonds.map((b) => (b.a === i ? b.b : b.a));
    const bondSum = bonds.reduce((s, b) => s + b.order, 0);
    const ve = valenceElectrons(atom.el, data);
    const nonbonding = ve == null ? null : ve - atom.charge - bondSum;
    const lonePairs = nonbonding == null ? null : Math.floor(nonbonding / 2);
    const unpaired = nonbonding == null ? null : nonbonding % 2;
    return { i, el: atom.el, charge: atom.charge, neighbors, bonds, bondSum, nonbonding, lonePairs, unpaired, regions: neighbors.length + lonePairs + unpaired };
  });
}

/**
 * Descrição VSEPR de um átomo com dois ou mais vizinhos (um "átomo central").
 * @returns {{ axe, regions, arrangement, shape, hybridization, idealAngle }}
 */
export function describeCenter(site, data) {
  const M = data.molecules;
  const X = site.neighbors.length;
  const E = site.lonePairs + site.unpaired;
  const sub = (n) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
  return {
    axe: `AX${X > 1 ? sub(X) : ''}${E ? `E${E > 1 ? sub(E) : ''}` : ''}`,
    regions: site.regions,
    arrangement: M.arrangements[site.regions] ?? null,
    shape: M.shapes[`${site.regions}|${X}|${E}`] ?? null,
    hybridization: M.hybridization[site.regions] ?? null,
    idealAngle: { 2: 180, 3: 120, 4: 109.5, 5: 90, 6: 90 }[site.regions] ?? null,
  };
}

// ---------------- Geometria 3D ----------------

const v = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};
export const vec = v;

/** Direções ideais das regiões em volta de um átomo (Fig. 3.2): as posições mais afastadas entre si. */
export function idealDirections(n) {
  const s3 = Math.sqrt(3) / 2;
  const t = 1 / Math.sqrt(3);
  const sets = {
    1: [[1, 0, 0]],
    2: [[1, 0, 0], [-1, 0, 0]],
    3: [[1, 0, 0], [-0.5, s3, 0], [-0.5, -s3, 0]],
    4: [[t, t, t], [t, -t, -t], [-t, t, -t], [-t, -t, t]],
    // Bipirâmide: eixo primeiro, equador depois (pares isolados vão para o equador, p. 100).
    5: [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-0.5, s3, 0], [-0.5, -s3, 0]],
    // Octaedro: pares isolados nos últimos lugares, opostos entre si (quadrado planar).
    6: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  };
  return (sets[n] ?? sets[4]).map((d) => v.norm(d));
}

/** Rotação (fórmula de Rodrigues) que leva o vetor unitário a até o vetor unitário b. */
function rotateTo(a, b) {
  const c = v.dot(a, b);
  if (c > 1 - 1e-9) return (x) => x;
  if (c < -1 + 1e-9) {
    const axis = v.norm(Math.abs(a[0]) < 0.9 ? v.cross(a, [1, 0, 0]) : v.cross(a, [0, 1, 0]));
    return (x) => v.sub(v.mul(axis, 2 * v.dot(axis, x)), x);
  }
  const k = v.norm(v.cross(a, b));
  const s = Math.sqrt(1 - c * c);
  return (x) => v.add(v.add(v.mul(x, c), v.mul(v.cross(k, x), s)), v.mul(k, v.dot(k, x) * (1 - c)));
}
/** Rotação de ângulo θ em torno do eixo unitário k. */
const rotateAbout = (k, th) => (x) => v.add(v.add(v.mul(x, Math.cos(th)), v.mul(v.cross(k, x), Math.sin(th))), v.mul(k, v.dot(k, x) * (1 - Math.cos(th))));

/** Comprimento de ligação aproximado (pm): soma dos raios covalentes, encurtada nas ligações múltiplas. */
function bondLength(a, b, order, data) {
  const r = (el) => data.elementsBySymbol.get(el)?.covalentRadius ?? 75;
  return (r(a) + r(b)) * ({ 1: 1, 2: 0.87, 3: 0.78 }[order] ?? 1);
}

/**
 * Coordenadas 3D (pm) dos átomos e direções dos pares isolados, montando a molécula átomo a átomo:
 * em volta de cada átomo, as regiões ocupam as direções ideais do seu arranjo; um vizinho já
 * colocado fixa a primeira direção, e a rotação em torno da ligação deixa os substituintes em
 * zigue-zague (anti), como nas conformações mais estáveis.
 * @returns {{ pos: number[][], lonePairs: { atom, dir }[] }}
 */
export function embed3D(lewis, data) {
  const sites = atomSites(lewis, data);
  const n = sites.length;
  const pos = new Array(n).fill(null);
  const lonePairs = [];
  // Raiz: o átomo com mais vizinhos (o "central").
  const root = sites.reduce((a, b) => (b.neighbors.length > a.neighbors.length ? b : a)).i;
  pos[root] = [0, 0, 0];
  const queue = [[root, null, null]];
  while (queue.length) {
    const [i, parent, grand] = queue.shift();
    const s = sites[i];
    const regions = Math.max(1, s.regions);
    let dirs = idealDirections(regions);
    if (parent != null) {
      const toParent = v.norm(v.sub(pos[parent], pos[i]));
      const R = rotateTo(dirs[0], toParent);
      dirs = dirs.map(R);
      // Gira em torno da ligação para pôr a próxima direção anti ao avô (zigue-zague).
      const ref = grand != null ? v.sub(pos[grand], pos[parent]) : null;
      if (ref && dirs.length > 1) {
        const perp = (x) => v.sub(x, v.mul(toParent, v.dot(x, toParent)));
        const want = v.norm(v.mul(perp(ref), -1));
        const have = v.norm(perp(dirs[1]));
        if (v.len(perp(ref)) > 1e-6 && v.len(perp(dirs[1])) > 1e-6) {
          const th = Math.atan2(v.dot(toParent, v.cross(have, want)), v.dot(have, want));
          dirs = dirs.map(rotateAbout(toParent, th));
        }
      }
    }
    // Vizinhos ainda não colocados ocupam as direções livres; o pai já usa a direção 0. O ramo
    // com mais átomos pesados fica na direção anti (zigue-zague), para a cadeia não se enrolar.
    const free = parent != null ? dirs.slice(1) : dirs.slice();
    const heavy = (j, from) => {
      let n = 0;
      const seen = new Set([from]);
      const stack = [j];
      while (stack.length) {
        const k = stack.pop();
        if (seen.has(k)) continue;
        seen.add(k);
        if (sites[k].el !== 'H') n++;
        for (const x of sites[k].neighbors) if (!seen.has(x)) stack.push(x);
      }
      return n;
    };
    const children = s.neighbors.filter((j) => pos[j] == null).sort((a, b) => heavy(b, i) - heavy(a, i));
    children.forEach((j, k) => {
      const bond = s.bonds.find((b) => (b.a === i && b.b === j) || (b.b === i && b.a === j));
      pos[j] = v.add(pos[i], v.mul(free[k], bondLength(s.el, sites[j].el, bond.order, data)));
      queue.push([j, i, parent]);
    });
    // O que sobra são os pares isolados (e o elétron desemparelhado) deste átomo.
    free.slice(children.length, children.length + s.lonePairs + s.unpaired).forEach((dir) => lonePairs.push({ atom: i, dir }));
  }
  // Átomos soltos (não deveria haver numa molécula): ficam na origem deslocados.
  pos.forEach((p, i) => {
    if (!p) pos[i] = [i * 100, 0, 0];
  });
  // Centraliza.
  const c = v.mul(pos.reduce((a, p) => v.add(a, p), [0, 0, 0]), 1 / n);
  return { pos: pos.map((p) => v.sub(p, c)), lonePairs, sites };
}

/** Ângulo (graus) entre as ligações i–j e i–k. */
export function angleAt(pos, i, j, k) {
  const a = v.norm(v.sub(pos[j], pos[i]));
  const b = v.norm(v.sub(pos[k], pos[i]));
  return (Math.acos(Math.max(-1, Math.min(1, v.dot(a, b)))) * 180) / Math.PI;
}

// ---------------- Polaridade ----------------

/**
 * Momento de dipolo estimado: soma vetorial dos dipolos das ligações, cada um proporcional à
 * diferença de eletronegatividade e apontando para o átomo mais eletronegativo (seção 3.3).
 * Ligações C–H contam como praticamente apolares (Bernoulli v. 2, p. 78).
 * @returns {{ vector, magnitude, polar: boolean, polarBonds: number }}
 */
export function polarity(lewis, geo, data) {
  const chi = (el) => data.elementsBySymbol.get(el)?.electronegativity ?? null;
  const nonpolar = new Set((data.molecules.nonpolarBonds ?? []).map((p) => [...p].sort().join('-')));
  let sum = [0, 0, 0];
  let polarBonds = 0;
  for (const b of lewis.bonds) {
    const A = lewis.atoms[b.a].el;
    const B = lewis.atoms[b.b].el;
    if (A === B || nonpolar.has([A, B].sort().join('-'))) continue;
    const d = chi(B) - chi(A);
    if (!d) continue;
    polarBonds++;
    sum = v.add(sum, v.mul(v.norm(v.sub(geo.pos[b.b], geo.pos[b.a])), d));
  }
  const magnitude = v.len(sum);
  return { vector: sum, magnitude, polar: magnitude > 0.05, polarBonds };
}

// ---------------- Tudo junto ----------------

/** Entrada da estrutura (molécula ou íon poliatômico) de uma fórmula/substância. */
export function lewisFor(key, data) {
  const s = data.structures;
  const entry = s.substances[key]?.kind === 'molecule' ? s.substances[key] : s.ions[key] ?? null;
  return lewisFrom(entry);
}

/**
 * Análise completa de uma molécula ou íon poliatômico.
 * @returns null se não houver estrutura molecular (composto iônico, metal, gás nobre...).
 */
export function analyzeMolecule(key, data) {
  const lewis = lewisFor(key, data);
  if (!lewis) return null;
  const geo = embed3D(lewis, data);
  const centers = geo.sites
    .filter((s) => s.neighbors.length >= 2)
    .map((s) => ({ ...describeCenter(s, data), atom: s.i, el: s.el, lonePairs: s.lonePairs, unpaired: s.unpaired }));
  const nNeighbors = (c) => geo.sites[c.atom].neighbors.length;
  const main = centers.length ? centers.reduce((a, b) => (nNeighbors(b) > nNeighbors(a) ? b : a)) : null;
  const charge = lewis.atoms.reduce((a, x) => a + x.charge, 0);
  const formula = key;
  const pol = charge === 0 ? polarity(lewis, geo, data) : null;
  return {
    key,
    formula,
    lewis,
    geo,
    centers,
    main,
    // Diatômica ou uma só ligação: sempre linear.
    shape: main ? main.shape : 'linear',
    charge,
    polarity: pol,
    measuredAngle: data.molecules.measuredAngles[formula] ?? null,
    measuredDipole: data.molecules.dipoles[formula] ?? null,
  };
}

/** Respostas dos objetivos de forma molecular (nível 16). */
export function moleculeAnswer(o, data) {
  const m = analyzeMolecule(o.molecule, data);
  if (o.ask === 'shape') return m.shape;
  if (o.ask === 'polar') return m.polarity.polar ? 'polar' : 'apolar';
  if (o.ask === 'lonePairs') return m.main.lonePairs;
  if (o.ask === 'hybridization') return m.main.hybridization;
  if (o.ask === 'angle') return m.main.idealAngle;
  throw new Error(`pergunta de forma molecular desconhecida: ${o.ask}`);
}

/** Lista das chaves (fórmulas) de todas as moléculas e íons poliatômicos com estrutura. */
export function moleculeKeys(data) {
  const s = data.structures;
  return [...Object.keys(s.substances).filter((k) => s.substances[k].kind === 'molecule'), ...Object.keys(s.ions)];
}

export const atomsOf = (formula) => parseFormula(formula).atoms;
