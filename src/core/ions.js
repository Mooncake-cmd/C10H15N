// Íons, compostos iônicos e solubilidade (Fase 2). Puro, sem DOM.
//
// A partir de data/ions.json:
//   - solubility(cátion, ânion): Tabela I.1 de Atkins & Jones (solúvel, pouco solúvel, insolúvel);
//   - compoundFormula / compoundName: monta fórmula e nome pela carga (Al³⁺ + SO4²⁻ → Al2(SO4)3,
//     "sulfato de alumínio");
//   - deriveSubstances: gera os compostos que ainda não estão em substances.json, para que o
//     motor de regras possa formá-los como produtos.

import { parseFormula, formatFormulaText } from './formula.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const isPolyatomic = (formula) => Object.values(parseFormula(formula).atoms).reduce((s, n) => s + n, 0) > 1;
const chargeOf = (formula) => parseFormula(formula).charge;
const bare = (formula) => formula.replace(/(\^\d*)?[+-]$/, '');
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const pairKey = (cation, anion) => `${cation}|${anion}`;

/** Quantos cátions e ânions fecham a carga (Al³⁺ e O²⁻ → 2 e 3). */
export function ionCounts(cation, anion) {
  const qc = chargeOf(cation);
  const qa = -chargeOf(anion);
  const l = (qc * qa) / gcd(qc, qa);
  return { cation: l / qc, anion: l / qa };
}

/** Fórmula do composto: parênteses só para íon poliatômico repetido (Al2(SO4)3, (NH4)2CO3). */
export function compoundFormula(cation, anion) {
  const n = ionCounts(cation, anion);
  const part = (ion, k) => {
    const b = bare(ion);
    if (k === 1) return b;
    return isPolyatomic(ion) ? `(${b})${k}` : `${b}${k}`;
  };
  return part(cation, n.cation) + part(anion, n.anion);
}

/** Mesma composição atômica? (CH3COONa e NaCH3COO são o mesmo composto) */
export function sameComposition(f1, f2) {
  const a = parseFormula(f1);
  const b = parseFormula(f2);
  const ka = Object.keys(a.atoms).sort();
  const kb = Object.keys(b.atoms).sort();
  return a.charge === b.charge && ka.join() === kb.join() && ka.every((k) => a.atoms[k] === b.atoms[k]);
}

export function buildIonCatalog(rawIons) {
  const cations = new Map(rawIons.cations.map((c) => [c.formula, c]));
  const anions = new Map(rawIons.anions.map((a) => [a.formula, a]));
  const anomalies = new Map(rawIons.anomalies.map((a) => [pairKey(a.cation, a.anion), a]));
  return { ...rawIons, cationsByFormula: cations, anionsByFormula: anions, anomaliesByPair: anomalies };
}

const matchesCation = (sel, cat) => sel === cat.formula || (sel === 'group1' && cat.group === 1) || (sel === 'group2' && cat.group === 2);

/**
 * Solubilidade em água pela Tabela I.1.
 * @returns {{ result: 'soluble'|'slightly'|'insoluble', rule: object } | null} null se a tabela não cobre o par
 */
export function solubility(cation, anion, ions) {
  const cat = ions.cationsByFormula.get(cation);
  if (!cat) return null;
  for (const rule of ions.solubility.rules) {
    if (rule.cations && rule.cations.some((sel) => matchesCation(sel, cat))) return { result: rule.result, rule };
    if (rule.anions?.includes(anion)) return { result: rule.except?.[cation] ?? rule.result, rule };
  }
  return null;
}

/** O par pode formar um composto? Devolve o motivo se não puder. */
export function pairProblem(cation, anion, ions) {
  const cat = ions.cationsByFormula.get(cation);
  const an = ions.anionsByFormula.get(anion);
  if (!cat || !an) return { why: 'Íon fora do catálogo do jogo.', outOfCatalog: true };
  const anomaly = ions.anomaliesByPair.get(pairKey(cation, anion));
  if (anomaly?.scope === 'never') return anomaly;
  if (an.metalsOnly && !cat.metal) return { why: `O ${cat.name} não forma ${an.name}.` };
  if (an.onlyWith && !an.onlyWith.some((sel) => matchesCation(sel, cat))) return { why: an.onlyWithWhy, source: an.onlyWithSource };
  return null;
}

