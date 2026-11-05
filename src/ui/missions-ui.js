// Missões (Fase 3F): lista do painel 🗺️, quadro da missão em andamento (no lugar dos objetivos)
// e a tela de missão concluída. Só HTML; a lógica fica em src/core/missions.js e progression.js.

import { esc } from './dom.js';
import { formatFormulaHTML } from '../core/formula.js';
import { sourceText } from './kinetics-lab.js';
import { currentSteps, isAction, attemptsLeft, isMissionAvailable } from '../core/missions.js';
import { chemText } from './chem-text.js';
import { flameTest } from '../core/lab.js';

export const FORMAT_LABEL = { historia: 'História', laboratorio: 'Laboratório', ambiental: 'Ambiental' };

export { chemText };

function levelTitle(data, id) {
  const i = data.progression.levels.findIndex((l) => l.id === id);
  return i >= 0 ? `nível ${i + 1} (${data.progression.levels[i].title})` : id;
}

/** Cartões do painel de missões. */
export function missionListHTML(state, data) {
  return data.missions
    .map((m) => {
      const done = (state.missionsDone ?? []).includes(m.id);
      const active = state.missionRun?.id === m.id;
      const open = isMissionAvailable(m, state, data);
      const status = active ? 'Em andamento' : done ? '✔ Concluída' : open ? 'Disponível' : `🔒 Libera depois do ${levelTitle(data, m.after)}`;
      const action = !open
        ? ''
        : active
          ? `<button type="button" class="btn btn-primary" data-mission-close>Continuar</button>`
          : `<button type="button" class="btn ${done ? 'btn-ghost' : 'btn-primary'}" data-mission-start="${esc(m.id)}">${done ? 'Jogar de novo' : 'Começar'}</button>`;
      return `<article class="mission-card${open ? '' : ' is-locked'}${done ? ' is-done' : ''}">
        <div class="mission-card-head"><span class="mission-icon" aria-hidden="true">${m.icon}</span>
          <div><h3>${chemText(m.title)}</h3><p class="small muted">${FORMAT_LABEL[m.format]} · ${m.steps.length} etapas · ${m.maxAttempts} tentativas · <strong>${esc(status)}</strong></p></div></div>
        ${open ? `<p class="small">${chemText(m.story)}</p>` : ''}
        <div class="mission-card-actions">${action}</div></article>`;
    })
    .join('');
}

const kitHTML = (m, data) =>
  [
    ...m.kit.substances.map((id) => formatFormulaHTML(data.substancesById.get(id).formula)),
    ...(m.kit.items ?? []).map((id) => `${data.itemsById.get(id).icon} ${esc(data.itemsById.get(id).name)}`),
    ...(m.kit.methods ?? []).map((id) => `${data.lab.methodsById.get(id).icon} ${esc(data.lab.methodsById.get(id).name.toLowerCase())}`),
  ].join(', ');

/** Botões de laboratório de uma etapa atual: métodos para separar a mistura, ou amostras para a chama. */
function labButtons(step, m, data) {
  if (step.kind === 'separate') {
    const mix = data.lab.mixturesById.get(step.mixture);
    const methods = m.kit.methods.map((id) => {
      const x = data.lab.methodsById.get(id);
      return `<button type="button" class="btn btn-ghost" data-lab-separate="${esc(id)}" data-mixture="${esc(step.mixture)}" title="${esc(x.principle)}">${x.icon} ${esc(x.name)}</button>`;
    });
    return `<p class="small mission-mixture"><strong>${esc(mix.name)}</strong>: ${chemText(mix.components)} <span class="muted">(${chemText(mix.phases)})</span></p><div class="lab-methods">${methods.join('')}</div>`;
  }
  const subs = m.kit.substances.filter((id) => flameTest(id, data));
  return `<div class="lab-methods">${subs.map((id) => `<button type="button" class="btn btn-ghost" data-lab-flame="${esc(id)}">🔥 ${formatFormulaHTML(data.substancesById.get(id).formula)}</button>`).join('')}</div>`;
}

function questionForm(step) {
  if (step.kind === 'choice') {
    const opts = step.choices.map((c) => `<button type="button" class="btn btn-ghost stoich-choice mission-choice" data-answer="${esc(c.value)}">${chemText(c.label)}</button>`).join('');
    return `<form class="stoich-form mission-form" data-mission-step="${esc(step.id)}"><div class="mission-choices">${opts}</div></form>`;
  }
  return `<form class="stoich-form mission-form" data-mission-step="${esc(step.id)}">
    <div class="stoich-row"><input name="answer" inputmode="decimal" autocomplete="off" aria-label="Resposta (${esc(step.unitLabel)})" placeholder="${esc(step.unitLabel)}"><span class="small">${esc(step.unitLabel)}</span>
    <button class="btn btn-primary" type="submit">Conferir</button></div></form>`;
}

