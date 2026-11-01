// Equilíbrio químico (Fase 3C): K a partir de ΔG°, van 't Hoff, quociente de reação, Le Chatelier,
// pH de ácidos e bases, tampões, solubilidade pelo Kps e indicadores. Puro (sem DOM).
//
// Atkins & Jones: ΔG° = −RT ln K (seção 10.3, Exemplo 10.3, p. 394); interpretação de K (p. 395);
// direção pela comparação Q × K (seção 10.5, p. 396); K e Kc (seção 10.7, p. 400); Le Chatelier
// (seções 10.9–10.11, p. 405–412); van 't Hoff (Exemplo 10.13, p. 412); Kw (p. 430); ácidos e
// bases fracos (seções 11.11–11.12, Exemplo 11.7, p. 446); tampões (seção 12.2, Exemplo 12.1,
// p. 477); Kps e solubilidade molar (seção 12.8, Exemplo 12.8, p. 498); íon comum (seção 12.9);
// previsão de precipitação (seção 12.10).

import { parseFormula } from './formula.js';

export const R = 8.3145; // J·K⁻¹·mol⁻¹
export const R_LBAR = 0.083145; // L·bar·K⁻¹·mol⁻¹
export const T_STD = 298.15;

/** K a partir de ΔG° (kJ/mol): K = e^(−ΔG°/RT). Devolve também log10 K (para números enormes). */
export function kFromDeltaG(dGkJ, T = T_STD) {
  const lnK = (-dGkJ * 1000) / (R * T);
  return { lnK, log10K: lnK / Math.LN10, K: Math.exp(lnK) };
}

/** Interpretação do livro (p. 395): K > ~10³ favorece produtos; K < ~10⁻³, reagentes. */
export function interpretK(log10K) {
  if (log10K > 3) return 'produtos';
  if (log10K < -3) return 'reagentes';
  return 'ambos';
}

/** van 't Hoff: ln(K₂/K₁) = (ΔH°/R)·(1/T₁ − 1/T₂), com ΔH° em kJ/mol. */
export const vantHoff = (K1, T1, T2, dHkJ) => K1 * Math.exp(((dHkJ * 1000) / R) * (1 / T1 - 1 / T2));

/** Δn de gás (mols de gás nos produtos − nos reagentes). Em `gas`, todas as espécies são gasosas. */
export const deltaNGas = (entry) => entry.products.reduce((a, e) => a + e.coef, 0) - entry.reactants.reduce((a, e) => a + e.coef, 0);

/** K = Kc·(RT/P°)^Δn (P° = 1 bar). */
export const kFromKc = (Kc, T, dn) => Kc * ((R_LBAR * T) / 1) ** dn;

/** Quociente de reação com pressões parciais (bar): Q = Π P(produtos)^ν / Π P(reagentes)^ν. */
export function reactionQuotient(entry, pressures) {
  const term = (side) => side.reduce((a, e) => a * pressures[e.formula] ** e.coef, 1);
  return term(entry.products) / term(entry.reactants);
}

/** Q < K: forma produtos; Q > K: forma reagentes; Q = K: equilíbrio (seção 10.5). */
export function direction(Q, K, rel = 0.01) {
  if (Math.abs(Q - K) <= rel * K) return 'equilibrio';
  return Q < K ? 'produtos' : 'reagentes';
}

/** K tabelado mais próximo de T, ou null. */
export const kAtTable = (entry, T) => entry.points.find(([t]) => t === T)?.[1] ?? null;

/**
 * Le Chatelier (seções 10.9–10.11): para onde o equilíbrio se desloca em cada perturbação.
 * @param dn Δn de gás; @param dH ΔH° (kJ) ou null
 * @returns {{ addReactant, removeProduct, compress, expand, heat, cool }} cada um: 'produtos'|'reagentes'|'nao-muda'|null
 */
export function leChatelier({ dn, dH }) {
  const byGas = (fewer) => (dn === 0 || dn == null ? 'nao-muda' : (dn < 0) === fewer ? 'produtos' : 'reagentes');
  const byHeat = (hotter) => (dH == null ? null : dH === 0 ? 'nao-muda' : (dH > 0) === hotter ? 'produtos' : 'reagentes');
  return {
    addReactant: 'produtos',
    removeProduct: 'produtos',
    compress: byGas(true), // mais pressão → lado com menos mols de gás
    expand: byGas(false),
    heat: byHeat(true), // aquecer favorece o sentido endotérmico
    cool: byHeat(false),
  };
}

// ---------------- Ácidos e bases (25 °C) ----------------

export const KW = 1.0e-14;
const pFromConc = (c) => -Math.log10(c);

/** [H3O⁺] de um ácido forte, incluindo a autoprotólise da água (seção 11.18): x = c/2 + √(c²/4 + Kw). */
export const strongAcidH = (c, n = 1) => (n * c) / 2 + Math.sqrt((n * c) ** 2 / 4 + KW);

/** H2SO4: 1ª ionização completa; a 2ª (Ka2) por equação de 2º grau (Self-Test 11.15A). */
export function sulfuricH(c, Ka2) {
  // (c + x)·x / (c − x) = Ka2  →  x² + (c + Ka2)x − Ka2·c = 0
  const x = (-(c + Ka2) + Math.sqrt((c + Ka2) ** 2 + 4 * Ka2 * c)) / 2;
  return c + x;
}

