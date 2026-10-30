// Desenho SVG das estruturas (bolinhas e traços). As cores seguem a convenção CPK/Jmol usada
// em livros e softwares de química (H branco, C cinza, N azul, O vermelho, Cl verde, S amarelo).

import { bbox } from '../core/structure.js';

export const ATOM_COLOR = {
  H: '#ffffff', He: '#d9ffff', Li: '#cc80ff', Be: '#c2ff00', C: '#4a4a4a', N: '#3050f8', O: '#ff2a2a',
  Ne: '#b3e3f5', Na: '#ab5cf2', Mg: '#8aff00', Al: '#bfa6a6', S: '#e8c400', Cl: '#1fc01f', Ar: '#80d1e3',
  K: '#8f40d4', Ca: '#3dff00', Fe: '#e06633', Cu: '#c88033', Zn: '#7d80b0', Rb: '#702eb0', Sr: '#00e000',
  Ag: '#c0c0c0', Cs: '#57178f', Ba: '#00c900', Au: '#ffd123',
};

/** Raio de desenho: H menor; íons positivos encolhem e negativos crescem (como os raios iônicos). */
export function atomRadius(el, charge = 0) {
  const base = el === 'H' ? 0.27 : 0.4;
  return charge > 0 ? base * 0.78 : charge < 0 ? base * 1.12 : base;
}

/** Cor do texto que contrasta com o fundo do átomo. */
export function labelColor(fill) {
  const n = parseInt(fill.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1c2430' : '#ffffff';
}

export const chargeText = (q) => (q === 0 ? '' : `${Math.abs(q) > 1 ? Math.abs(q) : ''}${q > 0 ? '+' : '−'}`);

/** Linhas de uma ligação (1, 2 ou 3 traços paralelos), como atributos de <line>. */
export function bondLines(a, b, order) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const offsets = order === 1 ? [0] : order === 2 ? [-0.09, 0.09] : [-0.14, 0, 0.14];
  return offsets.map((o) => ({ x1: a.x + nx * o, y1: a.y + ny * o, x2: b.x + nx * o, y2: b.y + ny * o }));
}

const f = (n) => Math.round(n * 1000) / 1000;

function atomSVG(a, { labels }) {
  const fill = ATOM_COLOR[a.el] ?? '#d0d0d0';
  const r = atomRadius(a.el, a.charge);
  const q = chargeText(a.charge);
  const fontSize = a.el.length > 1 ? 0.3 : 0.36;
  return `<g class="atom" transform="translate(${f(a.x)} ${f(a.y)})">` +
    `<circle r="${f(r)}" fill="${fill}"/>` +
    (labels ? `<text class="atom-label" font-size="${fontSize}" fill="${labelColor(fill)}" dy="0.12">${a.el}</text>` : '') +
    (q ? `<text class="atom-charge" x="${f(r * 0.8)}" y="${f(-r * 0.75)}" font-size="0.3">${q}</text>` : '') +
    '</g>';
}

/**
 * SVG de uma estrutura. O tamanho real vem do CSS (altura); o viewBox se ajusta ao desenho.
 * @param {{atoms, bonds}} s
 * @param {{ labels?: boolean, title?: string, className?: string, scale?: number }} opts
 *   scale: pixels por comprimento de ligação, igual para todas as substâncias (tamanhos comparáveis);
 *   o CSS só reduz quando o desenho não cabe (max-width).
 */
export function structureSVG(s, { labels = true, title = '', className = 'mol', scale = 20 } = {}) {
  const b = bbox(s.atoms, 0.55);
  const w = b.maxX - b.minX;
  const h = b.maxY - b.minY;
  const bonds = s.bonds
    .flatMap((bd) => bondLines(s.atoms[bd.a], s.atoms[bd.b], bd.order))
    .map((l) => `<line x1="${f(l.x1)}" y1="${f(l.y1)}" x2="${f(l.x2)}" y2="${f(l.y2)}"/>`)
    .join('');
  const atoms = s.atoms.map((a) => atomSVG(a, { labels })).join('');
  const role = title ? `role="img" aria-label="${title.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return `<svg class="${className}" viewBox="${f(b.minX)} ${f(b.minY)} ${f(w)} ${f(h)}" width="${Math.round(w * scale)}" height="${Math.round(h * scale)}" ${role} focusable="false">` +
    `<g class="bonds">${bonds}</g>${atoms}</svg>`;
}
