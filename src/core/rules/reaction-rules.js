// Motor de regras (Fase 2): reações e "não reage" para combinações que não estão na base curada.
//
// Cada regra decide QUAIS substâncias se formam (a partir de íons, solubilidade, série
// eletroquímica e caráter ácido/básico); os coeficientes vêm sempre do balanceamento automático.
// Os textos, fontes e padrões de segurança ficam em data/rules.json.
//
// Correção química: uma regra só devolve 'reaction' ou 'no-reaction' quando é sólida. Nos casos
// em que a química real foge da regra simples (anfóteros, ácidos oxidantes, metais que atacam a
// água, compostos que não existem...), devolve 'unknown' explicando o motivo.
//
// O conteúdo curado sempre tem prioridade: o motor (engine.js) só consulta as regras quando a
// base curada não tem a reação.

import { setKey, isMetal } from '../data.js';
import { balance, BalanceError } from '../balancer.js';
import { solubility, pairProblem, pairKey } from '../ions.js';
import { parseFormula } from '../formula.js';

const fmtV = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2).replace('.', ',')} V`;
const fill = (tpl, vars) => (tpl ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
const short = (sub) => {
  const n = sub.name.replace(/\s*\(.*\)\s*$/, '');
  return n.charAt(0).toLowerCase() + n.slice(1);
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

export function createRules(data) {
  const R = data.rules;
  const ions = data.ions;
  if (!R || !ions) return { resolver: { id: 'rules', find: () => [] }, explainer: { id: 'rules', explain: () => null }, evaluate: () => null };

  const series = new Map(data.reactivitySeries.map((e) => [e.metal, e]));
  const seriesByCation = new Map(data.reactivitySeries.map((e) => [e.cation, e]));

  /** Composição iônica: `ions` (sais, bases, ácidos) ou desenho iônico (óxidos). */
  const ionicOf = (sub) => {
    const st = data.structures.substances[sub.id];
    const io = sub.ions ?? (st?.kind === 'ionic' ? st : null);
    return io ? { cation: io.cation.formula, anion: io.anion.formula } : null;
  };
  const compoundByPair = new Map();
  const acidByAnion = new Map();
  for (const s of data.substances) {
    const io = ionicOf(s);
    if (!io) continue;
    if (io.cation === 'H+') acidByAnion.set(io.anion, s);
    else compoundByPair.set(pairKey(io.cation, io.anion), s);
  }
  const sub = (id) => data.substancesById.get(id);
  const compound = (cation, anion) => compoundByPair.get(pairKey(cation, anion)) ?? null;

  const isAcid = (s) => s.categories.includes('acido') && ionicOf(s)?.cation === 'H+';
  const isStrongAcid = (s) => R.strongAcids.includes(s.id);
  const isOxidizingAcid = (s) => R.oxidizingAcids.includes(s.id);
  /** Composto iônico (não ácido) cujos dois íons estão no catálogo: só esses entram nas regras de troca. */
  const ionicNonAcid = (s) => {
    const io = ionicOf(s);
    return io && io.cation !== 'H+' && ions.cationsByFormula.has(io.cation) && ions.anionsByFormula.has(io.anion) ? io : null;
  };
  const solOf = (s) => {
    const io = ionicNonAcid(s);
    return io ? solubility(io.cation, io.anion, ions) : null;
  };
  const cationInfo = (formula) => ions.cationsByFormula.get(formula);
  const isOrganicFuel = (s) => {
    if (!s.categories.some((c) => c === 'organico' || c === 'hidrocarboneto') || s.categories.includes('sal')) return false;
    if (s.state === 'aq' || isAcid(s)) return false; // o "ácido acético" do jogo é vinagre: 4% em água não queima
    const els = Object.keys(parseFormula(s.formula).atoms);
    return els.includes('C') && els.includes('H') && els.every((e) => ['C', 'H', 'O'].includes(e));
  };

  /** Estado numa reação em água: iônico solúvel → aq; insolúvel → s; ácido → aq. */
  const stateIn = (s, asReactant = false) => {
    if (isAcid(s)) return 'aq';
    if (asReactant && solOf(s)?.result === 'slightly' && ionicOf(s)?.anion !== 'O^2-') return 'aq';
    if (ionicOf(s)?.anion === 'O^2-') return 's'; // óxidos entram como sólidos (os solúveis reagem com a água)
    const so = solOf(s);
    if (so) return so.result === 'soluble' ? 'aq' : 's';
    return s.state;
  };
  const stateText = (s) => {
    const so = solOf(s);
    return so ? R.stateText[so.result] : '';
  };

  // ---------- Equação iônica líquida ----------
  function netIonic(reactants, products) {
    const expand = (entries) => {
      const m = new Map();
      for (const e of entries) {
        const s = sub(e.id);
        const io = ionicOf(s);
        const dissolved = e.state === 'aq' && io && (!isAcid(s) || isStrongAcid(s));
        const parts = dissolved
          ? [[io.cation, e.coef * (s.ions ?? data.structures.substances[s.id]).cation.count], [io.anion, e.coef * (s.ions ?? data.structures.substances[s.id]).anion.count]]
          : [[s.formula, e.coef]];
        for (const [formula, coef] of parts) {
          const st = dissolved ? 'aq' : e.state;
          const key = `${formula}|${st}`;
          m.set(key, { formula, state: st, coef: (m.get(key)?.coef ?? 0) + coef });
        }
      }
      return m;
    };
    const L = expand(reactants);
    const P = expand(products);
    let changed = false;
    for (const [k, v] of L) {
      if (!P.has(k)) continue;
      const c = Math.min(v.coef, P.get(k).coef);
      v.coef -= c;
      P.get(k).coef -= c;
      changed = true;
    }
    const side = (m) => [...m.values()].filter((x) => x.coef > 0);
    let l = side(L);
    let p = side(P);
    if (!l.length || !p.length) return null;
    const ionic = [...l, ...p].some((x) => parseFormula(x.formula).charge !== 0);
    if (!ionic && !changed) return null;
    const g = [...l, ...p].reduce((a, x) => gcd(a, x.coef), 0);
    l = l.map((x) => ({ ...x, coef: x.coef / g }));
    p = p.map((x) => ({ ...x, coef: x.coef / g }));
    return { reactants: l, products: p, note: R.netIonicNote };
  }

  // ---------- Montagem de uma reação gerada ----------
  function build(ruleId, reactantSubs, productSubs, vars, { productStates = {}, safetyLevel, safetyWhy } = {}) {
    const rule = R.rules[ruleId];
    let coefs;
    try {
      coefs = balance(reactantSubs.map((s) => s.formula), productSubs.map((s) => s.formula));
    } catch (err) {
      if (err instanceof BalanceError) return null;
      throw err;
    }
    const fixedState = { H2O: 'l', CO2: 'g', H2: 'g', O2: 'g' };
    const reactants = reactantSubs.map((s, i) => ({ id: s.id, coef: coefs.reactants[i], state: fixedState[s.id] ?? stateIn(s, true) }));
    const products = productSubs.map((s, i) => ({ id: s.id, coef: coefs.products[i], state: productStates[s.id] ?? fixedState[s.id] ?? stateIn(s) }));
    if (vars.saltState === undefined) vars.saltState = '';

    const hazards = [...new Set([...reactantSubs, ...productSubs].map((s) => s.hazard).filter(Boolean))];
    const levels = ['seguro', 'cuidado', 'perigo'];
    let level = safetyLevel ?? rule.safety.level;
    if (hazards.length && levels.indexOf(level) < 1) level = 'cuidado';
    const why = [safetyWhy ?? rule.safety.why, ...hazards.slice(0, 3)].join(' ');

    const tags = [...rule.tags];
    if (products.some((p) => p.state === 's') && reactants.some((r) => r.state === 'aq') && !tags.includes('precipitacao')) tags.push('precipitacao');
    const ids = reactantSubs.map((s) => s.id);
    const reaction = {
      id: `gen:${setKey(ids)}`,
      generated: true,
      rule: ruleId,
      name: cap(fill(rule.name, vars)),
      reactants,
      products,
      types: [...rule.types],
      tags,
      conditions: rule.conditions ? rule.conditions.map((c) => [...c]) : [],
      explanation: cap(fill(rule.explanation, vars)),
      why: fill(rule.why, vars),
      safety: { level, why, home: rule.safety.home },
      source: { ...rule.source, justification: fill(rule.source.justification, vars) },
    };
    if (rule.conditionNote) reaction.conditionNote = rule.conditionNote;
    const ni = netIonic(reactants, products);
    if (ni) reaction.netIonic = ni;
    return reaction;
  }

  function outcome(id, vars = {}) {
    const o = R.outcomes[id];
    const res = { kind: o.kind, reasonId: `rule:${id}`, title: cap(fill(o.title, vars)), reason: fill(o.reason, vars) };
    if (o.source) res.source = o.source;
    return res;
  }

  // ---------- Regras para pares ----------
  const OH = 'OH-';
  const O2m = 'O^2-';
  const STRONG_ACID_ANIONS = new Set(['Cl-', 'NO3-', 'SO4^2-']);

  function acidPlus(acid, other) {
    const aio = ionicOf(acid);
    const vars = { acid: short(acid) };

    if (isAcid(other)) {
      if (isOxidizingAcid(acid) || isOxidizingAcid(other)) {
        const ox = isOxidizingAcid(acid) ? acid : other;
        const rest = ox === acid ? other : acid;
        return rest.id === 'HCl' ? outcome('agua-regia') : outcome('mistura-acidos-oxidante', { a: short(ox) });
      }
      return outcome('dois-acidos', { a: short(acid), b: short(other) });
    }

    if (other.id === 'NH3') {
      if (R.weakAcidSkip.includes(acid.id)) return null;
      const salt = compound('NH4+', aio.anion);
      if (!salt) return null;
      return build('neutralizacao-amonia', [other, acid], [salt], { ...vars, salt: short(salt), saltState: stateText(salt) });
    }

    if (isMetal(other)) {
      const m = series.get(other.elementOf);
      if (!m) return null;
      if (isOxidizingAcid(acid)) return outcome('acido-oxidante', { acid: short(acid), metal: short(other) });
      if (m.E0 >= 0) return null; // "não reage" fica com a regra da série de reatividade
      if (!isStrongAcid(acid) && (R.weakAcidSkip.includes(acid.id) || m.E0 > R.weakAcidMaxE0 || R.passivated.includes(other.elementOf))) {
        return outcome('acido-fraco-metal', { acid: short(acid), metal: short(other) });
      }
      const problem = pairProblem(m.cation, aio.anion, ions);
      if (problem?.outOfCatalog) return null;
      if (problem) return outcome('anomalia', { expected: `um sal de ${short(other)}`, why: problem.why });
      const salt = compound(m.cation, aio.anion);
      if (!salt) return null;
      const danger = m.E0 < R.waterReactiveBelow;
      return build('metal-acido', [other, acid], [salt, sub('H2')], { ...vars, metal: short(other), cation: cationInfo(m.cation)?.name ?? m.cation, salt: short(salt), saltState: stateText(salt), E0: fmtV(m.E0) }, danger ? { safetyLevel: 'perigo', safetyWhy: fill(R.rules['metal-acido'].dangerWhy, { metal: short(other) }) } : {});
    }

    const oio = ionicNonAcid(other);
    if (!oio) return null;

    // ácido + hidróxido / óxido / carbonato / bicarbonato / sal
    const saltFor = (cation) => {
      const problem = pairProblem(cation, aio.anion, ions);
      if (problem?.outOfCatalog) return {};
      if (problem) return { problem };
      return { salt: compound(cation, aio.anion) };
    };

    if (R.weakAcidSkip.includes(acid.id) && (oio.anion === OH || oio.anion === O2m)) return null; // H2CO3: carbonato ou bicarbonato, conforme as proporções
    if (oio.anion === OH) {
      const { salt, problem } = saltFor(oio.cation);
      if (problem) return outcome('anomalia', { expected: `um sal de ${cationInfo(oio.cation).name}`, why: problem.why });
      if (!salt) return null;
      return build('neutralizacao', [acid, other], [salt, sub('H2O')], { ...vars, base: short(other), salt: short(salt), saltState: stateText(salt), cation: cationInfo(oio.cation).name, anion: ions.anionsByFormula.get(aio.anion).name });
    }
    if (oio.anion === O2m) {
      const cat = cationInfo(oio.cation);
      if (!isStrongAcid(acid) && ![1, 2].includes(cat.group)) return outcome('oxido-acido-fraco', { oxide: short(other), acid: short(acid) });
      const { salt, problem } = saltFor(oio.cation);
      if (problem) return outcome('anomalia', { expected: `um sal de ${cat.name}`, why: problem.why });
      if (!salt) return null;
      return build('acido-oxido', [other, acid], [salt, sub('H2O')], { ...vars, oxide: short(other), salt: short(salt), saltState: stateText(salt) });
    }
    if (oio.anion === 'CO3^2-' || oio.anion === 'HCO3-') {
      if (R.weakAcidSkip.includes(acid.id)) return null;
      const { salt, problem } = saltFor(oio.cation);
      if (problem) return outcome('anomalia', { expected: `um sal de ${cationInfo(oio.cation).name}`, why: problem.why });
      if (!salt) return null;
      return build('acido-carbonato', [other, acid], [salt, sub('H2O'), sub('CO2')], { ...vars, carbonate: short(other), salt: short(salt), saltState: stateText(salt) });
    }
    // ácido forte + sal de ácido forte: só há reação se precipitar
    if (isStrongAcid(acid) && STRONG_ACID_ANIONS.has(oio.anion)) {
      const newAcid = acidByAnion.get(oio.anion);
      if (!newAcid) return null;
      return exchange(acid, other, { cation: 'H+', anion: aio.anion }, oio, newAcid);
    }
    return null;
  }

  /**
   * Troca de parceiros entre dois eletrólitos em solução (dupla troca / precipitação).
   * `acidProduct`: quando um dos reagentes é um ácido forte, o produto com H⁺ é esse ácido.
   */
  function exchange(a, b, ia, ib, acidProduct = null) {
    if (ia.cation === ib.cation || ia.anion === ib.anion) return outcome('mesmo-ion', { a: short(a), b: short(b) });
    for (const s of [a, b]) {
      if (!isAcid(s) && solOf(s)?.result === 'insoluble') return outcome('reagente-insoluvel', { a: short(s) });
    }
    const pairs = [[ia.cation, ib.anion], [ib.cation, ia.anion]];
    const products = [];
    for (const [c, an] of pairs) {
      if (c === 'H+') {
        products.push({ sub: acidProduct, sol: { result: 'soluble' } });
        continue;
      }
      const problem = pairProblem(c, an, ions);
      const anomaly = ions.anomaliesByPair.get(pairKey(c, an));
      if (problem || anomaly) return outcome('anomalia', { expected: `${cationInfo(c).name} com ${ions.anionsByFormula.get(an).name}`, why: (problem ?? anomaly).why });
      const s = compound(c, an);
      if (!s) return null;
      products.push({ sub: s, sol: solubility(c, an, ions) });
    }
    const slightReactant = [a, b].find((s) => !isAcid(s) && solOf(s)?.result === 'slightly');
    const pptAnion = products.find((p) => p.sol.result === 'insoluble' && p.sub !== acidProduct);
    if (slightReactant && !(pptAnion && ionicOf(pptAnion.sub).anion === 'CO3^2-')) return outcome('reagente-pouco-soluvel', { a: short(slightReactant) });
    const slight = products.find((p) => p.sol.result === 'slightly');
    if (slight) return outcome('pouco-soluvel', { p: short(slight.sub), rule: slight.sol.rule.text });
    const ppt = products.find((p) => p.sol.result === 'insoluble');
    if (!ppt) return outcome('sem-precipitado', { a: short(a), b: short(b), p1: products[0].sub.formula, p2: products[1].sub.formula });
    const states = Object.fromEntries(products.map((p) => [p.sub.id, p.sol.result === 'insoluble' ? 's' : 'aq']));
    return build('precipitacao', [a, b], products.map((p) => p.sub), { a: short(a), b: short(b), ppt: cap(short(ppt.sub)), rule: ppt.sol.rule.text }, { productStates: states });
  }

  function metalPlusSalt(metal, salt) {
    const io = ionicNonAcid(salt);
    if (!io || io.anion === O2m) return null;
    const m = series.get(metal.elementOf);
    const c = seriesByCation.get(io.cation);
    if (io.anion === OH && R.amphotericMetals.includes(metal.elementOf) && solOf(salt)?.result !== 'insoluble') {
      return outcome('metal-anfotero-base', { metal: short(metal), b: short(salt) });
    }
    if (!m || !c || m.metal === c.metal || m.E0 >= c.E0) return null; // fica com a regra da série
    if (solOf(salt)?.result === 'insoluble') return outcome('reagente-insoluvel', { a: short(salt) });
    if (solOf(salt)?.result !== 'soluble') return null;
    if (m.E0 < R.waterReactiveBelow) return outcome('reage-com-agua', { metal: short(metal), E0: fmtV(m.E0), salt0: short(salt) });
    if (c.E0 < R.depositMinE0) return outcome('nao-deposita', { metal: short(metal), otherMetal: short(data.elementalBySymbol.get(c.metal) ?? metal), E0b: fmtV(c.E0) });
    const problem = pairProblem(m.cation, io.anion, ions);
    if (problem?.outOfCatalog) return null;
    if (problem) return outcome('anomalia', { expected: `um sal de ${short(metal)}`, why: problem.why });
    const newSalt = compound(m.cation, io.anion);
    const freed = data.elementalBySymbol.get(c.metal);
    if (!newSalt || !freed) return null;
    return build('metal-sal', [metal, salt], [newSalt, freed], {
      metal: short(metal), salt0: short(salt), salt: short(newSalt), otherMetal: short(freed),
      otherCation: cationInfo(io.cation)?.name ?? io.cation, cation: cationInfo(m.cation)?.name ?? m.cation,
      E0: fmtV(m.E0), E0b: fmtV(c.E0),
    });
  }

  function pair(a, b) {
    if (a.id === 'O2' || b.id === 'O2') {
      const fuel = a.id === 'O2' ? b : a;
      if (isOrganicFuel(fuel)) return build('combustao', [fuel, sub('O2')], [sub('CO2'), sub('H2O')], { fuel: short(fuel), Fuel: cap(short(fuel)) });
      return null;
    }

    if (isAcid(a)) return acidPlus(a, b);
    if (isAcid(b)) return acidPlus(b, a);

    if (a.id === 'H2O' || b.id === 'H2O') {
      const x = a.id === 'H2O' ? b : a;
      if (isMetal(x)) {
        const m = series.get(x.elementOf);
        return m && m.E0 > 0 ? outcome('metal-nobre-agua', { a: short(x), E0: fmtV(m.E0) }) : null;
      }
      const st = data.structures.substances[x.id];
      if (st?.kind === 'ionic' && st.anion.formula === 'O2^2-') return outcome('peroxido-agua', { a: short(x) });
      const io = ionicNonAcid(x);
      if (!io || io.anion !== O2m) return null;
      const cat = cationInfo(io.cation);
      if (io.cation === 'Mg^2+') return outcome('mgo-agua');
      const so = solubility(io.cation, io.anion, ions);
      if (so.result === 'insoluble') return outcome('oxido-insoluvel', { a: short(x) });
      const hyd = compound(io.cation, OH);
      if (!hyd || ![1, 2].includes(cat.group)) return null;
      return build('oxido-agua', [x, sub('H2O')], [hyd], { oxide: short(x), hydroxide: short(hyd), saltState: stateText(hyd) });
    }

    if (a.id === 'CO2' || b.id === 'CO2') {
      const base = a.id === 'CO2' ? b : a;
      const io = ionicNonAcid(base);
      if (!io || io.anion !== OH) return null;
      if (solOf(base).result === 'insoluble') return outcome('co2-base-insoluvel', { b: short(base) });
      const carb = compound(io.cation, 'CO3^2-');
      if (!carb) return null;
      return build('co2-base', [base, sub('CO2')], [carb, sub('H2O')], { base: short(base), salt: short(carb), saltState: stateText(carb) });
    }

    if (isMetal(a) && !isMetal(b)) return metalPlusSalt(a, b);
    if (isMetal(b) && !isMetal(a)) return metalPlusSalt(b, a);

    // duas bases (hidróxidos e amônia)
    const isBase = (s) => ionicNonAcid(s)?.anion === OH || s.id === 'NH3';
    if (isBase(a) && isBase(b)) {
      const amph = [a, b].find((s) => ['Al^3+', 'Zn^2+'].includes(ionicNonAcid(s)?.cation));
      const strong = [a, b].find((s) => s !== amph && s.id !== 'NH3' && solOf(s)?.result !== 'insoluble');
      if (amph && strong) return outcome('anfotero', { a: short(amph), b: short(strong) });
      if (a.id === 'NH3' || b.id === 'NH3') return outcome('duas-bases', { a: short(a), b: short(b) });
    }

    const ia = ionicNonAcid(a);
    const ib = ionicNonAcid(b);
    // HCO3⁻ é anfiprótico: com OH⁻ é uma reação ácido-base (HCO3⁻ + OH⁻ → CO3²⁻ + H2O), não uma troca.
    const bic = [[a, ia], [b, ib]].find(([, io]) => io?.anion === 'HCO3-');
    const hyd = [[a, ia], [b, ib]].find(([, io]) => io?.anion === OH);
    if (bic && hyd) {
      if (solOf(hyd[0])?.result === 'insoluble') return outcome('reagente-insoluvel', { a: short(hyd[0]) });
      const carb = compound(bic[1].cation, 'CO3^2-');
      if (bic[1].cation !== hyd[1].cation || !carb) return outcome('bicarbonato-base', { a: short(bic[0]), b: short(hyd[0]) });
      return build('bicarbonato-base', [bic[0], hyd[0]], [carb, sub('H2O')], { a: short(bic[0]), b: short(hyd[0]), salt: short(carb), saltState: stateText(carb) });
    }
    if (ia && ib && ia.anion !== O2m && ib.anion !== O2m) {
      if (ia.anion === OH && ib.anion === OH) return outcome('duas-bases', { a: short(a), b: short(b) });
      return exchange(a, b, ia, ib);
    }
    return null;
  }

  function single(s, itemIds) {
    const io = ionicNonAcid(s);
    if (!io || io.anion !== 'CO3^2-') return null;
    if (R.carbonateDecomposition.includes(io.cation)) {
      const oxide = compound(io.cation, O2m);
      if (!oxide) return null;
      return build('decomposicao-carbonato', [s], [oxide, sub('CO2')], { carbonate: short(s), oxide: short(oxide) }, { productStates: { [oxide.id]: 's' } });
    }
    return itemIds.includes('calor') ? outcome('decomposicao-alta', { a: short(s) }) : null;
  }

  /** Avalia uma combinação: { reaction } | { outcome } | null. */
  function evaluate(substanceIds, itemIds = []) {
    const subs = [...new Set(substanceIds)].map(sub).filter(Boolean);
    let res = null;
    if (subs.length === 1) res = single(subs[0], itemIds);
    else if (subs.length === 2) res = pair(subs[0], subs[1]);
    if (!res) return null;
    return res.reactants ? { reaction: res } : { outcome: res };
  }

  return {
    evaluate,
    resolver: {
      id: 'rules',
      find(substanceIds, itemIds = []) {
        const r = evaluate(substanceIds, itemIds);
        return r?.reaction ? [r.reaction] : [];
      },
    },
    explainer: {
      id: 'rules',
      explain({ substanceIds, itemIds }) {
        return evaluate(substanceIds, itemIds)?.outcome ?? null;
      },
    },
  };
}
