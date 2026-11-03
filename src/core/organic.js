// Química orgânica (Fase 3E): grupos funcionais, nome oficial (IUPAC) e isomeria, deduzidos das
// estruturas de Lewis de structures.json. Puro (sem DOM).
//
// Atkins & Jones: nomenclatura de alcanos e alcenos (seções 18.1–18.2, Exemplos 18.1–18.2,
// p. 739–740), isômeros (seção 18.2, p. 740–741), grupos funcionais (Tabela 19.1 e seções
// 19.1–19.7, p. 762–766). Bernoulli v. 1–3 (Frente D): nomenclatura em português (prefixo +
// infixo + sufixo) e tipos de isomeria plana (v. 3, Módulo 12).

import { parseFormula } from './formula.js';
import { lewisFor } from './vsepr.js';

const PREFIX = ['', 'met', 'et', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec'];
const MULT = ['', '', 'di', 'tri', 'tetra'];
const ALKYL = (n) => `${PREFIX[n]}il`; // metil, etil, propil

export const FUNCTION_LABEL = {
  acido: 'ácido carboxílico',
  ester: 'éster',
  aldeido: 'aldeído',
  cetona: 'cetona',
  alcool: 'álcool',
  eter: 'éter',
  haleto: 'haleto orgânico',
  alceno: 'alceno',
  alcino: 'alcino',
  alcano: 'alcano',
};
export const FUNCTION_GROUP = {
  acido: '–COOH (carboxila)',
  ester: '–COO– (entre duas cadeias)',
  aldeido: '–CHO (carbonila na ponta)',
  cetona: '–CO– (carbonila no meio da cadeia)',
  alcool: '–OH ligado a carbono saturado',
  eter: '–O– entre dois carbonos',
  haleto: 'halogênio (Cl) ligado a carbono',
  alceno: 'ligação dupla C=C',
  alcino: 'ligação tripla C≡C',
  alcano: 'só ligações simples, só C e H',
};
// Prioridade para escolher a função principal (a que dá o sufixo do nome).
const PRIORITY = ['acido', 'ester', 'aldeido', 'cetona', 'alcool'];

/** Grafo da molécula: vizinhos de cada átomo com a ordem da ligação. */
function graph(lewis) {
  const nb = lewis.atoms.map(() => []);
  for (const b of lewis.bonds) {
    nb[b.a].push({ j: b.b, order: b.order });
    nb[b.b].push({ j: b.a, order: b.order });
  }
  return nb;
}

/** É uma molécula orgânica do jogo? (tem C–H ou C–C; CO2, H2CO3 e íons ficam de fora) */
export function isOrganic(lewis) {
  if (!lewis) return false;
  const nb = graph(lewis);
  return lewis.atoms.some((a, i) => a.el === 'C' && nb[i].some(({ j }) => ['C', 'H'].includes(lewis.atoms[j].el))) && lewis.atoms.every((a) => !a.charge);
}

/**
 * Grupos funcionais presentes, com os átomos envolvidos.
 * @returns {{ type, carbon?, oxygen?, atoms }[]}
 */
export function functionalGroups(lewis) {
  const nb = graph(lewis);
  const el = (i) => lewis.atoms[i].el;
  const groups = [];
  const carbonylO = new Set();
  const esterO = new Set();
  lewis.atoms.forEach((a, i) => {
    if (a.el !== 'C') return;
    const dO = nb[i].find(({ j, order }) => el(j) === 'O' && order === 2);
    if (!dO) return;
    carbonylO.add(dO.j);
    const sO = nb[i].find(({ j, order }) => el(j) === 'O' && order === 1);
    if (sO) {
      const other = nb[sO.j].find(({ j }) => j !== i);
      if (other && el(other.j) === 'H') groups.push({ type: 'acido', carbon: i, atoms: [i, dO.j, sO.j, other.j] });
      else if (other && el(other.j) === 'C') {
        esterO.add(sO.j);
        groups.push({ type: 'ester', carbon: i, oxygen: sO.j, alkylCarbon: other.j, atoms: [i, dO.j, sO.j] });
      }
      return;
    }
    const cs = nb[i].filter(({ j }) => el(j) === 'C').length;
    const hs = nb[i].filter(({ j }) => el(j) === 'H').length;
    if (hs >= 1) groups.push({ type: 'aldeido', carbon: i, atoms: [i, dO.j] });
    else if (cs === 2) groups.push({ type: 'cetona', carbon: i, atoms: [i, dO.j] });
  });
  lewis.atoms.forEach((a, i) => {
    if (a.el !== 'O' || carbonylO.has(i) || esterO.has(i)) return;
    const ns = nb[i];
    const carbons = ns.filter(({ j }) => el(j) === 'C');
    const isCarbonyl = (c) => nb[c].some(({ j, order }) => el(j) === 'O' && order === 2);
    if (carbons.length === 1 && ns.some(({ j }) => el(j) === 'H') && !isCarbonyl(carbons[0].j)) groups.push({ type: 'alcool', carbon: carbons[0].j, oxygen: i, atoms: [i] });
    else if (carbons.length === 2 && !carbons.some((c) => isCarbonyl(c.j))) groups.push({ type: 'eter', oxygen: i, atoms: [i] });
  });
  lewis.atoms.forEach((a, i) => {
    if (a.el === 'Cl' && nb[i].some(({ j }) => el(j) === 'C')) groups.push({ type: 'haleto', carbon: nb[i][0].j, atoms: [i] });
  });
  for (const b of lewis.bonds) {
    if (el(b.a) === 'C' && el(b.b) === 'C' && b.order > 1) groups.push({ type: b.order === 2 ? 'alceno' : 'alcino', atoms: [b.a, b.b], bond: b });
  }
  if (!groups.length && lewis.atoms.every((a) => ['C', 'H'].includes(a.el))) groups.push({ type: 'alcano', atoms: [] });
  return groups;
}

/** Função principal (a de maior prioridade); hidrocarbonetos pela insaturação. */
export function mainFunction(groups) {
  for (const t of PRIORITY) if (groups.some((g) => g.type === t)) return t;
  if (groups.some((g) => g.type === 'eter')) return 'eter';
  if (groups.some((g) => g.type === 'alcino')) return 'alcino';
  if (groups.some((g) => g.type === 'alceno')) return 'alceno';
  if (groups.some((g) => g.type === 'haleto')) return 'haleto';
  return 'alcano';
}

// ---------------- Cadeias de carbono ----------------

/** Carbonos alcançáveis a partir de `start` sem passar pelos átomos bloqueados (só via C–C). */
function carbonComponent(lewis, nb, start, blocked = new Set()) {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop();
    for (const { j } of nb[i]) {
      if (lewis.atoms[j].el === 'C' && !seen.has(j) && !blocked.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen;
}

/** Todos os caminhos simples entre carbonos de um conjunto (moléculas pequenas: força bruta). */
function carbonPaths(lewis, nb, carbons) {
  const out = [];
  const dfs = (path) => {
    out.push(path);
    const last = path[path.length - 1];
    for (const { j } of nb[last]) if (carbons.has(j) && !path.includes(j)) dfs([...path, j]);
  };
  for (const c of carbons) dfs([c]);
  return out;
}

const bondOrder = (nb, a, b) => nb[a].find((x) => x.j === b)?.order ?? 0;

/**
 * Nome IUPAC (como no ensino médio brasileiro: "propan-2-ol", "but-1-eno", "etanoato de etila").
 * @returns {{ name: string, parts: { text, meaning }[], chain: number[], fn: string } | null}
 */
export function iupacName(lewis) {
  if (!isOrganic(lewis)) return null;
  const nb = graph(lewis);
  const el = (i) => lewis.atoms[i].el;
  const groups = functionalGroups(lewis);
  const fn = mainFunction(groups);

  // Éster: "<ácido>oato de <alquil>ila".
  if (fn === 'ester') {
    const g = groups.find((x) => x.type === 'ester');
    const acid = carbonComponent(lewis, nb, g.carbon, new Set([g.alkylCarbon]));
    const alkyl = carbonComponent(lewis, nb, g.alkylCarbon, new Set([g.carbon]));
    const stem = PREFIX[acid.size];
    return {
      name: `${stem}anoato de ${PREFIX[alkyl.size]}ila`,
      fn,
      chain: [...acid],
      parts: [
        { text: `${stem}an`, meaning: `parte que vem do ácido: ${acid.size} carbono${acid.size > 1 ? 's' : ''} (${stem}), ligações simples (an)` },
        { text: 'oato', meaning: 'terminação de éster (o ácido -oico vira -oato)' },
        { text: `de ${PREFIX[alkyl.size]}ila`, meaning: `parte que vem do álcool: grupo de ${alkyl.size} carbono${alkyl.size > 1 ? 's' : ''}` },
      ],
    };
  }
  // Éter: "<alcóxi><alcano>" — o grupo menor vira prefixo (metóxi, etóxi).
  if (fn === 'eter') {
    const g = groups.find((x) => x.type === 'eter');
    const [c1, c2] = nb[g.oxygen].filter(({ j }) => el(j) === 'C').map(({ j }) => carbonComponent(lewis, nb, j));
    const [small, big] = c1.size <= c2.size ? [c1, c2] : [c2, c1];
    return {
      name: `${PREFIX[small.size]}oxi${PREFIX[big.size]}ano`,
      fn,
      chain: [...big],
      parts: [
        { text: `${PREFIX[small.size]}oxi`, meaning: `grupo –O–${small.size === 1 ? 'CH₃' : 'C' + small.size} (o lado menor, ligado pelo oxigênio)` },
        { text: `${PREFIX[big.size]}ano`, meaning: `cadeia principal de ${big.size} carbono${big.size > 1 ? 's' : ''}, só ligações simples` },
      ],
    };
  }

  const carbons = new Set(lewis.atoms.map((a, i) => (a.el === 'C' ? i : -1)).filter((i) => i >= 0));
  const principal = groups.filter((g) => g.type === fn && g.carbon != null).map((g) => g.carbon);
  const multiple = lewis.bonds.filter((b) => el(b.a) === 'C' && el(b.b) === 'C' && b.order > 1);
  // Cadeia principal: contém o carbono da função; a mais longa; com mais ligações múltiplas.
  const candidates = carbonPaths(lewis, nb, carbons)
    .filter((p) => principal.every((c) => p.includes(c)))
    .map((p) => ({ p, mult: multiple.filter((b) => p.includes(b.a) && p.includes(b.b)).length }));
  candidates.sort((x, y) => y.p.length - x.p.length || y.mult - x.mult);
  const best = candidates.filter((c) => c.p.length === candidates[0].p.length && c.mult === candidates[0].mult);
  // Numeração: menor localizador para a função, depois para a insaturação, depois para os substituintes.
  const scored = best.map(({ p }) => {
    const pos = (atom) => p.indexOf(atom) + 1;
    const fnLoc = principal.map(pos).sort((a, b) => a - b);
    const unsat = multiple.filter((b) => p.includes(b.a) && p.includes(b.b)).map((b) => Math.min(pos(b.a), pos(b.b))).sort((a, b) => a - b);
    const subs = [];
    p.forEach((c) => {
      for (const { j } of nb[c]) {
        if (el(j) === 'Cl') subs.push({ name: 'cloro', loc: pos(c), halogen: true });
        else if (el(j) === 'C' && !p.includes(j)) subs.push({ name: ALKYL(carbonComponent(lewis, nb, j, new Set([c])).size), loc: pos(c) });
      }
    });
    return { p, fnLoc, unsat, subs, key: [...fnLoc, 99, ...unsat, 99, ...subs.map((s) => s.loc).sort((a, b) => a - b)] };
  });
  const cmp = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
    return 0;
  };
  scored.sort((a, b) => cmp(a.key, b.key));
  const { p, fnLoc, unsat, subs } = scored[0];
  const n = p.length;
  const stem = PREFIX[n];
  const parts = [];

  // Substituintes (prefixos), em ordem alfabética, com di/tri.
  const byName = new Map();
  for (const s of subs) byName.set(s.name, [...(byName.get(s.name) ?? []), s]);
  const subNeedsLoc = subs.length > 1 || subs.some((s) => (s.halogen ? n >= 3 : n >= 4));
  const subText = [...byName.keys()]
    .sort()
    .map((name) => {
      const list = byName.get(name);
      const locs = list.map((s) => s.loc).sort((a, b) => a - b);
      const t = `${subNeedsLoc ? locs.join(',') + '-' : ''}${MULT[list.length]}${name}`;
      parts.push({ text: t, meaning: `${list.length > 1 ? `${list.length} grupos` : 'grupo'} ${name === 'cloro' ? 'cloro (Cl)' : `${name} (–${name === 'metil' ? 'CH₃' : 'C₂H₅'})`} ${subNeedsLoc ? `no${list.length > 1 ? 's' : ''} carbono${list.length > 1 ? 's' : ''} ${locs.join(' e ')}` : 'ligado à cadeia'}` });
      return t;
    })
    .join('-');
  // Prefixos dos substituintes vão na frente do nome: "1,2-dicloro" + "etano".
  const prefixWithSubs = (s) => `${subText}${s}`;

  parts.push({ text: stem, meaning: `${n} carbono${n > 1 ? 's' : ''} na cadeia principal` });
  let infix = 'an';
  let infixMeaning = 'só ligações simples entre os carbonos';
  const unsatType = multiple.find((b) => p.includes(b.a) && p.includes(b.b))?.order;
  if (unsatType) {
    const loc = unsat[0];
    infix = `${n >= 4 ? `-${loc}-` : ''}${unsatType === 2 ? 'en' : 'in'}`;
    infixMeaning = `uma ligação ${unsatType === 2 ? 'dupla' : 'tripla'}${n >= 4 ? ` começando no carbono ${loc}` : ''}`;
  }
  parts.push({ text: infix.replace(/^-\d+-/, ''), meaning: infixMeaning });

  let name;
  if (fn === 'acido') {
    name = `ácido ${prefixWithSubs(stem + infix)}oico`;
    parts.push({ text: 'oico', meaning: 'função ácido carboxílico (–COOH); o nome começa com "ácido"' });
  } else if (fn === 'aldeido') {
    name = prefixWithSubs(`${stem}${infix}al`);
    parts.push({ text: 'al', meaning: 'função aldeído (–CHO, sempre no carbono 1)' });
  } else if (fn === 'cetona') {
    const loc = n >= 5 ? `-${fnLoc[0]}-` : '';
    name = prefixWithSubs(`${stem}${infix}${loc}ona`);
    parts.push({ text: 'ona', meaning: `função cetona (C=O no meio da cadeia${loc ? `, no carbono ${fnLoc[0]}` : ''})` });
  } else if (fn === 'alcool') {
    const loc = n >= 3 ? `-${fnLoc.join(',')}-` : '';
    name = prefixWithSubs(`${stem}${infix}${loc}${fnLoc.length > 1 ? MULT[fnLoc.length] : ''}ol`);
    parts.push({ text: 'ol', meaning: `função álcool (–OH${loc ? ` no carbono ${fnLoc.join(' e ')}` : ''})` });
  } else {
    name = prefixWithSubs(`${stem}${infix}o`);
    parts.push({ text: 'o', meaning: 'terminação de hidrocarboneto' });
  }
  return { name, fn, chain: p, parts };
}

// ---------------- Isomeria ----------------

/** Chave da fórmula molecular (C2H6O): átomos em ordem C, H, depois alfabética. */
export function molecularFormula(formula) {
  const { atoms } = parseFormula(formula);
  const order = Object.keys(atoms).sort((a, b) => (a === 'C' ? -1 : b === 'C' ? 1 : a === 'H' ? -1 : b === 'H' ? 1 : a.localeCompare(b)));
  return order.map((e) => `${e}${atoms[e] > 1 ? atoms[e] : ''}`).join('');
}

/** Esqueleto de carbono "normal" (sem ramificação)? */
function isUnbranched(lewis) {
  const nb = graph(lewis);
  return lewis.atoms.every((a, i) => a.el !== 'C' || nb[i].filter(({ j }) => lewis.atoms[j].el === 'C').length <= 2);
}

/**
 * Tipo de isomeria plana entre duas moléculas de mesma fórmula molecular (Bernoulli v. 3, Módulo 12):
 * função (funções diferentes), cadeia (esqueletos diferentes) ou posição (o grupo muda de carbono).
 */
export function isomerType(a, b) {
  const fa = mainFunction(functionalGroups(a));
  const fb = mainFunction(functionalGroups(b));
  if (fa !== fb) return 'função';
  if (isUnbranched(a) !== isUnbranched(b)) return 'cadeia';
  return 'posição';
}

/** Análise orgânica completa de uma substância do jogo (null se não for orgânica). */
export function analyzeOrganic(key, data) {
  const lewis = lewisFor(key, data);
  if (!isOrganic(lewis)) return null;
  const groups = functionalGroups(lewis);
  const fn = mainFunction(groups);
  const iupac = iupacName(lewis);
  const mf = molecularFormula(key);
  const isomers = data.substances
    .filter((s) => s.id !== key && molecularFormula(s.formula) === mf)
    .map((s) => ({ id: s.id, type: isOrganic(lewisFor(s.id, data)) ? isomerType(lewis, lewisFor(s.id, data)) : null }))
    .filter((x) => x.type);
  const types = [...new Set(groups.map((g) => g.type))];
  return { key, lewis, groups, types, fn, iupac, molecularFormula: mf, isomers, saturated: !groups.some((g) => g.type === 'alceno' || g.type === 'alcino') };
}

/** Respostas dos objetivos de química orgânica (nível 17). */
export function organicAnswer(o, data) {
  const a = analyzeOrganic(o.molecule, data);
  if (o.ask === 'name') return a.iupac.name;
  if (o.ask === 'function') return a.fn;
  if (o.ask === 'isomer') return o.choices.find((c) => a.isomers.some((x) => x.id === c.value))?.value ?? null;
  if (o.ask === 'isomerType') return isomerType(a.lewis, lewisFor(o.other, data));
  throw new Error(`pergunta de orgânica desconhecida: ${o.ask}`);
}
