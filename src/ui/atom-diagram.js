// Desenhos do átomo no painel da tabela periódica: o modelo de camadas (círculos com os
// elétrons) e o diagrama de Pauling do elemento (subcamadas preenchidas na ordem das diagonais).
// Gerados em SVG a partir do dataset; a química (ordem, soma por camada, exceções) vem de
// src/core/fundamentals.js.

import { esc } from './dom.js';
import { paulingPath } from '../core/fundamentals.js';

const SHELLS = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).replace(/\d/g, (d) => SUP[d]);
/** "1s2 2s2 2p6" → "1s² 2s² 2p⁶" */
export const configText = (conf) => conf.replace(/([spdf])(\d+)/g, (m, l, n) => `${l}${sup(n)}`);

/** Modelo de camadas: núcleo no centro e um círculo por camada, com os elétrons em pontos. */
export function shellModelSVG(e) {
  const sh = e.shells ?? [];
  const S = 260;
  const c = S / 2;
  const rN = 21;
  const step = (S / 2 - 8 - rN) / Math.max(sh.length, 1);
  const parts = [];
  sh.forEach((count, i) => {
    const r = rN + step * (i + 1);
    const last = i === sh.length - 1;
    parts.push(`<circle class="ring" cx="${c}" cy="${c}" r="${r.toFixed(1)}"/>`);
    // Pontos igualmente espaçados; se não couberem (nunca acontece no dataset), mostra o número.
    if (count > Math.floor((2 * Math.PI * r) / 7)) {
      parts.push(`<text class="ring-count" x="${c + r}" y="${c + 4}" text-anchor="middle">${count}</text>`);
      return;
    }
    const offset = i % 2 ? Math.PI / count : 0; // camadas alternadas giram um pouco (fica menos "alinhado")
    for (let k = 0; k < count; k++) {
      const a = -Math.PI / 2 + offset + (2 * Math.PI * k) / count;
      parts.push(`<circle class="e${last ? ' last' : ''}" cx="${(c + r * Math.cos(a)).toFixed(1)}" cy="${(c + r * Math.sin(a)).toFixed(1)}" r="${sh.length > 5 ? 2.4 : 3}"/>`);
    }
  });
  const label = `Modelo de camadas: ${e.name}, ${sh.map((n, i) => `${SHELLS[i]} ${n}`).join(', ')}`;
  return `<svg class="atom-svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(label)}">
    ${parts.join('')}
    <circle class="nucleus" cx="${c}" cy="${c}" r="${rN}"/>
    <text class="nuc-sym" x="${c}" y="${c + 1}" text-anchor="middle">${esc(e.symbol)}</text>
    <text class="nuc-z" x="${c}" y="${c + 13}" text-anchor="middle">${e.Z}+</text></svg>`;
}