/**
 * Quadro da missão em andamento.
 * @param feedback { kind: 'good'|'bad'|'info', html } — o último retorno (o porquê de uma resposta,
 *   o caminho de uma conta, o que se observou numa etapa)
 */
export function missionPanelHTML(state, data, feedback) {
  const run = state.missionRun;
  const m = data.missionsById.get(run.id);
  const now = new Set(currentSteps(run, m).map((s) => s.id));
  const left = attemptsLeft(run, m);
  let hiddenAhead = 0;
  let flameShown = false;
  const items = m.steps
    .map((s) => {
      const done = run.done.includes(s.id);
      if (!done && !now.has(s.id)) {
        hiddenAhead += 1;
        return '';
      }
      const icon = s.kind === 'separate' ? '🧪' : s.kind === 'flame' ? '🔥' : isAction(s) ? '⚗️' : s.kind === 'calc' ? '🧮' : '❓';
      // Teste de chama: as várias etapas abertas ao mesmo tempo usam os mesmos botões (só na primeira).
      const firstFlame = !done && s.kind === 'flame' && !flameShown && (flameShown = true);
      const lab = !run.failed && (s.kind === 'separate' || firstFlame) ? labButtons(s, m, data) : '';
      const body = done
        ? isAction(s)
          ? `<p class="small muted">${chemText(s.done)}</p>`
          : ''
        : `${run.failed ? '' : isAction(s) ? lab : questionForm(s)}${s.hint && !run.failed ? `<details class="hint"><summary>Dica</summary>${chemText(s.hint)}</details>` : ''}`;
      return `<li class="${done ? 'is-done' : 'is-now'}"><span class="check" aria-hidden="true">${done ? '✔' : icon}</span><div><span>${chemText(s.text)}</span>${body}</div></li>`;
    })
    .join('');
  const fb = feedback ? `<div class="mission-feedback is-${feedback.kind}" role="status">${feedback.html}</div>` : '';
  const failed = run.failed
    ? `<div class="mission-feedback is-bad"><strong>As tentativas acabaram.</strong> Recomece a missão: o que você já descobriu continua no inventário, e agora você sabe mais sobre o caminho.
        <div class="mission-actions"><button type="button" class="btn btn-primary" data-mission-start="${esc(m.id)}">↺ Recomeçar a missão</button></div></div>`
    : '';
  return `<section class="mission-box" aria-label="Missão em andamento">
    <p class="result-kicker">Missão · ${FORMAT_LABEL[m.format]}</p>
    <h2>${m.icon} ${chemText(m.title)}</h2>
    <details class="mission-story" ${run.done.length ? '' : 'open'}><summary>A história</summary><p class="small">${chemText(m.story)}</p></details>
    <p class="small"><strong>Kit:</strong> ${kitHTML(m, data)}</p>
    <p class="mission-attempts small" aria-label="Tentativas restantes: ${left} de ${m.maxAttempts}">Tentativas: ${'●'.repeat(left)}${'○'.repeat(m.maxAttempts - left)} <span class="muted">(${left} de ${m.maxAttempts}; cada ${m.steps.some((s) => s.kind === 'separate' || s.kind === 'flame') ? 'teste' : 'combinação'} e cada resposta errada gasta uma)</span></p>
    ${fb}${failed}
    <ul class="objective-list mission-steps">${items}</ul>
    ${hiddenAhead ? `<p class="small muted">+ ${hiddenAhead} ${hiddenAhead === 1 ? 'etapa' : 'etapas'} depois desta${now.size > 1 ? 's' : ''}.</p>` : ''}
    <div class="mission-actions"><button type="button" class="btn btn-ghost btn-small" data-mission-quit>Sair da missão</button>
      <button type="button" class="btn btn-ghost btn-small" data-missions-open>🗺️ Todas as missões</button></div>
  </section>`;
}

/** Corpo da tela de missão concluída. */
export function missionCompleteHTML(mission, data) {
  const s = mission.safety;
  return `<p class="result-kicker">Missão concluída</p>
    <h2>${mission.icon} ${chemText(mission.title)}</h2>
    <p><strong>O que você descobriu:</strong> ${chemText(mission.conclusion)}</p>
    <div class="safety safety-${esc(s.level)}"><strong>Segurança</strong><p>${chemText(s.why)}</p><p>${chemText(s.home)}</p></div>
    <p class="small muted">Roteiro e química: ${sourceText(data, mission.sources)}.</p>`;
}
