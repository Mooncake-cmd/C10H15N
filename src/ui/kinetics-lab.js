// Laboratório de velocidade (Fase 3B): escolha uma reação do livro, a temperatura e a
// concentração inicial; veja k, a meia-vida, a curva de concentração e o efeito de +10 °C.

import { html, raw, esc } from './dom.js';
import { formatFormulaHTML } from '../core/formula.js';
import { simulate, tempRange, kAt } from '../core/kinetics.js';

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** 0,0052 → "5,2 × 10⁻³"; 133 → "133"; vírgula decimal. */
export function formatSci(x, digits = 2) {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e < 5) {
    const d = Math.max(0, digits - 1 - e);
    return x.toFixed(Math.min(d, 4)).replace('.', ',');
  }
  const m = (x / 10 ** e).toFixed(digits - 1).replace('.', ',');
  return `${m} × 10${String(e).replace(/./g, (c) => SUP[c])}`;
}

/** Duração legível: 6,7 × 10⁻¹¹ s; 133 s; 1,5 h; 3,2 dias; 2,1 anos. */
export function formatDuration(s) {
  if (!Number.isFinite(s)) return '—';
  if (s < 1) return `${formatSci(s)} s`;
  if (s < 120) return `${formatSci(s, 3)} s`;
  if (s < 7200) return `${formatSci(s / 60, 3)} min`;
  if (s < 2 * 86400) return `${formatSci(s / 3600, 3)} h`;
  if (s < 2 * 365.25 * 86400) return `${formatSci(s / 86400, 3)} dias`;
  return `${formatSci(s / (365.25 * 86400), 3)} anos`;
}

const sideHTML = (side) =>
  side.map((e) => `${e.coef > 1 ? e.coef + ' ' : ''}${formatFormulaHTML(e.formula)}${e.name ? ` <span class="small muted">(${esc(e.name)})</span>` : ''}`).join(' + ');
export const kineticsEquationHTML = (e) => `${sideHTML(e.reactants)} → ${sideHTML(e.products)}`;

const SHORT = { 'atkins-jones': 'Atkins & Jones, Chemical Principles, 5. ed.' };
export const sourceText = (data, list) => list.map((s) => `${esc(SHORT[s.ref] ?? data.sources[s.ref] ?? s.ref)} — ${esc(s.topic)}, p. ${esc(s.pages)}`).join('; ');

