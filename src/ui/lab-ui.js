// Painel 🧰 Laboratório: utensílios (com desenho e uso), separação de misturas (testar livremente
// cada método em cada mistura, com a explicação) e teste de chama. Exploração livre: aqui nada
// gasta tentativa — as tentativas só contam dentro das missões.

import { esc } from './dom.js';
import { formatFormulaHTML } from '../core/formula.js';
import { sourceText } from './kinetics-lab.js';
import { glasswareSVG } from './glassware-svg.js';
import { separate, flameTest, sourcesOf } from '../core/lab.js';
import { chemText } from './chem-text.js';

const GROUP = { conter: 'Para conter e misturar', medir: 'Para medir volumes', separar: 'Para separar', aquecer: 'Para aquecer', apoio: 'Apoio' };
const PRECISION = { exata: 'mede um volume fixo, com exatidão', graduada: 'mede volumes variados', aproximada: 'marcas só aproximadas: não serve para medir' };

export function glasswareCatalogHTML(data) {
  const L = data.lab;
  return Object.entries(GROUP)
    .map(([g, title]) => {
      const items = L.glassware
        .filter((x) => x.group === g)
        .map(
          (x) => `<article class="gw-card"><div class="gw-pic">${glasswareSVG(x.id, { label: x.name })}</div>
            <div><h4>${esc(x.name)}</h4><p class="small">${chemText(x.use)}</p>
            ${x.precision ? `<p class="small muted">Medida: ${esc(PRECISION[x.precision])}.</p>` : ''}
            ${x.tip ? `<p class="small gw-tip">⚠️ ${chemText(x.tip)}</p>` : ''}</div></article>`,
        )
        .join('');
      return `<h3>${esc(title)}</h3><div class="gw-grid">${items}</div>`;
    })
    .join('');
}

/** Resultado de uma separação (usado aqui e nas missões). */
export function separationResultHTML(res, method) {
  return `<p><strong>${method.icon} ${esc(method.name)}: ${res.ok ? 'funciona' : 'não serve aqui'}.</strong> ${chemText(res.text)}</p>${res.ok && res.obtains ? `<p class="small">Resultado: ${chemText(res.obtains)}.</p>` : ''}`;
}

/** Resultado de um teste de chama (usado aqui e nas missões). */
export function flameResultHTML(sub, res) {
  const swatch = res?.css ? `<span class="flame-swatch" style="--flame:${res.css}" aria-hidden="true"></span>` : '<span class="flame-swatch is-blue" aria-hidden="true"></span>';
  return `<p>${swatch}<strong>${formatFormulaHTML(sub.formula)} na chama:</strong> ${res ? chemText(res.text) : 'o jogo ainda não tem fonte para a cor deste elemento.'}</p>`;
}

export function mountLab(dialog, data) {
  const L = data.lab;
  const body = dialog.querySelector('.lab-body');
  const tabs = [...dialog.querySelectorAll('[data-lab-tab]')];
  const flameSubs = data.substances.filter((s) => flameTest(s.id, data)).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  let tab = 'gw';
  let mixture = L.mixtures[0].id;
  let result = '';

  function render() {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.labTab === tab)));
    if (tab === 'gw') {
      body.innerHTML = `${glasswareCatalogHTML(data)}<p class="small muted">Fonte: Reis (org.), Química Geral: práticas fundamentais (UFV), Prática nº 1, p. 25–42 do PDF; Lenzi et al., Química Geral Experimental, UD 01–02.</p>`;
    } else if (tab === 'sep') {
      const mix = L.mixturesById.get(mixture);
      const methods = L.methods.map((m) => `<button type="button" class="btn btn-ghost" data-free-method="${esc(m.id)}" title="${esc(m.principle)}">${m.icon} ${esc(m.name)}</button>`).join('');
      body.innerHTML = `<div class="kin-controls"><label>Mistura <select id="lab-mixture">${L.mixtures.map((m) => `<option value="${esc(m.id)}" ${m.id === mixture ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label></div>
        <p class="small"><strong>${esc(mix.name)}</strong>: ${chemText(mix.components)}. <span class="muted">${chemText(mix.phases)}.</span></p>
        <p class="small">Escolha um método (aqui é livre: nenhuma tentativa é gasta):</p>
        <div class="lab-methods">${methods}</div>
        <div class="lab-out" aria-live="polite">${result}</div>
        <details class="small"><summary>Como funciona cada método</summary><ul>${L.methods.map((m) => `<li><strong>${m.icon} ${esc(m.name)}</strong>: ${chemText(m.principle)}</li>`).join('')}</ul></details>
        <p class="small muted">Fontes: ${sourceText(data, [...sourcesOf(mix), ...L.methods.slice(0, 3).map((m) => m.source)])}.</p>`;
      body.querySelector('#lab-mixture').addEventListener('change', (ev) => {
        mixture = ev.target.value;
        result = '';
        render();
      });
    } else {
      body.innerHTML = `<p class="small">Um fio limpo (lavado em ácido clorídrico) é mergulhado na amostra e levado à chama azul do bico de Bunsen. Escolha uma substância:</p>
        <div class="lab-methods">${flameSubs.map((s) => `<button type="button" class="btn btn-ghost" data-free-flame="${esc(s.id)}">🔥 ${formatFormulaHTML(s.formula)}</button>`).join('')}</div>
        <div class="lab-out" aria-live="polite">${result}</div>
        <p class="small muted">Por que tão poucos? O jogo só mostra cores conferidas num livro. Fontes: ${sourceText(data, L.flameSource)}.</p>`;
    }
  }

  dialog.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-lab-tab]');
    if (t) {
      tab = t.dataset.labTab;
      result = '';
      render();
      return;
    }
    const m = ev.target.closest('[data-free-method]');
    if (m) {
      const method = L.methodsById.get(m.dataset.freeMethod);
      const res = separate(mixture, method.id, L);
      result = `<div class="mission-feedback is-${res.ok ? 'good' : 'bad'}">${separationResultHTML(res, method)}${res.next ? `<p class="small">Sobrou outra mistura: <button type="button" class="btn btn-ghost btn-small" data-next-mixture="${esc(res.next)}">continuar com ${esc(L.mixturesById.get(res.next).name.toLowerCase())}</button></p>` : ''}</div>`;
      render();
      return;
    }
    const n = ev.target.closest('[data-next-mixture]');
    if (n) {
      mixture = n.dataset.nextMixture;
      result = '';
      render();
      return;
    }
    const f = ev.target.closest('[data-free-flame]');
    if (f) {
      const sub = data.substancesById.get(f.dataset.freeFlame);
      result = `<div class="mission-feedback is-info">${flameResultHTML(sub, flameTest(sub.id, data))}</div>`;
      render();
    }
  });
  dialog.querySelector('.lab-close').addEventListener('click', () => dialog.close?.() ?? dialog.removeAttribute('open'));

  return {
    open(which) {
      if (which) tab = which;
      result = '';
      render();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    },
  };
}
