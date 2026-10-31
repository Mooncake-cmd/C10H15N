// Painel de explicação: mostra o resultado de uma combinação com equação, porquê,
// conservação de átomos/massa, segurança e fonte.

import { html, raw, esc, TYPE_LABEL } from './dom.js';
import { formatFormulaHTML } from '../core/formula.js';
import { resolveSide, checkConservation, formatEquationHTML } from '../core/equation.js';
import { molarMass, formatFormulaText } from '../core/formula.js';
import { mountReactionStage, mountBounceStage } from './reaction-stage.js';
import { stoichiometry, percentYield } from '../core/stoichiometry.js';
import { reactionThermo, heatFor } from '../core/thermo.js';
import { kineticsLink, kAt, halfLife } from '../core/kinetics.js';
import { formatSci, formatDuration, sourceText } from './kinetics-lab.js';

let stopStage = () => {};

/** Monta a animação no placeholder [data-stage]; um erro aqui nunca derruba o painel. */
function mountStage(root, mount) {
  const el = root.querySelector('[data-stage]');
  if (!el) return;
  try {
    stopStage = mount(el);
  } catch (err) {
    console.warn('Animação indisponível:', err);
    el.remove();
  }
}

const SAFETY_LABEL = { seguro: '✅ Seguro', cuidado: '⚠️ Cuidado', perigo: '☠️ Perigo' };
const fmtNum = (n, d = 2) => n.toFixed(d).replace('.', ',');

function sourceHTML(data, source) {
  if (!source) return '';
  const ref = data.sources[source.ref];
  return html`<footer class="source"><strong>Fonte:</strong> ${ref ?? source.ref}${raw(source.topic ? ` — <em>${esc(source.topic)}</em>` : '')}.
    ${raw(source.justification ? `<br><span class="muted">${esc(source.justification)}</span>` : '')}
    ${raw((source.seeAlso ?? []).map((sa) => `<br><span class="small">Veja também: ${esc(data.sources[sa.ref] ?? sa.ref)}${sa.topic ? ` — <em>${esc(sa.topic)}</em>` : ''}${sa.pages ? `, p. ${esc(sa.pages)}` : ''}.</span>`).join(''))}</footer>`;
}

function conservationHTML(data, reactants, products) {
  const res = checkConservation(reactants, products);
  const mass = (side) =>
    side.map((sp) => ({ sp, m: molarMass(sp.formula, data.atomicMasses) }));
  const massRows = (side) =>
    mass(side)
      .map(({ sp, m }) => html`<tr><td>${raw(sp.coef > 1 ? sp.coef + ' ' : '')}${raw(formatFormulaHTML(sp.formula))}</td><td>${fmtNum(m)} g/mol</td><td>${fmtNum(m * sp.coef)} g</td></tr>`)
      .join('');
  const total = (side) => mass(side).reduce((a, { sp, m }) => a + m * sp.coef, 0);
  return html`
    <details class="conservation">
      <summary>Conservação: confira os átomos e a massa</summary>
      <table class="atoms">
        <thead><tr><th>Elemento</th><th>Reagentes</th><th>Produtos</th></tr></thead>
        <tbody>${raw(res.atoms.map((a) => html`<tr><td>${a.element}</td><td>${a.left}</td><td>${a.right}</td></tr>`).join(''))}</tbody>
      </table>
      <p class="small">Mesmo número de cada átomo dos dois lados: os átomos só se rearranjam. Por isso a massa também se conserva:</p>
      <table class="masses">
        <thead><tr><th>Espécie</th><th>Massa molar</th><th>Massa</th></tr></thead>
        <tbody>${raw(massRows(reactants))}<tr class="sum"><td>Reagentes</td><td></td><td>${fmtNum(total(reactants))} g</td></tr>
        ${raw(massRows(products))}<tr class="sum"><td>Produtos</td><td></td><td>${fmtNum(total(products))} g</td></tr></tbody>
      </table>
      <p class="small muted">Massas para os coeficientes lidos em mol (ex.: 2 mol de Na = ${fmtNum(2 * data.atomicMasses.Na)} g). Estequiometria completa chega na Fase 2.</p>
    </details>`;
}

