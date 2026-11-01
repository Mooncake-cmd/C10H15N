// Laboratório de equilíbrio (Fase 3C): pH (com indicadores), tampão, solubilidade pelo Kps e
// equilíbrio gasoso (K, Q e Le Chatelier), com os dados das tabelas de Atkins & Jones.

import { esc } from './dom.js';
import { formatFormulaHTML, molarMass } from '../core/formula.js';
import { formatSci, sourceText } from './kinetics-lab.js';
import {
  solutionPH, bufferPH, indicatorColor, findSpecies, molarSolubility, reactionQuotient, direction, deltaNGas, leChatelier,
} from '../core/equilibrium.js';
import { solubility } from '../core/ions.js';

const num = (el) => {
  const x = parseFloat(String(el?.value ?? '').replace(',', '.'));
  return Number.isFinite(x) ? x : null;
};
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2).replace('.', ',').replace('-', '−') : '—');
export const SHIFT_TEXT = { produtos: 'para os produtos →', reagentes: '← para os reagentes', 'nao-muda': 'não muda', equilibrio: 'já está em equilíbrio' };

/** Régua de pH 0–14 com o valor marcado. */
function phBar(pH) {
  const x = Math.max(0, Math.min(14, pH));
  return `<div class="ph-bar" role="img" aria-label="pH ${f2(pH)} na escala de 0 a 14"><span class="ph-mark" style="left:${(x / 14) * 100}%"></span></div>
    <div class="ph-scale small muted"><span>0 ácido</span><span>7 neutro</span><span>14 básico</span></div>`;
}

