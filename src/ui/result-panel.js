// Painel de explicação: mostra o resultado de uma combinação com equação, porquê,
// conservação de átomos/massa, segurança e fonte.

import { html, raw, esc, TYPE_LABEL } from './dom.js';
import { formatFormulaHTML } from '../core/formula.js';
import { resolveSide, checkConservation, formatEquationHTML } from '../core/equation.js';
import { molarMass } from '../core/formula.js';

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

const itemLabel = (data, id) => {
  const it = data.itemsById.get(id);
  return `${it.icon} ${it.name}`;
};

export function renderResult(root, data, result, { newSubstances = [] } = {}) {
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
      <div class="badges">${raw(r.types.map((t) => `<span class="badge type-${t}">${TYPE_LABEL[t]}</span>`).join(''))}</div>
      <div class="equation" aria-label="Equação balanceada">${raw(formatEquationHTML(reactants, products, { reversible: r.reversible }))}</div>
      ${raw(conds ? `<p class="small muted">Condição: ${esc(conds)}</p>` : '')}
      ${raw(newSubstances.length ? `<p class="discovered">✨ Nova descoberta: ${newSubstances.map((s) => `<strong>${esc(s.name)}</strong> (${formatFormulaHTML(s.formula)})`).join(', ')}</p>` : '')}
      <p>${r.explanation}</p>
      <h3>Por quê?</h3>
      <p>${r.why}</p>
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
      ${raw(sourceHTML(data, r.source))}`;
    return;
  }

  if (result.kind === 'needs-condition') {
    const missing = result.missing.map((anyOf) => anyOf.map((id) => itemLabel(data, id)).join(' ou '));
    const desc = [...new Set(result.missing.flat())].map((id) => data.itemsById.get(id));
    root.innerHTML = html`
      <p class="result-kicker">Quase!</p>
      <h2>Essas substâncias reagem, mas falta algo</h2>
      <p>Adicione à bancada: <strong>${missing.join(' + ')}</strong>.</p>
      <h3>Por quê?</h3>
      <p>Muitas reações não começam sozinhas, mesmo liberando energia depois. É preciso vencer uma "barreira" inicial, a <strong>energia de ativação</strong> — ou baixá-la com um catalisador.</p>
      <ul class="small">${raw(desc.map((it) => `<li><strong>${esc(it.icon)} ${esc(it.name)}:</strong> ${esc(it.description)}</li>`).join(''))}</ul>`;
    return;
  }

  const kicker = { 'no-reaction': 'Não reage', unknown: 'Desconhecido', invalid: 'Bancada' }[result.kind];
  root.innerHTML = html`
    <p class="result-kicker">${kicker}</p>
    <h2>${result.title}</h2>
    <p>${result.reason}</p>
    ${raw(result.kind === 'unknown' ? '<p class="small muted">O jogo só afirma que algo reage (ou não) quando tem uma reação conferida com fonte ou uma regra química sólida.</p>' : '')}
    ${raw(sourceHTML(data, result.source))}`;
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