/** Calculadora de estequiometria (seções G, L e M de Atkins & Jones; gases pela lei dos gases ideais). */
function calculatorHTML(data, reactants, products) {
  const unitOptions = (sp) =>
    [['g', 'g'], ['mol', 'mol'], ...(sp.state === 'g' ? [['L', 'L de gás']] : []), ...(sp.state === 'aq' ? [['sol', 'mL de solução']] : [])]
      .map(([v, t]) => `<option value="${v}">${t}</option>`)
      .join('');
  const inputs = reactants
    .map((sp) => {
      const m = molarMass(sp.formula, data.atomicMasses);
      return html`<div class="calc-in" data-row="${sp.id}"><span class="calc-name">${raw(formatFormulaHTML(sp.formula))}</span>
        <input type="number" min="0" step="any" inputmode="decimal" data-calc="${sp.id}" aria-label="Quantidade de ${sp.formula}">
        <select data-unit="${sp.id}" aria-label="Unidade de ${sp.formula}">${raw(unitOptions(sp))}</select>
        <span class="calc-conc" hidden>× <input type="number" min="0" step="any" inputmode="decimal" data-conc="${sp.id}" aria-label="Concentração de ${sp.formula} em mol/L"> mol/L</span>
        <span class="small muted">M = ${fmtNum(m)} g/mol</span></div>`;
    })
    .join('');
  const yieldOpts = products.map((sp) => `<option value="${esc(sp.id)}">${esc(formatFormulaText(sp.formula))}</option>`).join('');
  return html`<details class="stoich-calc">
      <summary>Calculadora: quanto de produto sai?</summary>
      <p class="small">Informe um reagente (o outro fica "de sobra") ou dois, para descobrir o <strong>reagente limitante</strong>. Massa: mol = g ÷ massa molar. Gás (25 °C, 1 atm): mol = L ÷ 24,47. Solução: mol = L × mol/L.</p>
      <div class="calc-inputs">${raw(inputs)}</div>
      <div class="calc-out small muted" aria-live="polite">Os resultados aparecem aqui.</div>
      <div class="calc-yield small">Rendimento: obtive <input type="number" min="0" step="any" inputmode="decimal" data-actual aria-label="Massa obtida em gramas"> g de
        <select data-actual-id aria-label="Produto">${raw(yieldOpts)}</select> <span class="calc-yield-out"></span></div>
    </details>`;
}

function mountCalculator(root, data, reaction) {
  const box = root.querySelector('.stoich-calc');
  if (!box) return;
  const thermo = reactionThermo(reaction, data);
  const out = box.querySelector('.calc-out');
  const yOut = box.querySelector('.calc-yield-out');
  const f = (n) => (n >= 100 ? n.toFixed(1) : n.toFixed(2)).replace('.', ',');
  const num = (el) => parseFloat(String(el?.value ?? '').replace(',', '.'));
  let last = null;
  const update = () => {
    const given = {};
    box.querySelectorAll('[data-calc]').forEach((i) => {
      const id = i.dataset.calc;
      const unit = box.querySelector(`[data-unit="${CSS.escape(id)}"]`).value;
      box.querySelector(`[data-row="${CSS.escape(id)}"] .calc-conc`).hidden = unit !== 'sol';
      const v = num(i);
      if (!Number.isFinite(v) || v < 0) return;
      if (unit === 'sol') {
        const c = num(box.querySelector(`[data-conc="${CSS.escape(id)}"]`));
        if (Number.isFinite(c) && c >= 0) given[id] = { mL: v, M: c };
      } else given[id] = unit === 'g' ? { g: v } : unit === 'mol' ? { mol: v } : { L: v };
    });
    if (!Object.keys(given).length) {
      out.textContent = 'Os resultados aparecem aqui.';
      yOut.textContent = '';
      last = null;
      return;
    }
    const res = stoichiometry(reaction, data, given);
    const q = heatFor(res.extent, thermo.dH);
    last = res;
    const name = (id) => formatFormulaHTML(data.substancesById.get(id).formula);
    const rows = res.products
      .map((p) => `<tr><td>${name(p.id)}</td><td>${f(p.mol)} mol</td><td><strong>${f(p.grams)} g</strong>${p.liters !== null ? ` · ${f(p.liters)} L` : ''}</td></tr>`)
      .join('');
    const used = res.reactants
      .map((r) => `<tr><td>${name(r.id)}</td><td>${f(r.used / r.molarMass)} mol</td><td>${f(r.used)} g usados${r.left ? ` · sobram ${f(r.left)} g` : r.given === null ? ' (necessários)' : ''}</td></tr>`)
      .join('');
    out.innerHTML =
      (q != null ? `<p><strong>Calor:</strong> ${q < 0 ? 'libera' : 'absorve'} ${f(Math.abs(q))} kJ (ΔH° × ${f(res.extent)} mol de reação).</p>` : '') +
      (res.limiting ? `<p><strong>Reagente limitante:</strong> ${name(res.limiting)} — ele acaba primeiro e decide quanto produto sai.</p>` : '') +
      `<table class="calc-table"><thead><tr><th>Produto</th><th>Quantidade</th><th>Massa (e volume, se gás)</th></tr></thead><tbody>${rows}</tbody></table>` +
      `<table class="calc-table"><thead><tr><th>Reagente</th><th>Quantidade</th><th>Massa</th></tr></thead><tbody>${used}</tbody></table>`;
    const actual = num(box.querySelector('[data-actual]'));
    const p = res.products.find((x) => x.id === box.querySelector('[data-actual-id]').value);
    const pct = Number.isFinite(actual) && p ? percentYield(actual, p.grams) : NaN;
    yOut.textContent = Number.isFinite(pct)
      ? `→ ${f(pct)}% do teórico (${f(p.grams)} g)${pct > 100 ? ' — acima de 100%: a massa medida deve conter impurezas ou água, ou a conta tem algum erro.' : ''}`
      : '';
  };
  box.addEventListener('input', update);
  box.addEventListener('change', update);
}