export function mountEquilibriumLab(dialog, data) {
  const E = data.equilibrium;
  const $ = (s) => dialog.querySelector(s);

  // ---- pH ----
  const groups = [
    ['Ácidos fortes', E.strong.acids],
    ['Bases fortes', E.strong.bases],
    ['Ácidos fracos (Tabela 11.1)', E.acids],
    ['Bases fracas (Tabela 11.2)', E.bases],
  ];
  $('#eq-species').innerHTML = groups
    .map(([label, list]) => `<optgroup label="${esc(label)}">${list.map((s) => `<option value="${esc(s.formula)}">${esc(s.name)} (${esc(s.formula)})</option>`).join('')}</optgroup>`)
    .join('');
  $('#eq-species').value = 'CH3COOH';
  function updatePH() {
    const sp = findSpecies(E, $('#eq-species').value);
    const c = num($('#eq-c'));
    const out = $('#eq-ph-out');
    if (!(c > 0)) {
      out.innerHTML = '<p class="small muted">Informe uma concentração maior que zero.</p>';
      return;
    }
    const r = solutionPH(sp.kind, c, sp.params);
    const K = sp.params.Ka ? `Ka = ${formatSci(sp.params.Ka)}` : sp.params.Kb ? `Kb = ${formatSci(sp.params.Kb)}` : sp.kind === 'strongAcid' ? 'ácido forte: ioniza-se totalmente' : 'base forte: libera todo o OH⁻';
    const inds = E.indicators
      .map((ind) => {
        const col = indicatorColor(ind, r.pH);
        return `<li>${esc(ind.name)}: <strong>${esc(col.color)}</strong>${col.form === 'na viragem' ? ' (mudando de cor)' : ''}</li>`;
      })
      .join('');
    out.innerHTML = `<p><strong>pH = ${f2(r.pH)}</strong> · pOH = ${f2(r.pOH)} · [H₃O⁺] = ${formatSci(r.H)} mol/L <span class="small muted">(${esc(K)})</span></p>
      ${phBar(r.pH)}
      ${r.percent != null ? `<p class="small">Só <strong>${formatSci(r.percent, 2)}%</strong> das moléculas ${sp.kind === 'weakAcid' ? 'perderam o próton' : 'receberam um próton'} — é um${sp.kind === 'weakAcid' ? ' ácido fraco' : 'a base fraca'}: a maior parte fica como está, em equilíbrio.</p>` : ''}
      ${sp.params.Ka2 ? `<p class="small">O H₂SO₄ perde o 1º próton por completo; o 2º só em parte (Ka₂ = ${formatSci(sp.params.Ka2)}), e isso entra na conta.</p>` : ''}
      <details><summary class="small">Cor de cada indicador neste pH (Tabela 12.3)</summary><ul class="small eq-inds">${inds}</ul></details>
      <p class="small muted">Fonte: ${sourceText(data, [E.Kw.source, ...(sp.kind.startsWith('weak') ? (sp.kind === 'weakAcid' ? E.acidSource : E.baseSource) : [E.strong.source])])}.</p>`;
  }

  // ---- Tampão ----
  $('#eq-buf-acid').innerHTML = E.acids.map((a) => `<option value="${esc(a.formula)}">${esc(a.name)}</option>`).join('');
  $('#eq-buf-acid').value = 'CH3COOH';
  function updateBuffer() {
    const a = E.acids.find((x) => x.formula === $('#eq-buf-acid').value);
    const ca = num($('#eq-buf-ca'));
    const cb = num($('#eq-buf-cb'));
    const out = $('#eq-buf-out');
    if (!(ca > 0 && cb > 0)) {
      out.innerHTML = '<p class="small muted">Informe as duas concentrações (maiores que zero).</p>';
      return;
    }
    const pH = bufferPH(a.Ka, ca, cb);
    const alone = solutionPH('weakAcid', ca, { Ka: a.Ka }).pH;
    out.innerHTML = `<p><strong>pH = ${f2(pH)}</strong> (pKa = ${f2(-Math.log10(a.Ka))}; log(${formatSci(cb)}/${formatSci(ca)}) = ${f2(Math.log10(cb / ca))})</p>
      <p class="small">Só com o ácido, o pH seria ${f2(alone)}. Com a base conjugada junto, a solução resiste: um pouco de ácido acrescentado é consumido pela base, e um pouco de base, pelo ácido. Funciona melhor quando as duas concentrações são parecidas (pH perto do pKa).</p>
      <p class="small muted">Fonte: ${sourceText(data, [{ ref: 'atkins-jones', topic: 'Seção 12.2: pH de um tampão (Exemplo 12.1)', pages: '477–481' }, E.acidSource[0]])}.</p>`;
  }

  // ---- Solubilidade ----
  $('#eq-salt').innerHTML = E.ksp.map((k) => `<option value="${esc(k.formula)}">${esc(k.name)} (${esc(k.formula)})</option>`).join('');
  $('#eq-salt').value = 'AgCl';
  function updateSol() {
    const k = E.kspByFormula.get($('#eq-salt').value);
    const cc = num($('#eq-common-c')) ?? 0;
    const which = $('#eq-common-ion').value;
    const s = molarSolubility(k, which === 'cation' ? { cation: cc } : { anion: cc });
    const s0 = molarSolubility(k);
    const M = molarMass(k.formula, data.atomicMasses);
    const ion = (x) => formatFormulaHTML(x.formula);
    const cls = solubility(k.cation.formula, k.anion.formula, data.ions)?.result;
    const CLS = { insoluble: 'insolúvel', slightly: 'pouco solúvel', soluble: 'solúvel' };
    $('#eq-common-label').innerHTML = which === 'cation' ? `de ${ion(k.cation)} (mol/L)` : `de ${ion(k.anion)} (mol/L)`;
    $('#eq-sol-out').innerHTML = `<p>${formatFormulaHTML(k.formula)} ⇌ ${k.cation.count > 1 ? k.cation.count + ' ' : ''}${ion(k.cation)} + ${k.anion.count > 1 ? k.anion.count + ' ' : ''}${ion(k.anion)} · Kps = ${formatSci(k.Ksp)}</p>
      <p><strong>Solubilidade molar: ${formatSci(s)} mol/L</strong> = ${formatSci(s * M * 1000)} mg por litro${cc > 0 ? ` (em água pura seria ${formatSci(s0)} mol/L: o íon comum diminui a solubilidade ${formatSci(s0 / s, 3)} vezes)` : ''}.</p>
      ${cls ? `<p class="small">Pela regra simplificada de solubilidade (Tabela I.1), ele é <strong>${CLS[cls]}</strong>.${cls === 'insoluble' && s0 > 1e-3 ? ' O Kps mostra que “insolúvel” é uma simplificação: um pouco dele se dissolve.' : ''}</p>` : ''}
      <p class="small muted">Fonte: ${sourceText(data, [E.kspSource, { ref: 'atkins-jones', topic: 'Seções 12.8–12.9: solubilidade molar e íon comum', pages: '498–501' }])}.</p>`;
  }

  // ---- Equilíbrio gasoso ----
  $('#eq-gas').innerHTML = E.gas.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('');
  $('#eq-gas').value = 'nh3';
  function setGas() {
    const g = E.gasById.get($('#eq-gas').value);
    $('#eq-gas-T').innerHTML = g.points.map(([T]) => `<option value="${T}">${T} K (${Math.round(T - 273.15)} °C)</option>`).join('');
    const species = [...g.reactants, ...g.products];
    $('#eq-gas-p').innerHTML = species
      .map((e) => `<label>P(${formatFormulaHTML(e.formula)}) <input data-p="${esc(e.formula)}" type="number" min="0" step="any" inputmode="decimal" value="1"> bar</label>`)
      .join('');
    updateGas();
  }
  function updateGas() {
    const g = E.gasById.get($('#eq-gas').value);
    const T = Number($('#eq-gas-T').value);
    const [, K, Kc] = g.points.find(([t]) => t === T);
    const p = {};
    dialog.querySelectorAll('[data-p]').forEach((i) => (p[i.dataset.p] = num(i)));
    const ok = Object.values(p).every((x) => x > 0);
    const Q = ok ? reactionQuotient(g, p) : null;
    const dn = deltaNGas(g);
    // Sinal de ΔH pela variação de K com T na própria tabela (van 't Hoff): K cai → exotérmica.
    const [a, b] = [g.points[0], g.points[g.points.length - 1]];
    const dH = a[0] === b[0] ? null : ((8.3145 * Math.log(b[1] / a[1])) / (1 / a[0] - 1 / b[0])) / 1000;
    const lc = leChatelier({ dn, dH });
    const STRESS = { compress: 'Comprimir (mais pressão)', expand: 'Expandir (menos pressão)', heat: 'Aquecer', cool: 'Resfriar', addReactant: 'Acrescentar reagente', removeProduct: 'Retirar produto' };
    $('#eq-gas-out').innerHTML = `<p>K = <strong>${formatSci(K)}</strong> a ${T} K (Kc = ${formatSci(Kc)}; K = Kc·(RT)^Δn com Δn = ${dn})</p>
      ${Q != null ? `<p>Com essas pressões, Q = ${formatSci(Q)}: ${Q < K ? 'Q < K, a reação <strong>forma produtos</strong> até Q chegar a K' : Q > K ? 'Q > K, a reação <strong>volta, formando reagentes</strong>' : 'Q = K, <strong>já está em equilíbrio</strong>'} (${SHIFT_TEXT[direction(Q, K)]}).</p>` : '<p class="small muted">Informe pressões maiores que zero.</p>'}
      <p class="small"><strong>Le Chatelier</strong>${dH != null ? ` (pela tabela, K ${dH < 0 ? 'cai' : 'sobe'} com a temperatura: a reação é ${dH < 0 ? 'exotérmica' : 'endotérmica'}, ΔH° ≈ ${formatSci(dH, 2)} kJ)` : ''}:</p>
      <ul class="small">${Object.entries(lc).filter(([, v]) => v).map(([k, v]) => `<li>${STRESS[k]}: ${SHIFT_TEXT[v]}</li>`).join('')}</ul>
      ${g.divergence ? `<p class="small"><strong>Nota:</strong> ${esc(g.divergence)}</p>` : ''}
      <p class="small muted">Fonte: ${sourceText(data, [{ ref: 'atkins-jones', topic: 'Tabela 10.2: constantes de equilíbrio', pages: '389' }, { ref: 'atkins-jones', topic: 'Seções 10.5 e 10.9–10.11: Q × K e Le Chatelier', pages: '396–412' }])}.</p>`;
  }

  dialog.querySelector('[data-eq="ph"]').addEventListener('input', updatePH);
  $('#eq-species').addEventListener('change', updatePH);
  dialog.querySelector('[data-eq="buf"]').addEventListener('input', updateBuffer);
  $('#eq-buf-acid').addEventListener('change', updateBuffer);
  dialog.querySelector('[data-eq="sol"]').addEventListener('input', updateSol);
  for (const s of ['#eq-salt', '#eq-common-ion']) $(s).addEventListener('change', updateSol);
  $('#eq-gas').addEventListener('change', setGas);
  $('#eq-gas-T').addEventListener('change', updateGas);
  $('#eq-gas-p').addEventListener('input', updateGas);
  dialog.querySelector('.eq-close').addEventListener('click', () => dialog.close?.() ?? dialog.removeAttribute('open'));
  updatePH();
  updateBuffer();
  updateSol();
  setGas();

  return {
    /** Abre numa seção: { section: 'ph'|'buf'|'sol'|'gas', species?, salt?, gas? } */
    open(opts = {}) {
      if (opts.species && findSpecies(E, opts.species)) {
        $('#eq-species').value = opts.species;
        updatePH();
      }
      if (opts.salt && E.kspByFormula.has(opts.salt)) {
        $('#eq-salt').value = opts.salt;
        updateSol();
      }
      if (opts.gas && E.gasById.has(opts.gas)) {
        $('#eq-gas').value = opts.gas;
        setGas();
      }
      dialog.querySelectorAll('.eq-body > details').forEach((d) => (d.open = !opts.section || d.dataset.eq === opts.section));
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    },
  };
}

