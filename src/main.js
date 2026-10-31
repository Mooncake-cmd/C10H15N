// Ponto de entrada da interface: carrega dados, estado salvo, e liga os componentes.
// Toda a química fica em src/core (testável sem navegador); aqui só há interface.

import { loadGameData } from './loader.js';
import { createEngine } from './core/engine.js';
import { initialState, applyResult, inventory, restoreState, unlockLevelMap, isObjectiveDone, answerObjective } from './core/progression.js';
import { lookupReaction } from './core/engine.js';
import { formatFormulaHTML } from './core/formula.js';
import { renderPeriodicTable } from './ui/periodic-table.js';
import { renderResult, renderWelcome } from './ui/result-panel.js';
import { $, html, raw, esc, mainCategory } from './ui/dom.js';
import { displayStructure } from './core/structure.js';
import { structureSVG } from './ui/structure-svg.js';
import { initGlossaryUI } from './ui/glossary-ui.js';
import { mountKineticsLab } from './ui/kinetics-lab.js';

const SAVE_KEY = 'elementar:v1';
const MAX_SUBSTANCES = 4;

const storage = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch {
      return null;
    }
  },
  save(state) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      /* armazenamento indisponível: o jogo segue sem salvar */
    }
  },
  clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* idem */
    }
  },
};