/** Seção "Energia" (Fase 3A): ΔH°, ΔS°, ΔG° a 25 °C, com diagrama de níveis de energia. */
function energyHTML(data, r) {
  const t = reactionThermo(r, data);
  const kj = (x) => `${x < 0 ? '−' : x > 0 ? '+' : ''}${fmtNum(Math.abs(x), Math.abs(x) >= 100 ? 0 : 1)} kJ`;
  const srcText = () => {
    const by = new Map();
    for (const { ref, page } of t.refs) (by.get(ref) ?? by.set(ref, new Set()).get(ref)).add(page);
    const name = { 'atkins-fq': "Atkins' Physical Chemistry, 12. ed.", 'atkins-jones': 'Atkins & Jones, Chemical Principles, 5. ed.' };
    return [...by].map(([ref, pages]) => `${name[ref] ?? ref}, p. ${[...pages].sort().join(', ')}`).join('; ');
  };
  if (t.dH == null) {
    return html`<section class="energy"><h3>Energia</h3>
      <p class="small muted">Sem dado conferido para ${t.missing.join(', ')}: o jogo não estima o calor desta reação.</p></section>`;
  }
  const exo = t.dH < 0;
  const first = r.reactants[0];
  const firstF = formatFormulaHTML(data.substancesById.get(first.id).formula);
  const perMol = first.coef > 1 ? ` (${kj(t.dH / first.coef)} por mol de ${firstF})` : '';
  const ART = { calor: 'o calor', faisca: 'uma faísca', eletricidade: 'a eletricidade', luz: 'a luz intensa', catalisador: 'um catalisador' };
  const ids = [...new Set((r.conditions ?? []).flat())];
  const condTxt = ids.map((id) => data.itemsById.get(id)?.name.toLowerCase()).filter(Boolean).join(' ou ');
  const condWho = ids.map((id) => ART[id] ?? data.itemsById.get(id)?.name.toLowerCase()).join(' ou ');
  let gibbs = '';
  if (t.dG != null) {
    if (t.dG < 0) {
      gibbs = `<strong>ΔG° = ${kj(t.dG)}</strong>: a reação é <strong>espontânea</strong> — os produtos são favorecidos.` +
        (condTxt ? ` Mesmo assim, ela precisa de ${esc(condTxt)} para começar: espontânea não quer dizer rápida. Falta vencer a energia de ativação.` : '');
    } else {
      gibbs = `<strong>ΔG° = ${kj(t.dG)}</strong>: a 25 °C a reação <strong>não é espontânea</strong>` +
        (condTxt ? ` — só acontece porque ${esc(condWho)} fornece a energia que falta.` : '.') +
        (t.dH > 0 && t.dS > 0 ? ' Como ΔS° > 0, aquecendo bastante o termo −TΔS° vence o ΔH° e ela passa a ser espontânea — é por isso que se usa um forno.' : '');
    }
  }
  const entropy = t.dS == null ? '' : `<p class="small">ΔS° = ${t.dS > 0 ? '+' : t.dS < 0 ? '−' : ''}${fmtNum(Math.abs(t.dS), 0)} J/K: a desordem ${t.dS > 0 ? 'aumenta (por exemplo, forma-se gás)' : t.dS < 0 ? 'diminui (por exemplo, gás vira líquido ou sólido)' : 'quase não muda'}.</p>`;
  // Diagrama: reagentes à esquerda, produtos à direita; altura proporcional a ΔH (com mínimo visível).
  const h = Math.max(40, Math.min(90, Math.abs(t.dH) / 10));
  const yR = exo ? 22 : 22 + h;
  const yP = exo ? 22 + h : 22;
  const svg = `<svg class="energy-svg" viewBox="0 0 260 ${h + 40}" role="img" aria-label="Diagrama de energia: os produtos ficam ${exo ? 'abaixo' : 'acima'} dos reagentes">
    <line class="lvl" x1="10" y1="${yR}" x2="90" y2="${yR}"/><text x="50" y="${yR - 6}">reagentes</text>
    <line class="lvl" x1="170" y1="${yP}" x2="250" y2="${yP}"/><text x="210" y="${yP - 6}">produtos</text>
    <line class="arrow-${exo ? 'exo' : 'endo'}" x1="130" y1="${yR}" x2="130" y2="${yP + (exo ? -9 : 9)}"/>
    <path class="head-${exo ? 'exo' : 'endo'}" d="${exo ? `M124,${yP - 10} L136,${yP - 10} L130,${yP} z` : `M124,${yP + 10} L136,${yP + 10} L130,${yP} z`}"/>
    <text class="dh" x="138" y="${(yR + yP) / 2 + 5}" text-anchor="start">ΔH° ${exo ? '< 0' : '> 0'}</text></svg>`;
  return html`<section class="energy"><h3>Energia (a 25 °C)</h3>
    <div class="energy-row">${raw(svg)}
      <div><p><strong>ΔH° = ${kj(t.dH)}</strong>: ${exo ? 'libera' : 'absorve'} ${fmtNum(Math.abs(t.dH), 0)} kJ de calor para as quantidades da equação${raw(perMol)}. Reação ${exo ? 'exotérmica' : 'endotérmica'}.</p>
      ${raw(entropy)}${raw(gibbs ? `<p class="small">${gibbs}</p>` : '')}</div></div>
    <p class="small muted">Calculado pela lei de Hess com entalpias e energias livres de formação (${srcText()}).</p></section>`;
}

