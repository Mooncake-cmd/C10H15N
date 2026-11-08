// Ponto de entrada da interface: carrega dados, estado salvo, e liga os componentes.
// Toda a química fica em src/core (testável sem navegador); aqui só há interface.

import { loadGameData } from './loader.js';
import { createEngine } from './core/engine.js';
import { initialState, applyResult, inventory, restoreState, unlockLevelMap, isObjectiveDone, answerObjective, startMission, abandonMission, missionCombine, answerMission, missionLab, reviewsDue, answerReview, isAnswerObjective, questionResting } from './core/progression.js';
import { attemptsLeft, maxAttempts, pendingQuestion } from './core/guard.js';
import { reviewsMastered, REVIEW_INTERVALS } from './core/review.js';
import { missionInventory, calcWorked, isMissionAvailable } from './core/missions.js';
import { lookupReaction } from './core/engine.js';
import { formatFormulaHTML, formatFormulaText } from './core/formula.js';
import { renderPeriodicTable } from './ui/periodic-table.js';
import { renderResult, renderWelcome } from './ui/result-panel.js';
import { $, html, raw, esc, mainCategory } from './ui/dom.js';
import { displayStructure } from './core/structure.js';
import { structureSVG } from './ui/structure-svg.js';
import { initGlossaryUI } from './ui/glossary-ui.js';
import { mountKineticsLab } from './ui/kinetics-lab.js';
import { mountCalculators } from './ui/calculators.js';
import { mountEquilibriumLab } from './ui/equilibrium-lab.js';
import { renderMoleculeCard, galleryGroups, moleculeName } from './ui/molecule-card.js';
import { missionListHTML, missionPanelHTML, missionCompleteHTML, chemText } from './ui/missions-ui.js';
import { mountLab, separationResultHTML, flameResultHTML } from './ui/lab-ui.js';
import { FUNDAMENTAL_TYPES, fundamentalsExplain, fundamentalsMistake } from './core/fundamentals.js';

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
  let missionFeedback = null; // último retorno da missão: { kind, html }
  let objectiveFeedback = null; // último erro numa pergunta dos fundamentos: { id, text }
  let reviewFeedback = null; // último retorno da revisão (Fase 4C): { kind, html }
  // Fase 4D: laboratórios e calculadora mostram o caminho, não o número, das perguntas pendentes.
  const guard = (kind, params) => pendingQuestion(state, data, kind, params);

  // Durante uma missão (Fase 3F), só o kit dela (e o que foi produzido nela) vale na bancada.
  const activeMission = () => (state.missionRun ? data.missionsById.get(state.missionRun.id) : null);
  const currentInventory = () => (state.missionRun ? missionInventory(state.missionRun, activeMission()) : inventory(state, data));

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
    const inv = currentInventory();
    $('#inventory').classList.toggle('is-mission', !!state.missionRun);
    $('#inventory h2').textContent = state.missionRun ? `Kit da missão ${activeMission().icon}` : 'Inventário';
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
    $('#inv-count').textContent = state.missionRun ? 'só o kit vale na missão' : `${found}/${collection.length} compostos${extras ? ` · +${extras} extras` : ''}`;
  }

  // ---------- Bancada ----------
  function addToBench(id) {
    if (bench.includes(id)) return;
    const isItem = data.itemsById.has(id);
    if (state.missionRun) {
      const inv = currentInventory();
      if (!(isItem ? inv.items : inv.substances).includes(id)) {
        toast('Nesta missão, só vale o kit (veja o inventário).');
        return;
      }
    }
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
    if (state.missionRun?.failed) {
      toast('As tentativas acabaram: recomece a missão ou saia dela.');
      return;
    }
    const result = engine.combine(bench);
    const prevLevel = state.levelIndex;
    const inMission = !!state.missionRun;
    const { state: next, events } = inMission ? missionCombine(state, [...bench], result, data) : applyResult(state, result, data);
    state = next;
    storage.save(state);
    if (inMission) {
      const steps = events.filter((e) => e.type === 'mission-step');
      missionFeedback = steps.length
        ? { kind: 'good', html: steps.map((e) => `✔ ${chemText(e.step.done)}`).join('<br>') }
        : events.some((e) => e.type === 'mission-failed')
          ? null
          : { kind: 'info', html: 'Essa combinação não cumpriu nenhuma etapa da missão (gastou uma tentativa). Veja o resultado ao lado e a dica da etapa.' };
    }

    const discovered = events.filter((e) => e.type === 'discovered').map((e) => e.substance);
    lastNew = new Set(discovered.map((s) => s.id));
    renderResult($('#result'), data, result, { newSubstances: discovered, guard });
    $('#result').scrollTop = 0;
    if (window.matchMedia('(max-width: 900px)').matches) $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });

    for (const e of events) {
      if (e.type === 'objective') toast(`🎯 Objetivo concluído: ${e.objective.text}`, 'good');
    }
    if (result.kind === 'reaction') bench = [];

    showEndDialogs(events, prevLevel);
    renderAll();
  }

  /** Missão concluída e/ou nível concluído: uma tela só, com as duas coisas. */
  function showEndDialogs(events, prevLevel) {
    const doneMission = events.find((e) => e.type === 'mission-complete')?.mission;
    if (doneMission) missionFeedback = null;
    const completed = events.filter((e) => e.type === 'level-complete').map((e) => e.level);
    if (completed.length) reviewFeedback = null;
    const prefix = doneMission ? missionCompleteHTML(doneMission, data) : '';
    if (completed.length) showLevelDialog(completed, state.levelIndex !== prevLevel ? data.progression.levels[state.levelIndex] : null, prefix);
    else if (prefix) showDialogHTML(prefix);
  }

  // ---------- Objetivos ----------
  function renderObjectives() {
    const levels = data.progression.levels;
    const level = levels[state.levelIndex];
    const done = level.objectives.filter((o) => state.completedObjectives.includes(o.id)).length;
    $('#level-name').textContent = state.finished ? 'Todas as fases concluídas — modo livre' : `${level.phaseLabel ?? `Fase ${level.phase ?? 1}`} · Nível ${state.levelIndex + 1}/${levels.length}: ${level.title}`;
    const overall = levels.flatMap((l) => l.objectives);
    const pct = Math.round((100 * state.completedObjectives.length) / overall.length);
    $('#progress-bar').style.width = `${pct}%`;
    $('#progress-bar').parentElement.setAttribute('aria-valuenow', String(pct));

    $('#objectives').innerHTML = (state.missionRun ? missionPanelHTML(state, data, missionFeedback) : '') + reviewHTML() + html`
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
                  <div><span>${raw(chemText(o.text))}</span>${raw(!ok && isAnswerObjective(o) ? questionBlock(o) : '')}${raw(ok && FUNDAMENTAL_TYPES.includes(o.type) ? html`<p class="small muted objective-why">${raw(chemText(fundamentalsExplain(o, data)))}</p>` : '')}${raw(!ok && o.type === 'mission' && state.missionRun?.id !== o.mission ? html`<div><button type="button" class="btn btn-ghost btn-small" data-mission-start="${o.mission}">🗺️ Começar esta missão</button></div>` : '')}${raw(!ok && o.hint ? `<details class="hint"><summary>Dica</summary>${esc(o.hint)}</details>` : '')}</div></li>`;
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

  /** Pergunta de equilíbrio (Fase 3C): número ou escolha (Le Chatelier), com atalho para o laboratório. */
  function equilibriumForm(o) {
    const section = { pH: 'ph', bufferPH: 'buf', solubility: 'sol', shift: 'gas' }[o.ask];
    const open = JSON.stringify({ section, species: o.species, salt: o.salt, gas: o.gas });
    const lab = html`<button type="button" class="btn btn-ghost btn-small" data-open-equilibrium="${open}">⚖️ Abrir no laboratório de equilíbrio</button>`;
    if (o.choices) {
      const opts = o.choices.map((c) => html`<button type="button" class="btn btn-ghost stoich-choice" data-answer="${c.value}">${c.label}</button>`).join('');
      return html`<form class="stoich-form" data-objective="${o.id}"><div class="stoich-row">${raw(opts)}</div>${raw(lab)}</form>`;
    }
    return html`<form class="stoich-form" data-objective="${o.id}">
      <div class="stoich-row"><input name="answer" inputmode="decimal" autocomplete="off" aria-label="Resposta (${o.unitLabel})" placeholder="${o.unitLabel}"><span class="small">${o.unitLabel}</span>
      <button class="btn btn-primary" type="submit">Conferir</button></div>${raw(lab)}</form>`;
  }

  /** Pergunta de forma molecular (Fase 3D): escolha ou número, com atalho para a galeria 3D. */
  function moleculeForm(o) {
    const view = html`<button type="button" class="btn btn-ghost btn-small" data-open-molecule="${o.molecule}">🧊 Ver ${formatFormulaText(o.molecule)} em 3D</button>`;
    if (o.choices) {
      const opts = o.choices.map((c) => html`<button type="button" class="btn btn-ghost stoich-choice" data-answer="${c.value}">${c.label}</button>`).join('');
      return html`<form class="stoich-form" data-objective="${o.id}"><div class="stoich-row">${raw(opts)}</div>${raw(view)}</form>`;
    }
    return html`<form class="stoich-form" data-objective="${o.id}">
      <div class="stoich-row"><input name="answer" inputmode="numeric" autocomplete="off" aria-label="Resposta (${o.unitLabel})" placeholder="${o.unitLabel}"><span class="small">${o.unitLabel}</span>
      <button class="btn btn-primary" type="submit">Conferir</button></div>${raw(view)}</form>`;
  }

  /** Pergunta de química orgânica (Fase 3E): escolha, com atalho para ver a molécula (e o nome explicado). */
  function organicForm(o) {
    const opts = o.choices.map((c) => html`<button type="button" class="btn btn-ghost stoich-choice" data-answer="${c.value}">${c.label}</button>`).join('');
    const view = html`<button type="button" class="btn btn-ghost btn-small" data-open-molecule="${o.molecule}">🧊 Ver ${formatFormulaText(o.molecule)} em 3D</button>`;
    return html`<form class="stoich-form" data-objective="${o.id}"><div class="stoich-row">${raw(opts)}</div>${raw(view)}</form>`;
  }

  /** Pergunta do nível (Fase 4D): o formulário com as tentativas, ou o aviso de descanso. */
  function questionBlock(o) {
    const fb = objectiveFeedback?.id === o.id && !FUNDAMENTAL_TYPES.includes(o.type) ? html`<div class="mission-feedback is-bad" role="status">✘ ${raw(chemText(objectiveFeedback.text))}</div>` : '';
    if (questionResting(o, state, data)) {
      const why = objectiveFeedback?.id === o.id ? html`<div class="mission-feedback is-bad" role="status">✘ ${raw(chemText(objectiveFeedback.text))}</div>` : '';
      return html`${raw(why)}<p class="small rest-note">⏸ As tentativas desta pergunta acabaram por agora. Releia o porquê do erro e a dica, conclua outro objetivo (ou acerte uma revisão) e ela volta, com as tentativas renovadas.</p>`;
    }
    const left = attemptsLeft(o, state);
    const max = maxAttempts(o);
    const note = html`<p class="small muted attempts-note">${left === max ? `${max} tentativa${max > 1 ? 's' : ''}` : `Resta${left > 1 ? 'm' : ''} ${left} tentativa${left > 1 ? 's' : ''}`}${max === 1 ? ' — pense antes de escolher' : ''}.</p>`;
    return answerForm(o) + fb + note;
  }

  /** Formulário de resposta de qualquer pergunta (usado nos níveis e na revisão). */
  function answerForm(o) {
    if (FUNDAMENTAL_TYPES.includes(o.type)) return fundamentalsForm(o);
    return { stoich: stoichForm, kinetics: kineticsForm, equilibrium: equilibriumForm, molecule: moleculeForm, organic: organicForm }[o.type]?.(o) ?? '';
  }

  /** Revisão espaçada (Fase 4C): até 3 perguntas de níveis anteriores, de assuntos diferentes. */
  function reviewHTML() {
    const due = reviewsDue(state, data);
    if (!due.length && !reviewFeedback) return '';
    const fb = reviewFeedback ? `<div class="mission-feedback is-${reviewFeedback.kind}" role="status">${reviewFeedback.html}</div>` : '';
    const items = due
      .map(({ objective: o, level }) => html`<div class="review-item"><p class="small muted">De “${level.title}”</p><p>${raw(chemText(o.text))}</p>${raw(answerForm(o))}</div>`)
      .join('');
    const mastered = reviewsMastered(state);
    return html`<section class="review-box" data-review aria-label="Revisão"><h3>🔁 Revisão</h3>
      <p class="small muted">Perguntas de níveis anteriores. Acertou, ela volta mais tarde; errou, volta no próximo nível.${mastered ? ` ${mastered} já dominada${mastered > 1 ? 's' : ''}.` : ''}</p>
      ${raw(fb)}${raw(items || '<p class="small">Nenhuma pergunta para revisar agora.</p>')}</section>`;
  }

  function submitReview(objectiveId, answer) {
    const o = data.progression.levels.flatMap((l) => l.objectives).find((x) => x.id === objectiveId);
    const res = answerReview(state, objectiveId, answer, data);
    if (!res.entry) return;
    state = res.state;
    storage.save(state);
    if (res.correct) {
      const later = res.entry.done ? 'Essa você dominou: sai da revisão.' : `Volta daqui a ${REVIEW_INTERVALS[res.entry.box]} níveis.`;
      const why = FUNDAMENTAL_TYPES.includes(o.type) ? ` ${chemText(fundamentalsExplain(o, data))}` : '';
      reviewFeedback = { kind: 'good', html: `✔ Certo! ${esc(later)}${why}` };
    } else {
      const why = FUNDAMENTAL_TYPES.includes(o.type) ? fundamentalsMistake(o, answer, data) : `Ainda não.${o.hint ? ` Dica: ${o.hint}` : ''}`;
      reviewFeedback = { kind: 'bad', html: `✘ ${chemText(why)} <span class="small">Ela volta no próximo nível.</span>` };
    }
    renderObjectives();
  }

  /** Perguntas dos fundamentos (Fase 4A): escolha ou campo, e o porquê do último erro. */
  function fundamentalsForm(o) {
    const fb = objectiveFeedback?.id === o.id ? html`<div class="mission-feedback is-bad" role="status">✘ ${raw(chemText(objectiveFeedback.text))}</div>` : '';
    const STATES = [
      { value: 's', label: 'sólido' },
      { value: 'l', label: 'líquido' },
      { value: 'g', label: 'gasoso' },
    ];
    const choices = o.type === 'state' ? STATES : o.choices;
    if (choices) {
      const label = (c) => (o.type === 'naming' && o.ask === 'formula' ? formatFormulaHTML(c.value) : chemText(c.label ?? c.value));
      const opts = choices.map((c) => html`<button type="button" class="btn btn-ghost stoich-choice" data-answer="${c.value}">${raw(label(c))}</button>`).join('');
      return html`<form class="stoich-form" data-objective="${o.id}"><div class="stoich-row">${raw(opts)}</div>${raw(fb)}</form>`;
    }
    const numeric = o.type === 'atom' || o.type === 'math' || o.ask === 'valence';
    // Expoentes podem ser negativos, e o teclado numérico do celular não tem o sinal de menos.
    const mode = o.type === 'math' ? (o.ask === 'exponent' ? 'text' : 'decimal') : numeric ? 'numeric' : 'text';
    return html`<form class="stoich-form" data-objective="${o.id}">
      <div class="stoich-row"><input name="answer" inputmode="${mode}" autocomplete="off" spellcheck="false" aria-label="Resposta (${o.unitLabel})" placeholder="${o.unitLabel}">${raw(numeric ? html`<span class="small">${o.unitLabel}</span>` : '')}
      <button class="btn btn-primary" type="submit">Conferir</button></div>${raw(fb)}</form>`;
  }

  function submitStoich(objectiveId, answer) {
    const prevLevel = state.levelIndex;
    const { state: next, events, correct, resting } = answerObjective(state, objectiveId, answer, data);
    const objective = data.progression.levels.flatMap((l) => l.objectives).find((o) => o.id === objectiveId);
    if (resting) return renderObjectives();
    if (!correct) {
      state = next;
      storage.save(state);
    }
    if (objective && FUNDAMENTAL_TYPES.includes(objective.type)) {
      objectiveFeedback = correct ? null : { id: objectiveId, text: fundamentalsMistake(objective, answer, data) };
      if (!correct) return renderObjectives();
    }
    if (correct) objectiveFeedback = null;
    if (!correct) {
      const kind = objective?.type;
      objectiveFeedback = { id: objectiveId, text: kind === 'organic' ? 'Ainda não. Abra a molécula na galeria: lá o nome e a função aparecem explicados (a dica ajuda).' : kind === 'molecule' ? 'Ainda não. Gire a molécula em 3D e conte ligações e pares isolados (a dica ajuda).' : kind === 'kinetics' || kind === 'equilibrium' ? 'Ainda não. Confira a fórmula e as unidades (a dica ajuda).' : 'Ainda não. Confira a conversão gramas → mol → gramas (a dica ajuda).' };
      renderObjectives();
      return;
    }
    state = next;
    storage.save(state);
    for (const e of events) if (e.type === 'objective') toast(`🎯 Objetivo concluído: ${e.objective.text}`, 'good');
    showEndDialogs(events, prevLevel);
    renderAll();
  }

  /** Resposta a uma pergunta da missão: o porquê (certo ou errado) ou o caminho da conta. */
  function submitMission(stepId, answer) {
    const step = activeMission()?.steps.find((x) => x.id === stepId);
    if (!step) return;
    const prevLevel = state.levelIndex;
    const res = answerMission(state, stepId, answer, data);
    state = res.state;
    storage.save(state);
    if (!res.correct) {
      missionFeedback = state.missionRun?.failed
        ? null
        : { kind: 'bad', html: step.kind === 'choice' ? `✘ ${chemText(res.why ?? 'Não.')}` : `✘ Ainda não (gastou uma tentativa). O caminho: ${chemText(step.hint)}` };
    } else {
      missionFeedback =
        step.kind === 'choice'
          ? { kind: 'good', html: `✔ ${chemText(res.why)}` }
          : { kind: 'good', html: `✔ Certo! O caminho da conta:<ol>${calcWorked(step, data).map((l) => `<li>${chemText(l)}</li>`).join('')}</ol>` };
      for (const e of res.events) if (e.type === 'objective') toast(`🎯 Objetivo concluído: ${e.objective.text}`, 'good');
    }
    showEndDialogs(res.events, prevLevel);
    renderAll();
  }

  /** Ação de laboratório na missão: separar a mistura com um método ou levar uma amostra à chama. */
  function submitLab(action) {
    if (state.missionRun?.failed) {
      toast('As tentativas acabaram: recomece a missão ou saia dela.');
      return;
    }
    const prevLevel = state.levelIndex;
    const res = missionLab(state, action, data);
    state = res.state;
    storage.save(state);
    const done = res.events.filter((e) => e.type === 'mission-step').map((e) => `<p>✔ ${chemText(e.step.done)}</p>`).join('');
    const failedNow = res.events.some((e) => e.type === 'mission-failed');
    if (action.type === 'separate') {
      const method = data.lab.methodsById.get(action.method);
      // Separou, mas não do jeito que a etapa pede (ex.: evaporar quando ela pede para guardar a água).
      const notThis = res.outcome.ok && !done ? '<p class="small">Mas não é o que esta etapa pede (gastou uma tentativa): releia a etapa e a dica.</p>' : '';
      missionFeedback = failedNow ? null : { kind: res.outcome.ok && done ? 'good' : res.outcome.ok ? 'info' : 'bad', html: separationResultHTML(res.outcome, method) + done + notThis };
    } else {
      const sub = data.substancesById.get(action.substance);
      missionFeedback = failedNow ? null : { kind: done ? 'good' : 'info', html: flameResultHTML(sub, res.outcome) + (done || '<p class="small">Não é a cor que falta encontrar (gastou uma tentativa).</p>') };
    }
    for (const e of res.events) if (e.type === 'objective') toast(`🎯 Objetivo concluído: ${e.objective.text}`, 'good');
    showEndDialogs(res.events, prevLevel);
    renderAll();
  }

  function showDialogHTML(body) {
    const dlg = $('#level-dialog');
    $('#level-dialog-body').innerHTML = body;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }

  function showLevelDialog(completedLevels, nextLevel, prefix = '') {
    const dlg = $('#level-dialog');
    const last = completedLevels[completedLevels.length - 1];
    const u = nextLevel?.unlocks ?? {};
    const unlockedNames = [
      ...(u.elements ?? []).map((s) => data.elementsBySymbol.get(s).name),
      ...(u.substances ?? []).map((id) => data.substancesById.get(id).name),
      ...(u.items ?? []).map((id) => `${data.itemsById.get(id).icon} ${data.itemsById.get(id).name}`),
    ];
    $('#level-dialog-body').innerHTML = (prefix ? `${prefix}<hr>` : '') + html`
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

  // ---------- Missões ----------
  const missionsDlg = $('#missions-dialog');
  function renderMissionsBadge() {
    const n = data.missions.filter((m) => isMissionAvailable(m, state, data) && !state.missionsDone.includes(m.id) && state.missionRun?.id !== m.id).length;
    const b = $('#missions-badge');
    b.hidden = n === 0;
    b.textContent = String(n);
    b.setAttribute('aria-label', `${n} ${n === 1 ? 'missão nova' : 'missões novas'}`);
  }
  function openMissions() {
    missionsDlg.querySelector('.missions-list').innerHTML = missionListHTML(state, data);
    if (typeof missionsDlg.showModal === 'function') missionsDlg.showModal();
    else missionsDlg.setAttribute('open', '');
  }
  const closeMissions = () => missionsDlg.close?.() ?? missionsDlg.removeAttribute('open');
  function beginMission(id) {
    if (state.missionRun && state.missionRun.id !== id && !state.missionRun.failed && !confirm('Sair da missão atual? O progresso dela se perde.')) return;
    state = startMission(state, id, data);
    storage.save(state);
    bench = [];
    missionFeedback = null;
    closeMissions();
    renderAll();
    $('#objectives-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  $('#btn-missions').addEventListener('click', openMissions);
  missionsDlg.querySelector('.missions-close').addEventListener('click', closeMissions);
  document.addEventListener('click', (ev) => {
    const start = ev.target.closest('[data-mission-start]');
    if (start) return beginMission(start.dataset.missionStart);
    if (ev.target.closest('[data-mission-close]')) return closeMissions();
    if (ev.target.closest('[data-missions-open]')) return openMissions();
    if (ev.target.closest('[data-mission-quit]') && confirm('Sair da missão? O progresso dela se perde (o que você descobriu fica).')) {
      state = abandonMission(state);
      storage.save(state);
      bench = [];
      missionFeedback = null;
      renderAll();
    }
  });

  function renderAll() {
    renderMissionsBadge();
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
    const answer = form.elements.answer?.value ?? '';
    if (form.closest('[data-review]')) submitReview(form.dataset.objective, answer);
    else if (form.dataset.missionStep) submitMission(form.dataset.missionStep, answer);
    else submitStoich(form.dataset.objective, answer);
  });
  $('#objectives').addEventListener('click', (ev) => {
    const sep = ev.target.closest('[data-lab-separate]');
    if (sep) return submitLab({ type: 'separate', mixture: sep.dataset.mixture, method: sep.dataset.labSeparate });
    const fl = ev.target.closest('[data-lab-flame]');
    if (fl) return submitLab({ type: 'flame', substance: fl.dataset.labFlame });
    const b = ev.target.closest('.stoich-choice');
    if (!b) return;
    const form = b.closest('.stoich-form');
    if (form.closest('[data-review]')) submitReview(form.dataset.objective, b.dataset.answer);
    else if (form.dataset.missionStep) submitMission(form.dataset.missionStep, b.dataset.answer);
    else submitStoich(form.dataset.objective, b.dataset.answer);
  });
  // Laboratório de velocidade (Fase 3B): abre pelo topo, pelo painel de resultado ou pelos objetivos.
  const kineticsLab = mountKineticsLab($('#kinetics-dialog'), data, { guard });
  $('#btn-kinetics').addEventListener('click', () => kineticsLab.open());
  const calculators = mountCalculators($('#calc-dialog'), data);
  // Galeria de moléculas em 3D (Fase 3D).
  const molDlg = $('#molecules-dialog');
  const molSel = $('#mol-select');
  molSel.innerHTML = galleryGroups(data)
    .map(([label, keys]) => `<optgroup label="${esc(label)}">${keys.map((k) => `<option value="${esc(k)}">${esc(formatFormulaText(k))} — ${esc(moleculeName(k, data))}</option>`).join('')}</optgroup>`)
    .join('');
  let stopGallery = () => {};
  const showGallery = (key) => {
    stopGallery();
    molSel.value = key;
    stopGallery = renderMoleculeCard($('#mol-gallery-card'), key, data);
  };
  molSel.addEventListener('change', () => showGallery(molSel.value));
  const openMolecules = (key) => {
    showGallery(key || molSel.value || 'H2O');
    if (typeof molDlg.showModal === 'function') molDlg.showModal();
    else molDlg.setAttribute('open', '');
  };
  $('#btn-molecules').addEventListener('click', () => openMolecules('H2O'));
  molDlg.addEventListener('close', () => stopGallery());
  molDlg.querySelector('.mol-close').addEventListener('click', () => molDlg.close?.() ?? molDlg.removeAttribute('open'));
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-open-molecule]');
    if (b) openMolecules(b.dataset.openMolecule);
  });

  // Laboratório de equilíbrio (Fase 3C).
  const eqLab = mountEquilibriumLab($('#equilibrium-dialog'), data, { guard });
  $('#btn-equilibrium').addEventListener('click', () => eqLab.open());
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-open-equilibrium]');
    if (b) eqLab.open(JSON.parse(b.dataset.openEquilibrium || '{}'));
  });
  $('#btn-calcs').addEventListener('click', () => calculators.open());
  // Laboratório (utensílios, separação de misturas, teste de chama).
  const lab = mountLab($('#lab-dialog'), data);
  $('#btn-lab').addEventListener('click', () => lab.open());
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
    missionFeedback = null;
    reviewFeedback = null;
    objectiveFeedback = null;
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
  initGlossaryUI(data, ['#result', '#objectives', '.pt-info', '#level-dialog-body', '#kinetics-dialog .kin-body', '#calc-dil-out', '#calc-mix-out', '#calc-formula-out', '#calc-conc-out', '#equilibrium-dialog .eq-out', '#mol-gallery-card', '#missions-dialog .missions-list', '#lab-dialog .lab-body']);
}

main();
