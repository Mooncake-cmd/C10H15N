// Calculadoras (itens das apostilas Bernoulli, conferidos em Atkins & Jones): concentração em
// várias unidades, diluição, mistura de soluções e fórmula mínima a partir da composição.

import { esc } from './dom.js';
import { formatFormulaHTML, molarMass } from '../core/formula.js';
import { convertConcentration, CONCENTRATION_UNITS, dilution, mixSameSolute } from '../core/solutions.js';
import { empiricalFromPercent, molecularFromEmpirical } from '../core/composition.js';
import { formatSci } from './kinetics-lab.js';

const num = (el) => {
  const x = parseFloat(String(el?.value ?? '').replace(',', '.'));
  return Number.isFinite(x) ? x : null;
};
const f = (x, d = 3) => {
  if (!Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return formatSci(x, 3);
  return String(Number(x.toPrecision(d + 1))).replace('.', ',');
};

export function mountCalculators(dialog, data) {
  // Soluto: compostos do jogo que existem em solução aquosa ou são sólidos solúveis, em ordem de nome.
  const solutes = data.substances.filter((s) => !s.elementOf).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const sel = dialog.querySelector('#calc-solute');
  sel.innerHTML = solutes.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.formula)})</option>`).join('');
  sel.value = solutes.find((s) => s.id === 'NaCl')?.id ?? solutes[0].id;
  dialog.querySelector('#calc-unit').innerHTML = CONCENTRATION_UNITS.map((u) => `<option>${esc(u)}</option>`).join('');

  const concOut = dialog.querySelector('#calc-conc-out');
  function updateConc() {
    const s = data.substancesById.get(sel.value);
    const M = molarMass(s.formula, data.atomicMasses);
    const v = num(dialog.querySelector('#calc-conc'));
    const unit = dialog.querySelector('#calc-unit').value;
    const c = v == null ? null : convertConcentration(v, unit, M);
    concOut.innerHTML = c
      ? `<table class="calc-table"><tbody>${CONCENTRATION_UNITS.map((u) => `<tr><td>${esc(u)}</td><td><strong>${esc(f(c[u]))}</strong></td></tr>`).join('')}</tbody></table>
         <p class="small muted">${formatFormulaHTML(s.formula)}: M = ${esc(f(M, 4))} g/mol. mol/L = (g/L) ÷ M. Em solução aquosa diluída (densidade ≈ 1 kg/L), mg/L ≈ ppm.</p>`
      : '<p class="small muted">Informe um valor.</p>';
  }

  const dilOut = dialog.querySelector('#calc-dil-out');
  function updateDil() {
    const vals = Object.fromEntries(['c1', 'V1', 'c2', 'V2'].map((k) => [k, num(dialog.querySelector(`[data-dil="${k}"]`))]));
    const r = dilution(vals);
    if (!r) {
      dilOut.innerHTML = '<p class="small muted">Preencha três dos quatro campos (deixe vazio o que quer descobrir).</p>';
      return;
    }
    if (r.impossible) {
      dilOut.innerHTML = '<p class="small">Diluir só abaixa a concentração: c₂ não pode ser maior que c₁.</p>';
      return;
    }
    dilOut.innerHTML = `<p>c₁ = ${f(r.c1)} mol/L · V₁ = ${f(r.V1)} mL → c₂ = ${f(r.c2)} mol/L · V₂ = ${f(r.V2)} mL.</p>
      <p class="small">Pegue <strong>${f(r.V1)} mL</strong> da solução concentrada e complete com <strong>${f(r.water)} mL</strong> de água. A quantidade de soluto (c·V = ${f(r.c1 * r.V1 / 1000)} mol) não muda.</p>`;
  }

  const mixOut = dialog.querySelector('#calc-mix-out');
  function updateMix() {
    const parts = [1, 2].map((i) => ({ c: num(dialog.querySelector(`[data-mix="c${i}"]`)), V: num(dialog.querySelector(`[data-mix="V${i}"]`)) }));
    const r = parts.every((p) => p.c != null && p.V != null) ? mixSameSolute(parts) : null;
    mixOut.innerHTML = r
      ? `<p>Concentração final: <strong>${f(r.c)} mol/L</strong> em ${f(r.V)} mL (quantidades somadas ÷ volume total).</p>`
      : '<p class="small muted">Informe concentração e volume das duas soluções.</p>';
  }

  const formOut = dialog.querySelector('#calc-formula-out');
  function updateFormula() {
    const pcts = {};
    let bad = null;
    dialog.querySelectorAll('.calc-el-row').forEach((row) => {
      const el = row.querySelector('[data-el]').value.trim();
      const p = num(row.querySelector('[data-pct]'));
      if (!el && p == null) return;
      const sym = el.charAt(0).toUpperCase() + el.slice(1).toLowerCase();
      if (!data.atomicMasses[sym]) bad = el || '?';
      else if (p != null) pcts[sym] = (pcts[sym] ?? 0) + p;
    });
    if (bad) {
      formOut.innerHTML = `<p class="small">“${esc(bad)}” não é um símbolo de elemento.</p>`;
      return;
    }
    const total = Object.values(pcts).reduce((a, b) => a + b, 0);
    const r = Object.keys(pcts).length >= 2 ? empiricalFromPercent(pcts, data.atomicMasses) : null;
    if (!r) {
      formOut.innerHTML = '<p class="small muted">Informe pelo menos dois elementos com suas porcentagens em massa.</p>';
      return;
    }
    const M = num(dialog.querySelector('#calc-molar'));
    const mol = M ? molecularFromEmpirical(r.formula, M, data.atomicMasses) : null;
    formOut.innerHTML = `<p>Fórmula mínima: <strong>${formatFormulaHTML(r.formula)}</strong>${mol ? ` · fórmula molecular: <strong>${formatFormulaHTML(mol.formula)}</strong> (${mol.n} × a mínima)` : ''}</p>
      <p class="small">Em 100 g: mol de cada elemento = % ÷ massa atômica; dividindo pelo menor, as proporções ficam ${Object.entries(r.ratios).map(([el, x]) => `${esc(el)} ${f(x)}`).join(' : ')}${Object.values(r.counts).some((c, i) => Math.abs(c - Object.values(r.ratios)[i]) > 0.1) ? ', e multiplicando até ficarem inteiras' : ''}.${Math.abs(total - 100) > 1 ? ` As porcentagens somam ${f(total)}%: confira se falta algum elemento.` : ''}</p>`;
  }

  dialog.querySelector('[data-calc="conc"]').addEventListener('input', updateConc);
  dialog.querySelector('[data-calc="dil"]').addEventListener('input', updateDil);
  dialog.querySelector('[data-calc="mix"]').addEventListener('input', updateMix);
  dialog.querySelector('[data-calc="formula"]').addEventListener('input', updateFormula);
  sel.addEventListener('change', updateConc);
  dialog.querySelector('#calc-unit').addEventListener('change', updateConc);
  dialog.querySelector('.calc-close').addEventListener('click', () => dialog.close?.() ?? dialog.removeAttribute('open'));
  updateConc();
  updateDil();
  updateMix();
  updateFormula();
  return {
    open() {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    },
  };
}