async function main() {
  let data;
  try {
    data = await loadGameData();
  } catch (err) {
    $('#app-error').hidden = false;
    $('#app-error').textContent = `Não foi possível carregar os dados do jogo (${err.message}). Se você abriu o arquivo direto (file://), sirva a pasta com um servidor local — veja o README.`;
    return;
  }

  const engine = createEngine(data);
  const unlockAt = unlockLevelMap(data);
  let state = restoreState(storage.load(), data) ?? initialState(data);
  let bench = []; // ids na bancada (substâncias e ferramentas)
  let lastNew = new Set(); // destacadas como "novas" no inventário

  // ---------- Tabela periódica ----------
  const table = renderPeriodicTable($('#periodic-table'), data, {
    getStatus(symbol) {
      if (state.unlockedElements.includes(symbol)) return { kind: 'unlocked' };
      if (data.elementalBySymbol.has(symbol)) return { kind: 'locked', level: unlockAt.get(`elements:${symbol}`) };
      return { kind: 'future' };
    },
    onPick: addToBench,
  });

  // ---------- Desenhos das substâncias (cacheados: não mudam durante o jogo) ----------
  const svgCache = new Map();
  function substanceSVG(s, size) {
    const key = `${s.id}|${size}`;
    if (!svgCache.has(key)) {
      const struct = displayStructure(s, data);
      svgCache.set(key, struct ? structureSVG(struct, { labels: size === 'big', className: `mol mol-${size}`, scale: size === 'big' ? 22 : 8 }) : '');
    }
    return svgCache.get(key);
  }

  // ---------- Inventário ----------
  function renderInventory() {
    const inv = inventory(state, data);
    const filter = $('#inv-search').value.trim().toLowerCase();
    const subs = inv.substances
      .map((id) => data.substancesById.get(id))
      .filter((s) => !filter || s.name.toLowerCase().includes(filter) || s.formula.toLowerCase().includes(filter) || (s.aka ?? []).some((a) => a.includes(filter)));
    const chip = (s) => html`<button class="chip cat-${mainCategory(s)}${raw(bench.includes(s.id) ? ' is-on-bench' : '')}${raw(lastNew.has(s.id) ? ' is-new' : '')}"
        data-id="${s.id}" draggable="true" title="${s.description}"><span class="chip-mol">${raw(substanceSVG(s, 'icon'))}</span><span class="chip-formula">${raw(formatFormulaHTML(s.formula))}</span><span class="chip-name">${s.name}</span></button>`;
    const elementais = subs.filter((s) => s.elementOf).sort((a, b) => data.elementsBySymbol.get(a.elementOf).Z - data.elementsBySymbol.get(b.elementOf).Z);
    const compostos = subs.filter((s) => !s.elementOf).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
    $('#inv-elements').innerHTML = elementais.map(chip).join('') || '<p class="muted small">—</p>';
    $('#inv-compounds').innerHTML = compostos.map(chip).join('') || '<p class="muted small">Nenhum composto ainda. Faça reações para descobrir!</p>';
    $('#inv-items').innerHTML = inv.items
      .map((id) => data.itemsById.get(id))
      .map((it) => html`<button class="chip chip-item${raw(bench.includes(it.id) ? ' is-on-bench' : '')}" data-id="${it.id}" draggable="true" title="${it.description}"><span class="chip-formula">${it.icon}</span><span class="chip-name">${it.name}</span></button>`)
      .join('');
    // A coleção conta os compostos curados; os gerados pelas regras (Fase 2) aparecem como extras.
    const collection = data.substances.filter((s) => !s.elementOf && !s.derived);
    const found = collection.filter((s) => inv.substances.includes(s.id)).length;
    const extras = inv.substances.filter((id) => data.substancesById.get(id).derived).length;
    $('#inv-count').textContent = `${found}/${collection.length} compostos${extras ? ` · +${extras} extras` : ''}`;
  }

  // ---------- Bancada ----------
  function addToBench(id) {
    if (bench.includes(id)) return;
    const isItem = data.itemsById.has(id);
    if (!isItem && bench.filter((x) => !data.itemsById.has(x)).length >= MAX_SUBSTANCES) {
      toast(`A bancada aceita até ${MAX_SUBSTANCES} substâncias.`);
      return;
    }
    bench = [...bench, id];
    renderBench();
    renderInventory();
  }
  function removeFromBench(id) {
    bench = bench.filter((x) => x !== id);
    renderBench();
    renderInventory();
  }
  function renderBench() {
    const slots = $('#bench-slots');
    if (!bench.length) {
      slots.innerHTML = '<p class="bench-empty">Clique ou arraste substâncias e ferramentas para cá</p>';
    } else {
      slots.innerHTML = bench
        .map((id, i) => {
          const plus = i > 0 ? '<span class="bench-plus" aria-hidden="true">+</span>' : '';
          const it = data.itemsById.get(id);
          if (it) return html`${raw(plus)}<button class="chip chip-item on-bench" data-remove="${id}" title="Remover">${it.icon} ${it.name}<span class="x" aria-hidden="true">×</span></button>`;
          const s = data.substancesById.get(id);
          return html`${raw(plus)}<button class="chip cat-${mainCategory(s)} on-bench" data-remove="${id}" title="Remover ${s.name}"><span class="chip-mol">${raw(substanceSVG(s, 'big'))}</span><span class="chip-text"><span class="chip-formula">${raw(formatFormulaHTML(s.formula))}</span><span class="chip-name">${s.name}</span></span><span class="x" aria-hidden="true">×</span></button>`;
        })
        .join('');
    }
    $('#btn-react').disabled = bench.length === 0;
    $('#btn-clear').disabled = bench.length === 0;
  }

  function react() {
    const result = engine.combine(bench);
    const prevLevel = state.levelIndex;
    const { state: next, events } = applyResult(state, result, data);
    state = next;
    storage.save(state);

    const discovered = events.filter((e) => e.type === 'discovered').map((e) => e.substance);
    lastNew = new Set(discovered.map((s) => s.id));
    renderResult($('#result'), data, result, { newSubstances: discovered });
    $('#result').scrollTop = 0;
    if (window.matchMedia('(max-width: 900px)').matches) $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });

    for (const e of events) {
      if (e.type === 'objective') toast(`🎯 Objetivo concluído: ${e.objective.text}`, 'good');
    }
    if (result.kind === 'reaction') bench = [];

    const completed = events.filter((e) => e.type === 'level-complete').map((e) => e.level);
    if (completed.length) showLevelDialog(completed, state.levelIndex !== prevLevel ? data.progression.levels[state.levelIndex] : null);
    renderAll();
  }

  // ---------- Objetivos ----------
  function renderObjectives() {
    const levels = data.progression.levels;
    const level = levels[state.levelIndex];
    const done = level.objectives.filter((o) => state.completedObjectives.includes(o.id)).length;
    $('#level-name').textContent = state.finished ? 'Todas as fases concluídas — modo livre' : `Fase ${level.phase ?? 1} · Nível ${state.levelIndex + 1}/${levels.length}: ${level.title}`;
    const overall = levels.flatMap((l) => l.objectives);
    const pct = Math.round((100 * state.completedObjectives.length) / overall.length);
    $('#progress-bar').style.width = `${pct}%`;
    $('#progress-bar').parentElement.setAttribute('aria-valuenow', String(pct));

    $('#objectives').innerHTML = html`
      <h2>${state.finished ? '🏆 Todas as fases concluídas!' : level.title}</h2>
      <p class="small">${state.finished ? 'Você completou todos os níveis. Continue explorando combinações: com as regras da Fase 2, há centenas de reações e "não-reações" para descobrir.' : level.intro}</p>
      ${raw(
        state.finished
          ? ''
          : html`<p class="small muted">${done}/${level.objectives.length} objetivos</p>
        <ul class="objective-list">
          ${raw(
            level.objectives
              .map((o) => {
                const ok = state.completedObjectives.includes(o.id) || isObjectiveDone(o, state, data);
                return html`<li class="${ok ? 'is-done' : ''}"><span class="check" aria-hidden="true">${ok ? '✔' : '○'}</span>
                  <div><span>${o.text}</span>${raw(!ok && o.type === 'stoich' ? stoichForm(o) : '')}${raw(!ok && o.type === 'kinetics' ? kineticsForm(o) : '')}${raw(!ok && o.hint ? `<details class="hint"><summary>Dica</summary>${esc(o.hint)}</details>` : '')}</div></li>`;
              })
              .join(''),
          )}
        </ul>`,
      )}
      ${raw(
        levels
          .slice(0, state.finished ? levels.length : state.levelIndex)
          .map((l) => `<details class="past-lesson"><summary>✔ ${esc(l.title)}</summary><p class="small">${esc(l.lesson)}</p></details>`)
          .join(''),
      )}`;
  }

  /** Pergunta de estequiometria: campo numérico (gramas) ou escolha do reagente limitante. */
  function stoichForm(o) {
    const r = lookupReaction(data, o.reaction);
    if (o.ask === 'limiting') {
      const opts = Object.keys(o.given)
        .map((id) => html`<button type="button" class="btn btn-ghost stoich-choice" data-answer="${id}">${raw(formatFormulaHTML(data.substancesById.get(id).formula))}</button>`)
        .join('');
      return html`<form class="stoich-form" data-objective="${o.id}"><span class="small muted">Equação: ${r.name}</span><div class="stoich-row">${raw(opts)}</div></form>`;
    }
    const UNIT = { g: ['gramas', 'g de'], mol: ['mol', 'mol de'], L: ['litros', 'L de'] };
    const [ph, label] = o.ask === 'yield' ? ['%', '%'] : o.ask === 'heat' ? ['kJ', 'kJ de calor liberado'] : UNIT[o.unit ?? 'g'];
    const what = o.ask === 'yield' || o.ask === 'heat' ? '' : formatFormulaHTML(data.substancesById.get(o.ask).formula);
    return html`<form class="stoich-form" data-objective="${o.id}"><span class="small muted">Equação: ${r.name}</span>
      <div class="stoich-row"><input name="answer" inputmode="decimal" autocomplete="off" aria-label="Resposta (${ph})" placeholder="${ph}"><span class="small">${label} ${raw(what)}</span>
      <button class="btn btn-primary" type="submit">Conferir</button></div></form>`;
  }

  /** Pergunta de cinética (Fase 3B): campo numérico e atalho para o laboratório. */
  function kineticsForm(o) {
    return html`<form class="stoich-form" data-objective="${o.id}">
      <div class="stoich-row"><input name="answer" inputmode="decimal" autocomplete="off" aria-label="Resposta (${o.unitLabel})" placeholder="${o.unitLabel}"><span class="small">${o.unitLabel}</span>
      <button class="btn btn-primary" type="submit">Conferir</button></div>
      <button type="button" class="btn btn-ghost btn-small" data-open-kinetics="${o.kinetics}">⏱️ Abrir ${data.kinetics.byId.get(o.kinetics).name.toLowerCase()} no laboratório</button></form>`;
  }

  function submitStoich(objectiveId, answer) {
    const prevLevel = state.levelIndex;
    const { state: next, events, correct } = answerObjective(state, objectiveId, answer, data);
    if (!correct) {
      const kind = data.progression.levels.flatMap((l) => l.objectives).find((o) => o.id === objectiveId)?.type;
      toast(kind === 'kinetics' ? 'Ainda não. Confira a fórmula e as unidades (a dica ajuda).' : 'Ainda não. Confira a conversão gramas → mol → gramas (a dica ajuda).');
      return;
    }
    state = next;
    storage.save(state);
    for (const e of events) if (e.type === 'objective') toast(`🎯 Objetivo concluído: ${e.objective.text}`, 'good');
    const completed = events.filter((e) => e.type === 'level-complete').map((e) => e.level);
    if (completed.length) showLevelDialog(completed, state.levelIndex !== prevLevel ? data.progression.levels[state.levelIndex] : null);
    renderAll();
  }

  function showLevelDialog(completedLevels, nextLevel) {
    const dlg = $('#level-dialog');
    const last = completedLevels[completedLevels.length - 1];
    const u = nextLevel?.unlocks ?? {};
    const unlockedNames = [
      ...(u.elements ?? []).map((s) => data.elementsBySymbol.get(s).name),
      ...(u.substances ?? []).map((id) => data.substancesById.get(id).name),
      ...(u.items ?? []).map((id) => `${data.itemsById.get(id).icon} ${data.itemsById.get(id).name}`),
    ];
    $('#level-dialog-body').innerHTML = html`
      <p class="result-kicker">Nível concluído</p>
      <h2>${last.title}</h2>
      <p><strong>O que você aprendeu:</strong> ${last.lesson}</p>
      ${raw(
        nextLevel
          ? html`<hr><h3>Próximo: ${nextLevel.title}</h3><p>${nextLevel.intro}</p>
            ${raw(unlockedNames.length ? `<p class="small"><strong>Desbloqueado:</strong> ${unlockedNames.map(esc).join(', ')}</p>` : '')}`
          : '<hr><h3>🏆 Você concluiu todos os níveis!</h3>',
      )}`;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  // ---------- Toasts ----------
  function toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    $('#toasts').append(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3700);
  }

  function renderAll() {
    renderInventory();
    renderBench();
    renderObjectives();
    table.refresh();
  }

  // ---------- Eventos ----------
  $('#inventory').addEventListener('click', (ev) => {
    const chip = ev.target.closest('[data-id]');
    if (chip) addToBench(chip.dataset.id);
  });
  $('#inventory').addEventListener('dragstart', (ev) => {
    const chip = ev.target.closest('[data-id]');
    if (chip) ev.dataTransfer.setData('text/plain', chip.dataset.id);
  });
  const benchEl = $('#bench');
  benchEl.addEventListener('dragover', (ev) => {
    ev.preventDefault();
    benchEl.classList.add('is-drop');
  });
  benchEl.addEventListener('dragleave', () => benchEl.classList.remove('is-drop'));
  benchEl.addEventListener('drop', (ev) => {
    ev.preventDefault();
    benchEl.classList.remove('is-drop');
    const id = ev.dataTransfer.getData('text/plain');
    if (data.substancesById.has(id) || data.itemsById.has(id)) addToBench(id);
  });
  $('#bench-slots').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-remove]');
    if (b) removeFromBench(b.dataset.remove);
  });
  $('#objectives').addEventListener('submit', (ev) => {
    const form = ev.target.closest('.stoich-form');
    if (!form) return;
    ev.preventDefault();
    submitStoich(form.dataset.objective, form.elements.answer?.value ?? '');
  });
  $('#objectives').addEventListener('click', (ev) => {
    const b = ev.target.closest('.stoich-choice');
    if (b) submitStoich(b.closest('.stoich-form').dataset.objective, b.dataset.answer);
  });
  // Laboratório de velocidade (Fase 3B): abre pelo topo, pelo painel de resultado ou pelos objetivos.
  const kineticsLab = mountKineticsLab($('#kinetics-dialog'), data);
  $('#btn-kinetics').addEventListener('click', () => kineticsLab.open());
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-open-kinetics]');
    if (b) kineticsLab.open(b.dataset.openKinetics || null);
  });
  $('#btn-react').addEventListener('click', react);
  $('#btn-clear').addEventListener('click', () => {
    bench = [];
    renderAll();
  });
  $('#inv-search').addEventListener('input', renderInventory);
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Recomeçar do nível 1? Todo o progresso será apagado.')) return;
    storage.clear();
    state = initialState(data);
    bench = [];
    lastNew = new Set();
    renderWelcome($('#result'));
    renderAll();
  });
  $('#level-dialog-close').addEventListener('click', () => $('#level-dialog').close?.() ?? $('#level-dialog').removeAttribute('open'));
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && bench.length) react();
  });

  renderWelcome($('#result'));
  renderAll();
  // Glossário: termos dos textos explicativos viram links para a definição.
  initGlossaryUI(data, ['#result', '#objectives', '.pt-info', '#level-dialog-body', '#kinetics-dialog .kin-body']);
}

main();