/** Diagrama de Pauling: linhas n = 1…7, colunas s, p, d, f; diagonais mostram a ordem. */
export function paulingSVG(path) {
  const ROWS = { 1: 's', 2: 'sp', 3: 'spd', 4: 'spdf', 5: 'spdf', 6: 'spd', 7: 'sp' };
  const L = 'spdf';
  const W = 52;
  const H = 28;
  const pad = 10;
  const pos = (n, l) => ({ x: pad + L.indexOf(l) * W, y: pad + (n - 1) * H });
  const center = (n, l) => ({ x: pos(n, l).x + (W - 8) / 2, y: pos(n, l).y + (H - 6) / 2 });
  const filled = new Map(path.subs.map((s, i) => [s.sub, { ...s, order: i + 1 }]));
  // Diagonais (n + l constante), de cima-direita para baixo-esquerda, como no livro.
  const diags = [];
  for (let k = 1; k <= 8; k++) {
    const cells = [];
    for (let n = 1; n <= 7; n++) for (const l of ROWS[n]) if (n + L.indexOf(l) === k) cells.push([n, l]);
    if (!cells.length) continue;
    cells.sort((a, b) => L.indexOf(b[1]) - L.indexOf(a[1]));
    const a = center(...cells[0]);
    const b = center(...cells[cells.length - 1]);
    const used = cells.some(([n, l]) => filled.has(`${n}${l}`));
    diags.push(`<line class="diag${used ? ' used' : ''}" x1="${a.x + 20}" y1="${a.y - 13}" x2="${b.x - 16}" y2="${b.y + 11}" marker-end="url(#pa-arrow)"/>`);
  }
  const cells = [];
  for (let n = 1; n <= 7; n++) {
    for (const l of ROWS[n]) {
      const { x, y } = pos(n, l);
      const f = filled.get(`${n}${l}`);
      const cls = !f ? 'empty' : f.count === f.cap ? 'full' : 'part';
      cells.push(`<g class="cell ${cls}"><rect x="${x}" y="${y}" width="${W - 8}" height="${H - 6}" rx="5"/>
        <text x="${x + (W - 8) / 2}" y="${y + 15}" text-anchor="middle">${n}${l}${f ? `<tspan class="cnt" dy="-4">${f.count}</tspan>` : ''}</text>
        ${f ? `<text class="ord" x="${x + 3}" y="${y + 8}">${f.order}</text>` : ''}</g>`);
    }
  }
  const w = pad * 2 + 4 * W - 8;
  const h = pad * 2 + 7 * H - 6;
  return `<svg class="pauling-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(`Diagrama de Pauling: ${path.predicted}`)}">
    <defs><marker id="pa-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>
    ${diags.join('')}${cells.join('')}</svg>`;
}

/** Bloco do painel: modelo de camadas sempre visível e o diagrama de Pauling ao toque. */
export function atomDiagramHTML(e, data) {
  if (!e.shells?.length) return '';
  const path = paulingPath(e.symbol, data);
  const lastLabel = e.block === 's' || e.block === 'p' ? 'elétrons de valência (última camada)' : 'última camada';
  const legend = e.shells.map((n, i) => `${SHELLS[i]} ${n}`).join(' · ');
  const byShell = path.shells.map((s) => `${s.name} = ${s.subs.map((x) => `${x.sub}${sup(x.count)}`).join(' + ')} = ${s.total}`).join('; ');
  const exception = path.exception
    ? `<p class="small atom-warn">⚠️ ${esc(e.name)} foge do diagrama: a configuração ${path.measured ? 'medida' : 'prevista pelos cálculos'} é ${esc(configText(path.real))} (camadas ${path.realShells.join(', ')}), e é ela que o modelo de camadas acima mostra. O diagrama é uma regra prática: em alguns metais de transição, lantanídeos e actinídeos as subcamadas têm energias tão próximas que um elétron muda de lugar.</p>`
    : '';
  const predictedOnly = path.measured ? '' : `<p class="small muted">${esc(e.name)} é tão instável que sua configuração nunca foi medida: a do dataset é prevista por cálculos.</p>`;
  return `<section class="atom-diagram" aria-label="Como os elétrons se distribuem">
      <div class="atom-model">${shellModelSVG(e)}</div>
      <p class="small atom-legend">${esc(legend)} — <span class="atom-dot" aria-hidden="true"></span> ${lastLabel}</p>
      <p class="small muted">Modelo simplificado: os elétrons não giram em órbitas circulares; ficam em orbitais, regiões em volta do núcleo. Mas as camadas ajudam a contar.</p>
      <details class="pauling-box"><summary>Ver como os elétrons se distribuem (diagrama de Pauling)</summary>
        <p class="small">Siga as setas: cada subcamada enche até o máximo (s: 2, p: 6, d: 10, f: 14) antes da próxima. O número pequeno no canto é a ordem.</p>
        <div class="pauling-wrap">${paulingSVG(path)}</div>
        <p class="small"><strong>Ordem:</strong> ${esc(configText(path.predicted))}</p>
        <p class="small"><strong>Somando por camada:</strong> ${esc(byShell)}.</p>
        ${exception}${predictedOnly}
        <p class="small muted">Fonte: Bernoulli, Química, v. 1, Frente C, Módulo 04, p. 61–62; Kotz et al., Química Geral e Reações Químicas, p. 314.</p>
      </details>
    </section>`;
}