/** Barreira de energia (energia de ativação); com catalisador, o caminho mais baixo tracejado. */
function barrierSVG(exo, catalyzed) {
  const yR = exo ? 70 : 92;
  const yP = exo ? 92 : 70;
  const hump = (top) => `M10,${yR} L60,${yR} C95,${yR} 100,${top} 130,${top} C160,${top} 165,${yP} 200,${yP} L250,${yP}`;
  return `<svg class="energy-svg barrier-svg" viewBox="0 0 260 112" role="img" aria-label="Diagrama: os reagentes precisam subir uma barreira de energia (energia de ativação) antes de virar produtos${catalyzed ? '; com catalisador, a barreira é mais baixa' : ''}">
    <path class="barrier" d="${hump(14)}"/>${catalyzed ? `<path class="barrier-cat" d="${hump(46)}"/><text x="130" y="42" class="cat-label">com catalisador</text>` : ''}
    <line class="ea" x1="64" y1="${yR}" x2="64" y2="14"/><text x="58" y="${(yR + 14) / 2 + 4}" text-anchor="end">Ea</text>
    <text x="35" y="${yR + 15}">reagentes</text><text x="225" y="${yP + 15}">produtos</text><text x="130" y="10" class="ts-label">complexo ativado</text></svg>`;
}

