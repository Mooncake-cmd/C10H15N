// Glossário na interface:
//   - nos textos explicativos, a primeira ocorrência de cada termo vira um botão sublinhado;
//     tocando nele, um balão mostra a definição, um exemplo e termos relacionados;
//   - o botão "Glossário" do topo abre a lista completa, com busca.
// Os textos são "linkados" automaticamente quando mudam (MutationObserver): os módulos que
// desenham o painel de resultado, os objetivos etc. não precisam saber do glossário.

import { esc } from './dom.js';

// Onde NÃO criar links: controles, títulos, equações, desenhos, tabelas e o próprio link.
const SKIP = 'button, a, input, textarea, select, label, svg, h1, h2, h3, summary, table, code, .equation, .badge, .chip, .term, .result-kicker, .stage, .calc-out, .stoich-form, .discovered';

export function initGlossaryUI(data, containers) {
  const g = data.glossary;
  if (!g?.terms.length) return;

  // ---------- Links nos textos ----------
  function linkify(root) {
    const seen = new Set([...root.querySelectorAll('.term')].map((el) => el.dataset.term));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue;
      const matches = g.find(text).filter((m) => !seen.has(m.id) && seen.add(m.id));
      if (!matches.length) continue;
      const frag = document.createDocumentFragment();
      let i = 0;
      for (const m of matches) {
        if (m.start > i) frag.append(text.slice(i, m.start));
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'term';
        b.dataset.term = m.id;
        b.textContent = m.text;
        b.title = `${g.byId.get(m.id).term}: toque para ver o significado`;
        frag.append(b);
        i = m.end;
      }
      if (i < text.length) frag.append(text.slice(i));
      node.replaceWith(frag);
    }
  }

  for (const sel of containers) {
    const root = document.querySelector(sel);
    if (!root) continue;
    let pending = false;
    const run = () => {
      pending = false;
      observer.disconnect();
      linkify(root);
      observer.observe(root, { childList: true, subtree: true });
    };
    const observer = new MutationObserver(() => {
      if (!pending) {
        pending = true;
        requestAnimationFrame(run);
      }
    });
    run();
  }

  // ---------- Balão com a definição ----------
  const pop = document.createElement('div');
  pop.className = 'term-pop';
  pop.setAttribute('role', 'dialog');
  pop.hidden = true;
  document.body.append(pop);
  let opener = null;

  const sourceText = (t) => `${t.source.ref === 'atkins-jones' ? 'Atkins & Jones, Chemical Principles' : data.sources[t.source.ref] ?? t.source.ref}, ${t.source.pages.startsWith('B') ? 'glossário' : 'seção'}, p. ${t.source.pages}`;
  const relatedHTML = (t) =>
    (t.related ?? []).length
      ? `<p class="term-rel">Veja também: ${t.related.map((r) => `<button type="button" class="term-link" data-term="${r}">${esc(g.byId.get(r).term)}</button>`).join(' ')}</p>`
      : '';

  function openPop(id, anchor) {
    const t = g.byId.get(id);
    if (!t) return;
    pop.setAttribute('aria-label', t.term);
    pop.innerHTML = `
      <div class="term-pop-head"><strong tabindex="-1">${esc(t.term)}</strong><button type="button" class="term-close" aria-label="Fechar">×</button></div>
      <p>${esc(t.definition)}</p>
      <p class="small"><em>Exemplo:</em> ${esc(t.example)}</p>
      ${relatedHTML(t)}
      <p class="term-src small muted">${esc(sourceText(t))} · <button type="button" class="term-link" data-glossary-open="${t.id}">ver no glossário</button></p>`;
    pop.hidden = false;
    opener = anchor;
    const r = anchor.getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 32);
    pop.style.width = `${w}px`;
    const left = Math.min(Math.max(16, r.left + window.scrollX), window.scrollX + window.innerWidth - w - 16);
    pop.style.left = `${left}px`;
    pop.style.top = `${r.bottom + window.scrollY + 6}px`;
    // Se não couber embaixo, abre acima.
    const h = pop.offsetHeight;
    if (r.bottom + h + 12 > window.innerHeight && r.top > h + 12) pop.style.top = `${r.top + window.scrollY - h - 6}px`;
    pop.querySelector('strong').focus({ preventScroll: true });
  }
  function closePop() {
    if (pop.hidden) return;
    pop.hidden = true;
    opener?.focus({ preventScroll: true });
    opener = null;
  }

  // ---------- Diálogo com o glossário completo ----------
  const dlg = document.querySelector('#glossary-dialog');
  const list = dlg?.querySelector('.glossary-list');
  const search = dlg?.querySelector('#glossary-search');
  const sorted = [...g.terms].sort((a, b) => a.term.localeCompare(b.term, 'pt'));
  if (list) {
    list.innerHTML = sorted
      .map(
        (t) => `<article class="glossary-entry" id="g-${t.id}" data-name="${esc([t.term, ...(t.aliases ?? [])].join(' | ').toLowerCase())}" data-search="${esc(t.definition.toLowerCase())}">
          <h3>${esc(t.term)}</h3><p>${esc(t.definition)}</p><p class="small"><em>Exemplo:</em> ${esc(t.example)}</p>${relatedHTML(t)}
          <p class="term-src small muted">${esc(sourceText(t))}</p></article>`,
      )
      .join('');
  }
  function openDialog(id) {
    if (!dlg) return;
    closePop();
    if (!dlg.open) {
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    }
    if (id) {
      search.value = '';
      filter('');
      const el = dlg.querySelector(`#g-${id}`);
      el?.scrollIntoView({ block: 'start' });
      el?.classList.add('is-hit');
      setTimeout(() => el?.classList.remove('is-hit'), 1600);
    } else search.focus();
  }
  function filter(q) {
    const s = q.trim().toLowerCase();
    let n = 0;
    // Quem tem a palavra no nome aparece antes de quem só a cita na definição.
    list.querySelectorAll('.glossary-entry').forEach((el) => {
      const inName = !s || el.dataset.name.includes(s);
      const show = inName || el.dataset.search.includes(s);
      el.hidden = !show;
      el.style.order = inName ? '0' : '1';
      if (show) n++;
    });
    dlg.querySelector('.glossary-count').textContent = `${n} de ${sorted.length} termos`;
  }
  search?.addEventListener('input', () => filter(search.value));
  dlg?.querySelector('.glossary-close')?.addEventListener('click', () => dlg.close());
  if (list) filter('');

  // ---------- Eventos ----------
  document.addEventListener('click', (ev) => {
    const openG = ev.target.closest('[data-glossary-open]');
    if (openG) return openDialog(openG.dataset.glossaryOpen || null);
    const term = ev.target.closest('.term, .term-link');
    if (term) {
      if (dlg?.open && dlg.contains(term)) return openDialog(term.dataset.term);
      return openPop(term.dataset.term, term.classList.contains('term') ? term : opener ?? term);
    }
    if (ev.target.closest('.term-close') || (!pop.hidden && !pop.contains(ev.target))) closePop();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !pop.hidden) {
      ev.preventDefault();
      closePop();
    }
  });
  window.addEventListener('resize', closePop);
}