export function compoundName(cation, anion, ions) {
  const cat = ions.cationsByFormula.get(cation);
  const an = ions.anionsByFormula.get(anion);
  return capitalize(`${an.name} de ${cat.name}`);
}

function hazardsFor(cation, anion, sol, ions) {
  const cat = ions.cationsByFormula.get(cation);
  return ions.hazards
    .filter((h) => (!h.cation || h.cation === cation) && (!h.anion || h.anion === anion))
    .filter((h) => !h.group || h.group.includes(cat.group))
    .filter((h) => h.when !== 'soluble' || sol?.result === 'soluble')
    .map((h) => h.text);
}

/**
 * Índice "cátion|ânion" → id da substância, para os compostos iônicos já curados
 * (campo `ions` em substances.json ou desenho iônico em structures.json).
 */
export function curatedIonicIndex(substances, structures) {
  const index = new Map();
  for (const s of substances) {
    const ionic = s.ions ?? (structures.substances[s.id]?.kind === 'ionic' ? structures.substances[s.id] : null);
    if (ionic && ionic.cation.formula !== 'H+') index.set(pairKey(ionic.cation.formula, ionic.anion.formula), s.id);
  }
  return index;
}

/**
 * Compostos iônicos que ainda não existem em substances.json, para todos os pares válidos do
 * catálogo. Marcados com `derived: true` (não contam na coleção e não aparecem no inventário até
 * serem produzidos). Óxidos derivados ganham um desenho iônico em `structures`.
 * @returns {{ substances: object[], structures: Record<string, object> }}
 */
export function deriveSubstances(substances, structures, rawIons) {
  const ions = buildIonCatalog(rawIons);
  const curated = curatedIonicIndex(substances, structures);
  const out = [];
  const outStructures = {};
  for (const cat of rawIons.cations) {
    for (const an of rawIons.anions) {
      if (curated.has(pairKey(cat.formula, an.formula)) || pairProblem(cat.formula, an.formula, ions)) continue;
      const formula = compoundFormula(cat.formula, an.formula);
      if (substances.some((s) => sameComposition(s.formula, formula))) continue;
      const sol = solubility(cat.formula, an.formula, ions);
      const counts = ionCounts(cat.formula, an.formula);
      const ionsField = { cation: { formula: cat.formula, count: counts.cation }, anion: { formula: an.formula, count: counts.anion } };
      const kind = an.formula === 'OH-' ? 'base' : an.formula === 'O^2-' ? 'oxide' : 'salt';
      const tpl = rawIons.description;
      const description =
        tpl[kind].replace('{cation}', formatFormulaText(cat.formula)).replace('{anion}', formatFormulaText(an.formula)) +
        ' ' +
        tpl.solubility.replace('{label}', rawIons.solubility.labels[sol.result]).replace('{rule}', sol.rule.text);
      const sub = {
        id: formula,
        formula,
        name: compoundName(cat.formula, an.formula, ions),
        state: 's',
        categories: kind === 'base' ? ['base'] : kind === 'oxide' ? ['oxido'] : an.organic ? ['sal', 'organico'] : ['sal'],
        description,
        derived: true,
      };
      // Óxidos não levam `ions` (as regras de "sal" não se aplicam a sólidos como CuO); o desenho
      // iônico vai para structures.
      if (kind === 'oxide') outStructures[formula] = { kind: 'ionic', ...ionsField };
      else sub.ions = ionsField;
      const hz = hazardsFor(cat.formula, an.formula, sol, ions);
      if (hz.length) sub.hazard = hz.join(' ');
      out.push(sub);
    }
  }
  return { substances: out, structures: outStructures };
}