/** Seção "Velocidade" (Fase 3B): dado medido, catálise ou barreira de ativação — nunca um número inventado. */
function kineticsHTML(data, r) {
  const link = kineticsLink(r, data);
  const conds = new Set((r.conditions ?? []).flat());
  const t = reactionThermo(r, data);
  const exo = t.dH == null ? r.tags.includes('exotermica') || !r.tags.includes('endotermica') : t.dH < 0;
  const labBtn = (id, label = 'Abrir no laboratório de velocidade') => `<button type="button" class="btn btn-ghost btn-small" data-open-kinetics="${esc(id ?? '')}">⏱️ ${esc(label)}</button>`;
  if (link?.kinetics) {
    const e = data.kinetics.byId.get(link.kinetics);
    const k = kAt(e, 298);
    const ex = k ? halfLife(e.order, k.k, 0.1) : null;
    return html`<section class="kinetics"><h3>Velocidade</h3>
      <p>${link.note}</p>
      <p class="small"><strong>Lei de velocidade:</strong> taxa = ${e.rateLaw}${raw(k ? ` · k = ${formatSci(k.k)} ${esc(e.kUnit)} a 25 °C` : '')}${raw(e.arrhenius ? ` · Ea = ${formatSci(e.arrhenius.Ea, 3)} kJ/mol` : '')}.
      ${raw(ex != null ? `Com 0,10 mol/L de cada, metade reage em ${esc(formatDuration(ex))}.` : '')}</p>
      ${raw(labBtn(e.id))}
      <p class="small muted">Fonte: ${raw(sourceText(data, [link.source]))}.</p></section>`;
  }
  if (link?.catalysis) {
    return html`<section class="kinetics"><h3>Velocidade: o papel do catalisador</h3>
      <div class="energy-row">${raw(barrierSVG(exo, true))}<p>${link.note}</p></div>
      ${raw(labBtn('sacarose', 'Ver outro catalisador no laboratório: ácido na hidrólise do açúcar'))}
      <p class="small muted">Fonte: ${raw(sourceText(data, [link.source]))}.</p></section>`;
  }
  const igniter = ['faisca', 'calor', 'luz'].find((c) => conds.has(c));
  if (igniter && exo) {
    const who = { faisca: 'uma faísca', calor: 'o aquecimento', luz: 'a luz' }[igniter];
    return html`<section class="kinetics"><h3>Velocidade: por que precisa de ${who}?</h3>
      <div class="energy-row">${raw(barrierSVG(true, false))}<p>Mesmo liberando energia no fim, os reagentes precisam primeiro subir uma barreira: a energia de ativação (Ea). À temperatura ambiente, quase nenhuma colisão tem energia para isso, e a reação fica parada. ${who[0].toUpperCase() + who.slice(1)} dá essa energia a algumas moléculas; o calor que a reação libera aquece as vizinhas, e ela se espalha sozinha.</p></div>
      ${raw(labBtn('n2o5', 'Ver no laboratório como a temperatura acelera uma reação'))}
      <p class="small muted">Fonte: ${raw(sourceText(data, [{ ref: 'atkins-jones', topic: 'Seções 14.11–14.13: temperatura, teoria das colisões e complexo ativado', pages: '587–595' }]))}.</p></section>`;
  }
  return `<section class="kinetics"><h3>Velocidade</h3><p class="small muted">Sem dado de velocidade conferido para esta reação: o jogo não estima quanto tempo ela leva. ${labBtn(null)}</p></section>`;
}

const itemLabel = (data, id) => {
  const it = data.itemsById.get(id);
  return `${it.icon} ${it.name}`;
};

