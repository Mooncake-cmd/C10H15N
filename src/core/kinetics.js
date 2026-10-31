// Velocidade das reações (Fase 3B): leis de velocidade, leis integradas, meia-vida e a equação de
// Arrhenius, a partir dos dados de data/kinetics.json. Puro (sem DOM).
//
// Atkins & Jones, cap. 14: leis de velocidade e Tabela 14.1 (p. 566–567), leis integradas de
// 1ª e 2ª ordem (p. 572–579), meia-vida (p. 576), Arrhenius e Tabela 14.4 (p. 587–589).
//
// Convenção (a mesma dos exemplos resolvidos do livro, p. 573 e 578): o k da tabela dá a taxa de
// CONSUMO da espécie acompanhada (`species`):  −d[A]/dt = k[A]ⁿ.
//
// Nunca estimamos fora do que o livro dá: k(T) sai do ponto da tabela (se a temperatura bate), dos
// parâmetros de Arrhenius do livro ou, sem eles, da reta de Arrhenius pelos pontos da Tabela 14.1
// — e só dentro da faixa de temperatura medida.

export const R = 8.314; // J·K⁻¹·mol⁻¹
export const LN2 = Math.LN2;

/** k = A·e^(−Ea/RT), com Ea em kJ/mol. */
export const arrheniusK = (A, EaKJ, T) => A * Math.exp((-EaKJ * 1000) / (R * T));

/** Quantas vezes k aumenta de T1 para T2: k2/k1 = e^[(Ea/R)(1/T1 − 1/T2)]. */
export const kRatio = (EaKJ, T1, T2) => Math.exp(((EaKJ * 1000) / R) * (1 / T1 - 1 / T2));

/** Reta de Arrhenius (ln k contra 1/T) por mínimos quadrados: devolve { A, Ea } (Ea em kJ/mol). */
export function fitArrhenius(points) {
  if (!points || points.length < 2) return null;
  const xs = points.map(([T]) => 1 / T);
  const ys = points.map(([, k]) => Math.log(k));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b) / n;
  const my = ys.reduce((a, b) => a + b) / n;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  return { A: Math.exp(my - slope * mx), Ea: (-slope * R) / 1000 };
}

/** Faixa de temperatura em que o jogo aceita calcular k (K). */
export function tempRange(entry) {
  if (entry.range) return entry.range;
  const Ts = (entry.points ?? []).map(([T]) => T);
  return [Math.min(...Ts), Math.max(...Ts)];
}

/** Ea usada pelo jogo: a do livro (Tabela 14.4) ou a da reta pelos pontos da Tabela 14.1. */
export function activationEnergy(entry) {
  if (entry.arrhenius) return { Ea: entry.arrhenius.Ea, how: 'livro' };
  const fit = fitArrhenius(entry.points);
  return fit ? { Ea: fit.Ea, how: 'reta' } : null;
}

/**
 * Constante de velocidade a T (K).
 * @returns {{ k: number, how: 'tabela'|'arrhenius'|'reta' } | null} null fora da faixa ou sem dado
 */
export function kAt(entry, T) {
  const point = (entry.points ?? []).find(([t]) => Math.abs(t - T) < 0.01);
  if (point) return { k: point[1], how: 'tabela' };
  const [lo, hi] = tempRange(entry);
  if (T < lo - 1e-9 || T > hi + 1e-9) return null;
  if (entry.arrhenius) return { k: arrheniusK(entry.arrhenius.A, entry.arrhenius.Ea, T), how: 'arrhenius' };
  const fit = fitArrhenius(entry.points);
  return fit ? { k: arrheniusK(fit.A, fit.Ea, T), how: 'reta' } : null;
}

/**
 * Lei integrada: concentração da espécie acompanhada depois de t segundos.
 *   ordem 1: [A] = [A]₀·e^(−kt)          ordem 2: 1/[A] = 1/[A]₀ + kt
 * Para "1+1" (k[A][B]) supomos [A]₀ = [B]₀ e coeficientes iguais: vira a de 2ª ordem.
 */
export function concentrationAt(order, k, A0, t) {
  if (order === 1) return A0 * Math.exp(-k * t);
  if (order === 2) return 1 / (1 / A0 + k * t);
  if (order === 0) return Math.max(0, A0 - k * t);
  throw new Error(`ordem ${order} não suportada`);
}

/** Meia-vida: 1ª ordem ln2/k (não depende de [A]₀); 2ª ordem 1/(k[A]₀); ordem 0 [A]₀/(2k). */
export function halfLife(order, k, A0) {
  if (order === 1) return LN2 / k;
  if (order === 2) return 1 / (k * A0);
  if (order === 0) return A0 / (2 * k);
  throw new Error(`ordem ${order} não suportada`);
}

