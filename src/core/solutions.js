// Concentração de soluções, diluição e mistura. Puro (sem DOM).
//
// Atkins & Jones: concentração molar (seção G, p. F54), diluição — n = c·V se conserva (seção G.4,
// Exemplo G.4, p. F57) e ppm (glossário, p. B20). Bernoulli v. 5, Frente A, Módulos 09–10:
// concentração em g/L e ppm (p. 3), diluição e mistura de soluções do mesmo soluto (p. 11).

/** Unidades aceitas e seu fator para g/L, dada a massa molar M (g/mol). */
const TO_GL = {
  'mol/L': (M) => M,
  'g/L': () => 1,
  'mg/L': () => 1e-3,
  '% (m/V)': () => 10, // g por 100 mL = 10 g/L
};
export const CONCENTRATION_UNITS = Object.keys(TO_GL);

/**
 * Converte uma concentração para todas as unidades.
 * ppm: para soluções aquosas diluídas (densidade ≈ 1 kg/L), 1 ppm ≈ 1 mg/L — aproximação.
 * @returns {{ 'mol/L': number, 'g/L': number, 'mg/L': number, '% (m/V)': number } | null}
 */
export function convertConcentration(value, unit, molarMass) {
  if (!(value >= 0) || !TO_GL[unit] || !(molarMass > 0)) return null;
  const gL = value * TO_GL[unit](molarMass);
  return Object.fromEntries(CONCENTRATION_UNITS.map((u) => [u, gL / TO_GL[u](molarMass)]));
}

/**
 * Diluição: c₁·V₁ = c₂·V₂ (a quantidade de soluto não muda). Informe três valores; o que faltar
 * (null) é calculado. Volumes em qualquer unidade, desde que a mesma.
 * @returns {{ c1, V1, c2, V2, water } | null} water = volume de solvente a acrescentar (V₂ − V₁)
 */
export function dilution({ c1 = null, V1 = null, c2 = null, V2 = null }) {
  const vals = { c1, V1, c2, V2 };
  const missing = Object.keys(vals).filter((k) => vals[k] == null || Number.isNaN(vals[k]));
  if (missing.length !== 1 || Object.values(vals).some((v) => v != null && !(v > 0))) return null;
  const k = missing[0];
  if (k === 'c1') vals.c1 = (c2 * V2) / V1;
  if (k === 'V1') vals.V1 = (c2 * V2) / c1;
  if (k === 'c2') vals.c2 = (c1 * V1) / V2;
  if (k === 'V2') vals.V2 = (c1 * V1) / c2;
  if (vals.c2 > vals.c1 + 1e-12) return { ...vals, water: null, impossible: true }; // diluir não concentra
  return { ...vals, water: vals.V2 - vals.V1 };
}

/** Mistura de soluções do mesmo soluto: c = Σ cᵢ·Vᵢ / Σ Vᵢ (volumes somados). */
export function mixSameSolute(parts) {
  if (!parts.length || parts.some((p) => !(p.c >= 0) || !(p.V > 0))) return null;
  const n = parts.reduce((a, p) => a + p.c * p.V, 0);
  const V = parts.reduce((a, p) => a + p.V, 0);
  return { c: n / V, V };
}