/** Curva [A] × t em SVG, com a meia-vida marcada. */
function curveSVG(sim, A0) {
  const pts = sim.curve(60);
  const tMax = pts[pts.length - 1][0];
  const W = 300;
  const H = 150;
  const x = (t) => 36 + (t / tMax) * (W - 46);
  const y = (c) => 12 + (1 - c / A0) * (H - 40);
  const path = pts.map(([t, c], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(c).toFixed(1)}`).join(' ');
  const xh = x(sim.halfLife);
  return `<svg class="kin-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Concentração do reagente caindo com o tempo; metade em ${esc(formatDuration(sim.halfLife))}">
    <line class="axis" x1="36" y1="${y(0)}" x2="${W - 8}" y2="${y(0)}"/><line class="axis" x1="36" y1="${y(A0)}" x2="36" y2="${y(0)}"/>
    <text x="4" y="${y(A0) + 4}">[A]₀</text><text x="4" y="${y(A0 / 2) + 4}">½</text>
    <line class="half" x1="36" y1="${y(A0 / 2)}" x2="${xh}" y2="${y(A0 / 2)}"/><line class="half" x1="${xh}" y1="${y(A0 / 2)}" x2="${xh}" y2="${y(0)}"/>
    <text x="${xh}" y="${H - 14}" text-anchor="middle">t½</text>
    <text x="${W - 8}" y="${H - 2}" text-anchor="end">tempo → ${esc(formatDuration(tMax))}</text>
    <path class="curve" d="${path}"/></svg>`;
}

export function mountKineticsLab(dialog, data) {
  const K = data.kinetics;
  const body = dialog.querySelector('.kin-body');
  const select = dialog.querySelector('#kin-reaction');
  select.innerHTML = ['g', 'aq']
    .map((ph) => `<optgroup label="${ph === 'g' ? 'Fase gasosa' : 'Em solução aquosa'}">${K.reactions.filter((e) => e.phase === ph).map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</optgroup>`)
    .join('');
  const tIn = dialog.querySelector('#kin-temp');
  const tOut = dialog.querySelector('#kin-temp-out');
  const cIn = dialog.querySelector('#kin-conc');
  const fixedRow = dialog.querySelector('.kin-fixed');
  const fixedIn = dialog.querySelector('#kin-fixed');

  function setReaction(id) {
    const e = K.byId.get(id);
    select.value = id;
    const [lo, hi] = tempRange(e);
    tIn.min = String(lo);
    tIn.max = String(hi);
    tIn.disabled = lo === hi;
    // Começa numa temperatura com dado medido, se houver (a mais alta).
    tIn.value = String(e.points?.length ? e.points[e.points.length - 1][0] : Math.round((lo + hi) / 2));
    fixedRow.hidden = !e.pseudoFirstOrder;
    if (e.pseudoFirstOrder) {
      fixedRow.querySelector('.kin-fixed-label').textContent = `Concentração do ${e.pseudoFirstOrder.label}:`;
      fixedIn.value = String(e.pseudoFirstOrder.default);
    }
    update();
  }

  function update() {
    const e = K.byId.get(select.value);
    const T = Number(tIn.value);
    const A0 = parseFloat(String(cIn.value).replace(',', '.'));
    const fixed = parseFloat(String(fixedIn.value).replace(',', '.'));
    tOut.textContent = `${T} K (${formatSci(T - 273.15, 3)} °C)`;
    if (!(A0 > 0) || (e.pseudoFirstOrder && !(fixed > 0))) {
      body.innerHTML = '<p class="small muted">Informe concentrações maiores que zero.</p>';
      return;
    }
    const sim = simulate(e, { T, A0, fixed });
    if (!sim) {
      body.innerHTML = '<p class="small muted">Sem dado conferido nesta temperatura.</p>';
      return;
    }
    const HOW = {
      tabela: 'valor medido (Tabela 14.1)',
      arrhenius: 'calculado com A e Ea da Tabela 14.4',
      reta: 'calculado pela reta de Arrhenius dos valores medidos da Tabela 14.1',
    };
    const spec = e.pseudoFirstOrder ? formatFormulaHTML(e.reactants[0].formula) : formatFormulaHTML(e.species === 'ciclopropano' ? 'C3H6' : e.species);
    const orderTxt = sim.order === 1 ? '1ª ordem' : e.mixed ? '2ª ordem (1ª em cada reagente; o jogo supõe quantidades iguais dos dois)' : '2ª ordem';
    const plus10 = sim.plus10 ? `<p>🌡️ <strong>+10 °C</strong> multiplica k por <strong>${formatSci(sim.plus10, 3)}</strong>${sim.Ea.how === 'reta' ? ` (Ea ≈ ${formatSci(sim.Ea.Ea, 3)} kJ/mol, pela reta)` : ` (Ea = ${formatSci(sim.Ea.Ea, 3)} kJ/mol)`}.</p>` : '<p class="small muted">Sem energia de ativação no livro para esta reação.</p>';
    const pseudo = e.pseudoFirstOrder
      ? `<p class="small">O ${esc(e.pseudoFirstOrder.label)} não é consumido (é catalisador) e sua concentração fica fixa: k' = k·[H₃O⁺] = ${formatSci(sim.kEff)} s⁻¹, e a reação se comporta como de 1ª ordem na sacarose.</p>`
      : '';
    body.innerHTML = html`
      <div class="equation small-eq">${raw(kineticsEquationHTML(e))}</div>
      <p>${e.about}</p>
      <p><strong>Lei de velocidade:</strong> taxa = ${e.rateLaw} · ${orderTxt}</p>
      <p><strong>k</strong> = ${formatSci(sim.k)} ${e.kUnit} <span class="small muted">— ${HOW[sim.how]}</span></p>
      ${raw(pseudo)}
      <div class="kin-row">${raw(curveSVG(sim, A0))}
        <div><p><strong>Meia-vida:</strong> ${formatDuration(sim.halfLife)}${sim.order === 1 ? ' (não depende da concentração inicial)' : ' (depende da concentração inicial: tente mudar)'}</p>
        <p><strong>Taxa inicial:</strong> ${formatSci(sim.rate0)} mol·L⁻¹·s⁻¹ de ${raw(spec)} consumido</p>
        ${raw(plus10)}</div></div>
      <p class="small muted">Fonte: ${raw(sourceText(data, e.source))}.</p>`;
  }

  select.addEventListener('change', () => setReaction(select.value));
  for (const el of [tIn, cIn, fixedIn]) el.addEventListener('input', update);
  dialog.querySelector('.kin-close').addEventListener('click', () => dialog.close?.() ?? dialog.removeAttribute('open'));
  setReaction(K.reactions[0].id);

  return {
    open(id) {
      if (id && K.byId.has(id)) setReaction(id);
      else update();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    },
  };
}

/** Texto curto do k a 25 °C de uma reação ligada ao jogo (para o painel de resultado). */
export function kAt25Text(e) {
  const kk = kAt(e, 298);
  return kk ? `${formatSci(kk.k)} ${e.kUnit}` : null;
}