/** Taxa inicial de consumo: k[A]₀ⁿ (para "1+1" com [A]₀ = [B]₀, k[A]₀²). */
export const initialRate = (order, k, A0) => k * A0 ** order;

/**
 * Constante efetiva quando a lei tem um catalisador ou um reagente em excesso de concentração
 * fixa (ex.: sacarose: k[C12H22O11][H3O⁺] → k' = k[H3O⁺], 1ª ordem na sacarose).
 */
export const pseudoFirstOrderK = (k, fixedConc) => k * fixedConc;

/** Ordem efetiva para as leis integradas. */
export const effectiveOrder = (entry) => (entry.pseudoFirstOrder ? 1 : entry.order);

/**
 * Tudo o que o laboratório de velocidade mostra, para uma temperatura e concentração inicial.
 * @returns null se T está fora da faixa com dado conferido.
 */
export function simulate(entry, { T, A0, fixed = null }) {
  const kk = kAt(entry, T);
  if (!kk) return null;
  const order = effectiveOrder(entry);
  const k = entry.pseudoFirstOrder ? pseudoFirstOrderK(kk.k, fixed ?? entry.pseudoFirstOrder.default) : kk.k;
  const t12 = halfLife(order, k, A0);
  const ea = activationEnergy(entry);
  return {
    k: kk.k,
    kEff: k,
    how: kk.how,
    order,
    rate0: initialRate(order, k, A0),
    halfLife: t12,
    plus10: ea ? kRatio(ea.Ea, T, T + 10) : null,
    Ea: ea,
    curve: (n = 60, tMax = 4 * t12) => Array.from({ length: n + 1 }, (_, i) => {
      const t = (tMax * i) / n;
      return [t, concentrationAt(order, k, A0, t)];
    }),
  };
}

/** Respostas dos objetivos de cinética (Fase 3B). */
export function kineticsAnswer(objective, kinetics) {
  const e = kinetics.byId.get(objective.kinetics);
  if (!e) throw new Error(`cinética desconhecida: ${objective.kinetics}`);
  if (objective.ask === 'ratio') return kRatio(activationEnergy(e).Ea, objective.T, objective.T2);
  const k = kAt(e, objective.T).k;
  const order = effectiveOrder(e);
  if (objective.ask === 'halfLife') return halfLife(order, k, objective.A0);
  if (objective.ask === 'concentration') {
    const c = concentrationAt(order, k, objective.A0, objective.t);
    return objective.unit === 'mmol/L' ? c * 1000 : c;
  }
  if (objective.ask === 'k') return k;
  throw new Error(`pergunta de cinética desconhecida: ${objective.ask}`);
}

/** Prepara o JSON (índice por id e pelas reações do jogo). */
export function buildKinetics(raw) {
  if (!raw) return { reactions: [], byId: new Map(), game: {}, meta: null };
  return { reactions: raw.reactions, byId: new Map(raw.reactions.map((r) => [r.id, r])), game: raw.game ?? {}, meta: raw._meta };
}

/**
 * O que a cinética tem a dizer sobre uma reação do jogo: a ligação curada em kinetics.json (por id)
 * ou, para reações geradas pelas regras, pela equação iônica: H⁺ + OH⁻ → H2O é a neutralização
 * medida (Tabela 14.1) e CO2 + OH⁻ começa pela etapa CO2 + OH⁻ → HCO3⁻ (Tabela 14.4).
 * @returns {{ kinetics?: string, catalysis?: boolean, note: string, source: object } | null}
 */
export function kineticsLink(reaction, data) {
  const K = data.kinetics;
  if (!K) return null;
  if (K.game[reaction.id]) return K.game[reaction.id];
  const ni = reaction.netIonic;
  if (!ni) return null;
  const has = (side, f) => side.some((e) => e.formula === f);
  if (ni.reactants.length === 2 && has(ni.reactants, 'H+') && has(ni.reactants, 'OH-') && ni.products.length === 1 && has(ni.products, 'H2O')) {
    return { ...K.game['hcl-naoh'], note: 'O que reage de verdade é H⁺ (H3O⁺) + OH⁻ → H2O, uma das reações mais rápidas que existem.' };
  }
  if (has(ni.reactants, 'CO2') && has(ni.reactants, 'OH-')) {
    return { kinetics: 'co2-oh', note: 'O primeiro passo é o CO2 capturado pelo OH⁻ (CO2 + OH⁻ → HCO3⁻), com energia de ativação baixa: é rápido à temperatura ambiente.', source: K.game['caoh2-co2'].source };
  }
  return null;
}