export function renderResult(root, data, result, { newSubstances = [] } = {}) {
  stopStage();
  stopStage = () => {};
  root.classList.remove('kind-reaction', 'kind-needs-condition', 'kind-no-reaction', 'kind-unknown', 'kind-invalid');
  root.classList.add(`kind-${result.kind}`);

  if (result.kind === 'reaction') {
    const r = result.reaction;
    const reactants = resolveSide(r.reactants, data.substancesById);
    const products = resolveSide(r.products, data.substancesById);
    const conds = (r.conditions ?? []).map((anyOf) => anyOf.map((id) => itemLabel(data, id)).join(' ou ')).join(' + ');
    root.innerHTML = html`
      <p class="result-kicker">Reação!</p>
      <h2>${r.name}</h2>
      <div class="badges">${raw(r.types.map((t) => `<span class="badge type-${t}">${TYPE_LABEL[t]}</span>`).join(''))}${raw(r.generated ? '<span class="badge badge-rule" title="Montada pelo motor de regras da Fase 2 e balanceada automaticamente">⚙️ Prevista por regra</span>' : '')}</div>
      <div class="equation" aria-label="Equação balanceada">${raw(formatEquationHTML(reactants, products, { reversible: r.reversible }))}</div>
      ${raw(conds ? `<p class="small muted">Condição: ${esc(conds)}</p>` : '')}
      <div class="stage" data-stage></div>
      ${raw(newSubstances.length ? `<p class="discovered">✨ Nova descoberta: ${newSubstances.map((s) => `<strong>${esc(s.name)}</strong> (${formatFormulaHTML(s.formula)})`).join(', ')}</p>` : '')}
      <p>${r.explanation}</p>
      <h3>Por quê?</h3>
      <p>${r.why}</p>
      ${raw(energyHTML(data, r))}
      ${raw(kineticsHTML(data, r))}
      ${raw(r.conditionNote ? `<p class="small"><strong>Nota:</strong> ${esc(r.conditionNote)}</p>` : '')}
      ${raw(
        r.netIonic
          ? html`<h3>O que reage de verdade (equação iônica)</h3>
            <div class="equation small-eq">${raw(formatEquationHTML(r.netIonic.reactants, r.netIonic.products))}</div>
            ${raw(r.netIonic.note ? `<p class="small">${esc(r.netIonic.note)}</p>` : '')}`
          : '',
      )}
      <aside class="safety safety-${r.safety.level}">
        <strong>${SAFETY_LABEL[r.safety.level]}</strong>
        ${raw(r.safety.why ? `<p>${esc(r.safety.why)}</p>` : '')}
        ${raw(r.safety.home ? `<p><strong>Em casa?</strong> ${esc(r.safety.home)}</p>` : '')}
      </aside>
      ${raw(conservationHTML(data, reactants, products))}
      ${raw(calculatorHTML(data, reactants, products))}
      ${raw(r.generated ? '<p class="small muted rule-note">⚙️ Esta reação não está na lista conferida uma a uma: o motor de regras escolheu os produtos por uma regra geral (fonte abaixo) e calculou os coeficientes pelo balanceamento automático. Os testes do jogo conferem átomos, cargas e estados de todas as reações que as regras podem gerar.</p>' : '')}
      ${raw(sourceHTML(data, r.source))}`;
    mountStage(root, (el) => mountReactionStage(el, data, r));
    mountCalculator(root, data, r);
    return;
  }

  if (result.kind === 'needs-condition') {
    const missing = result.missing.map((anyOf) => anyOf.map((id) => itemLabel(data, id)).join(' ou '));
    const desc = [...new Set(result.missing.flat())].map((id) => data.itemsById.get(id));
    root.innerHTML = html`
      <p class="result-kicker">Quase!</p>
      <h2>Essas substâncias reagem, mas falta algo</h2>
      <p>Adicione à bancada: <strong>${missing.join(' + ')}</strong>.</p>
      <div class="stage" data-stage></div>
      <h3>Por quê?</h3>
      <p>Muitas reações não começam sozinhas, mesmo liberando energia depois. É preciso vencer uma "barreira" inicial, a <strong>energia de ativação</strong> — ou baixá-la com um catalisador.</p>
      <ul class="small">${raw(desc.map((it) => `<li><strong>${esc(it.icon)} ${esc(it.name)}:</strong> ${esc(it.description)}</li>`).join(''))}</ul>`;
    mountStage(root, (el) => mountBounceStage(el, data, result.substanceIds, 'needs-condition'));
    return;
  }

  const kicker = { 'no-reaction': 'Não reage', unknown: 'Desconhecido', invalid: 'Bancada' }[result.kind];
  root.innerHTML = html`
    <p class="result-kicker">${kicker}</p>
    <h2>${result.title}</h2>
    ${raw(result.kind === 'no-reaction' ? '<div class="stage" data-stage></div>' : '')}
    <p>${result.reason}</p>
    ${raw(result.kind === 'unknown' ? '<p class="small muted">O jogo só afirma que algo reage (ou não) quando tem uma reação conferida com fonte ou uma regra química sólida.</p>' : '')}
    ${raw(sourceHTML(data, result.source))}`;
  if (result.kind === 'no-reaction') mountStage(root, (el) => mountBounceStage(el, data, result.substanceIds, 'no-reaction'));
}

export function renderWelcome(root) {
  root.className = 'panel result kind-invalid';
  root.innerHTML = `
    <p class="result-kicker">Como jogar</p>
    <h2>Combine substâncias e descubra reações reais</h2>
    <ol>
      <li>Clique em substâncias do <strong>inventário</strong> (ou num elemento desbloqueado da <strong>tabela periódica</strong>) para colocá-las na bancada.</li>
      <li>Algumas reações precisam de uma <strong>ferramenta</strong>: calor, faísca, luz, eletricidade ou catalisador.</li>
      <li>Aperte <strong>Reagir</strong>. Você verá a equação balanceada e o porquê — ou o motivo de não haver reação.</li>
    </ol>
    <p class="small muted">Os objetivos do nível estão no painel de objetivos. Ao completá-los, novos elementos são desbloqueados.</p>`;
}