/** Ácido fraco HA: x²/(c − x) = Ka, resolvida sem aproximação. */
export const weakAcidH = (c, Ka) => (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * c)) / 2;

/**
 * pH de uma solução de uma espécie do equilíbrio.
 * @param kind 'strongAcid'|'strongBase'|'weakAcid'|'weakBase'
 * @returns {{ pH, pOH, H, OH, percent: number|null }}
 */
export function solutionPH(kind, c, params = {}) {
  let H;
  let percent = null;
  if (kind === 'strongAcid') H = params.Ka2 ? sulfuricH(c, params.Ka2) : strongAcidH(c, params.n ?? 1);
  else if (kind === 'strongBase') H = KW / strongAcidH(c, params.n ?? 1);
  else if (kind === 'weakAcid') {
    const x = weakAcidH(c, params.Ka);
    percent = (100 * x) / c;
    H = x;
  } else if (kind === 'weakBase') {
    const x = weakAcidH(c, params.Kb);
    percent = (100 * x) / c;
    H = KW / x;
  } else throw new Error(`tipo ${kind}`);
  const OH = KW / H;
  return { pH: pFromConc(H), pOH: pFromConc(OH), H, OH, percent };
}

/** Tampão (seção 12.2): pH = pKa + log([base]/[ácido]). */
export const bufferPH = (Ka, cAcid, cBase) => -Math.log10(Ka) + Math.log10(cBase / cAcid);

/** Cor de um indicador num pH. */
export function indicatorColor(ind, pH) {
  if (pH < ind.range[0]) return { color: ind.acid, form: 'ácida' };
  if (pH > ind.range[1]) return { color: ind.base, form: 'básica' };
  return { color: `${ind.acid} → ${ind.base}`, form: 'na viragem' };
}

// ---------------- Solubilidade ----------------

/**
 * Solubilidade molar s (mol/L) de um sal AxBy a partir do Kps, opcionalmente com um íon comum já
 * dissolvido (mol/L): Kps = (x·s + c_cátion)^x · (y·s + c_ânion)^y. Sem íon comum, fórmula fechada.
 */
export function molarSolubility(entry, { cation = 0, anion = 0 } = {}) {
  const x = entry.cation.count;
  const y = entry.anion.count;
  const s0 = (entry.Ksp / (x ** x * y ** y)) ** (1 / (x + y));
  if (!cation && !anion) return s0;
  const f = (s) => (x * s + cation) ** x * (y * s + anion) ** y - entry.Ksp;
  let lo = 0;
  let hi = s0;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Previsão de precipitação (seção 12.10): Q = [cátion]^x[ânion]^y > Kps → precipita. */
export function precipitates(entry, cCation, cAnion) {
  const Q = cCation ** entry.cation.count * cAnion ** entry.anion.count;
  return { Q, precipitates: Q > entry.Ksp };
}

// ---------------- Respostas dos objetivos (nível 15) ----------------

export function equilibriumAnswer(o, data) {
  const E = data.equilibrium;
  if (o.ask === 'pH') {
    const s = findSpecies(E, o.species);
    return solutionPH(s.kind, o.c, s.params).pH;
  }
  if (o.ask === 'bufferPH') return bufferPH(findSpecies(E, o.species).params.Ka, o.cAcid, o.cBase);
  if (o.ask === 'solubility') {
    const s = molarSolubility(E.kspByFormula.get(o.salt), o.common ?? {});
    return o.unit === 'µmol/L' ? s * 1e6 : o.unit === 'mmol/L' ? s * 1e3 : s;
  }
  if (o.ask === 'shift') {
    const g = E.gasById.get(o.gas);
    return leChatelier({ dn: deltaNGas(g), dH: o.dH ?? null })[o.stress];
  }
  if (o.ask === 'K') return kFromDeltaG(o.dG, o.T ?? T_STD).K;
  throw new Error(`pergunta de equilíbrio desconhecida: ${o.ask}`);
}

/** Espécie de ácido/base pela fórmula: tipo e parâmetros para solutionPH. */
export function findSpecies(E, formula) {
  const sa = E.strong.acids.find((x) => x.formula === formula);
  if (sa) return { kind: 'strongAcid', item: sa, params: { n: sa.nH, Ka2: sa.Ka2 } };
  const sb = E.strong.bases.find((x) => x.formula === formula);
  if (sb) return { kind: 'strongBase', item: sb, params: { n: sb.nOH } };
  const wa = E.acids.find((x) => x.formula === formula);
  if (wa) return { kind: 'weakAcid', item: wa, params: { Ka: wa.Ka } };
  const wb = E.bases.find((x) => x.formula === formula);
  if (wb) return { kind: 'weakBase', item: wb, params: { Kb: wb.Kb } };
  return null;
}

/** Átomos de um lado (para conferir as equações da Tabela 10.2). */
export const atomsOfSide = (side) => {
  const out = {};
  for (const { formula, coef } of side) for (const [el, n] of Object.entries(parseFormula(formula).atoms)) out[el] = (out[el] ?? 0) + coef * n;
  return out;
};

/** Índices do JSON. */
export function buildEquilibrium(raw) {
  if (!raw) return null;
  return {
    ...raw,
    gasById: new Map(raw.gas.map((g) => [g.id, g])),
    gasByGame: new Map(raw.gas.filter((g) => g.game).map((g) => [g.game, g])),
    kspByFormula: new Map(raw.ksp.map((k) => [k.formula, k])),
  };
}
