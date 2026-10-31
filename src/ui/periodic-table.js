// Tabela periódica navegável. Mostra os 118 elementos; os jogáveis da fase atual ficam
// destacados, os bloqueados mostram em que nível abrem.

import { html, raw, esc, FAMILY_LABEL, PHASE_LABEL } from './dom.js';

export function renderPeriodicTable(root, data, { getStatus, onPick }) {
  let highlightFamily = null;
  let selected = null;

  const grid = root.querySelector('.pt-grid');
  const legend = root.querySelector('.pt-legend');
  const info = root.querySelector('.pt-info');

  function draw() {
    grid.innerHTML = data.elements
      .map((e) => {
        const st = getStatus(e.symbol);
        const dim = highlightFamily && e.family !== highlightFamily ? ' is-dim' : '';
        const sel = selected === e.symbol ? ' is-selected' : '';
        return html`<button class="pt-cell fam-${e.family} st-${st.kind}${raw(dim)}${raw(sel)}" style="grid-column:${e.xpos};grid-row:${e.ypos + 1}"
          data-symbol="${e.symbol}" title="${e.name} (${e.Z})${st.kind === 'locked' ? ' — desbloqueia no nível ' + (st.level + 1) : st.kind === 'future' ? ' — fases futuras' : ''}">
          <span class="pt-z">${e.Z}</span><span class="pt-sym">${e.symbol}</span>${raw(st.kind === 'locked' ? '<span class="pt-lock" aria-hidden="true">🔒</span>' : '')}
        </button>`;
      })
      .join('');
    // Rótulos de grupo e período.
    for (let g = 1; g <= 18; g++) grid.insertAdjacentHTML('beforeend', `<span class="pt-label pt-glabel" style="grid-column:${g};grid-row:1" aria-hidden="true">${g}</span>`);
  }

  function drawLegend() {
    const fams = [...new Set(data.elements.map((e) => e.family))];
    legend.innerHTML =
      fams
        .map((f) => html`<button class="legend-item fam-${f}${raw(highlightFamily === f ? ' is-active' : '')}" data-family="${f}"><span class="swatch"></span>${FAMILY_LABEL[f] ?? f}</button>`)
        .join('') + '<span class="legend-hint">Clique numa família para destacá-la</span>';
  }

  function showInfo(symbol) {
    const e = data.elementsBySymbol.get(symbol);
    const st = getStatus(symbol);
    const elemental = data.elementalBySymbol.get(symbol);
    const row = (k, v) => (v === null || v === undefined || v === '' ? '' : html`<dt>${k}</dt><dd>${v}</dd>`);
    let action = '';
    if (st.kind === 'unlocked') action = html`<button class="btn btn-primary" data-add="${elemental.id}">Colocar ${elemental.formula} na bancada</button>`;
    else if (st.kind === 'locked') action = html`<p class="muted">🔒 Desbloqueia no nível ${st.level + 1}: <strong>${data.progression.levels[st.level].title}</strong>.</p>`;
    else action = '<p class="muted">Este elemento ainda não é jogável. Fases futuras vão ampliar a coleção.</p>';
    const valence = e.shells?.[e.shells.length - 1];
    info.innerHTML = html`
      <div class="pt-info-head fam-${e.family}">
        <span class="pt-info-sym">${e.symbol}</span>
        <div><strong>${e.name}</strong><br><span class="muted">${FAMILY_LABEL[e.family] ?? e.family}</span></div>
      </div>
      <dl class="pt-props">
        ${raw(row('Número atômico', e.Z))}
        ${raw(row('Massa atômica', `${String(e.atomicMass).replace('.', ',')} u`))}
        ${raw(row('Grupo', e.group ?? '— (bloco f)'))}
        ${raw(row('Período', e.period))}
        ${raw(row('Configuração', e.electronConfiguration))}
        ${raw(row('Elétrons de valência', (e.block === 's' || e.block === 'p') && valence ? valence : null))}
        ${raw(row('Eletronegatividade', e.electronegativity ? String(e.electronegativity).replace('.', ',') + ' (Pauling)' : null))}
        ${raw(row('Estado (0 °C, 1 atm)', PHASE_LABEL[e.phaseAtSTP]))}
        ${raw(row('Forma no jogo', elemental ? elemental.formula : null))}
      </dl>
      ${raw(elemental ? `<p class="small">${esc(elemental.description)}</p>` : '')}
      ${raw(action)}
      ${raw(factsHTML(symbol))}`;
  }

  // Curiosidades: leitura complementar (livro de divulgação), sempre com a página.
  function factsHTML(symbol) {
    const f = data.elementFacts?.[symbol];
    if (!f) return '';
    const ref = data.elementFactsMeta?.ref;
    const pages = f.pages.length > 1 ? `p. ${f.pages[0]}–${f.pages[f.pages.length - 1]}` : `p. ${f.pages[0]}`;
    return html`<section class="pt-facts" aria-label="Curiosidades">
        <h3>Curiosidades</h3>
        <p>${f.summary}</p>
        ${raw(f.facts.length ? `<ul>${f.facts.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '')}
        <p class="pt-facts-source">Leitura complementar: ${(data.sources[ref] ?? ref).replace(/\.$/, '')}, ${pages}. Texto escrito para o jogo, com palavras próprias.</p>
      </section>`;
  }

  grid.addEventListener('click', (ev) => {
    const cell = ev.target.closest('.pt-cell');
    if (!cell) return;
    selected = cell.dataset.symbol;
    showInfo(selected);
    draw();
    const st = getStatus(selected);
    if (st.kind === 'unlocked' && ev.detail > 1) onPick(data.elementalBySymbol.get(selected).id); // duplo clique adiciona direto
  });
  info.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-add]');
    if (btn) onPick(btn.dataset.add);
  });
  legend.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-family]');
    if (!b) return;
    highlightFamily = highlightFamily === b.dataset.family ? null : b.dataset.family;
    draw();
    drawLegend();
  });

  drawLegend();
  draw();
  return {
    refresh() {
      draw();
      if (selected) showInfo(selected);
    },
  };
}
