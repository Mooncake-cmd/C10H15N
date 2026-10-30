// "Palco" do painel de resultado: anima o rearranjo dos átomos numa reação (as ligações dos
// reagentes se desfazem, os MESMOS átomos se deslocam e formam os produtos) e, quando não há
// reação, mostra as substâncias se aproximando e se afastando sem mudar nada.
//
// Toda a geometria vem de src/core/structure.js (testada); aqui só há desenho e tempo.
// Com "reduzir movimento" ativado no sistema, nada se desloca: o palco troca de "antes" para "depois".

import { layoutSide, pairAtoms, bbox, formulaUnit } from '../core/structure.js';
import { ATOM_COLOR, atomRadius, labelColor, chargeText, bondLines } from './structure-svg.js';
import { esc } from './dom.js';

const SCALE = 34; // px por comprimento de ligação
const T = { hold: 700, unbond: 1000, move: 2200, bond: 2600 };
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const f = (n) => Math.round(n * 1000) / 1000;
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const clamp01 = (u) => Math.min(1, Math.max(0, u));

function bondsSVG(atoms, bonds, cls) {
  const lines = bonds.flatMap((bd) => bondLines(atoms[bd.a], atoms[bd.b], bd.order));
  return `<g class="bonds ${cls}">${lines.map((l) => `<line x1="${f(l.x1)}" y1="${f(l.y1)}" x2="${f(l.x2)}" y2="${f(l.y2)}"/>`).join('')}</g>`;
}

function plusSVG(xs, cls) {
  return `<g class="stage-plus ${cls}">${xs.map((x) => `<text x="${f(x)}" y="0.15" font-size="0.6">+</text>`).join('')}</g>`;
}

/** Contagem de átomos por elemento, em texto ("4 H · 2 O"), na ordem de `order`. */
function tally(atoms, order) {
  const c = new Map(order.map((el) => [el, 0]));
  atoms.forEach((a) => c.set(a.el, (c.get(a.el) ?? 0) + 1));
  return [...c].map(([el, n]) => `${n} ${el}`).join(' · ');
}

function svgShell(box, inner, label) {
  const w = box.maxX - box.minX;
  const h = box.maxY - box.minY;
  return `<svg class="mol stage-svg" viewBox="${f(box.minX)} ${f(box.minY)} ${f(w)} ${f(h)}" width="${Math.round(w * SCALE)}" height="${Math.round(h * SCALE)}" role="img" aria-label="${esc(label)}">${inner}</svg>`;
}

const EFFECTS = {
  exotermica: () => '<div class="fx-glow"></div>',
  combustao: () => `<div class="fx-flames">${'<span></span>'.repeat(5)}</div>`,
  efervescencia: () => `<div class="fx-bubbles">${'<span></span>'.repeat(10)}</div>`,
  precipitacao: () => `<div class="fx-precip">${'<span></span>'.repeat(14)}</div>`,
};

/**
 * Anima uma reação curada dentro de `el`.
 * @returns {() => void} função que para a animação
 */
export function mountReactionStage(el, data, reaction) {
  const L = layoutSide(reaction.reactants, data);
  const R = layoutSide(reaction.products, data);
  const match = pairAtoms(L.atoms, R.atoms);
  const box = bbox([...L.atoms, ...R.atoms], 0.65);
  const order = [...new Set(L.atoms.map((a) => a.el))];

  const atomsSVG = L.atoms
    .map((a, i) => {
      const b = R.atoms[match[i]];
      const fill = ATOM_COLOR[a.el] ?? '#d0d0d0';
      const r0 = atomRadius(a.el, a.charge);
      const fs = a.el.length > 1 ? 0.3 : 0.36;
      return `<g class="atom" data-i="${i}" transform="translate(${f(a.x)} ${f(a.y)})"><circle r="${f(r0)}" fill="${fill}"/>` +
        `<text class="atom-label" font-size="${fs}" fill="${labelColor(fill)}" dy="0.12">${a.el}</text>` +
        `<text class="atom-charge q-from" x="${f(r0 * 0.8)}" y="${f(-r0 * 0.75)}" font-size="0.3">${chargeText(a.charge)}</text>` +
        `<text class="atom-charge q-to" x="${f(atomRadius(b.el, b.charge) * 0.8)}" y="${f(-atomRadius(b.el, b.charge) * 0.75)}" font-size="0.3" opacity="0">${chargeText(b.charge)}</text></g>`;
    })
    .join('');

  const fx = [...new Set([...reaction.tags, ...reaction.types])].filter((k) => EFFECTS[k]).map((k) => EFFECTS[k]()).join('');
  el.innerHTML = `
    <div class="stage-box">
      <div class="fx">${fx}</div>
      ${svgShell(box, bondsSVG(L.atoms, L.bonds, 'b-from') + bondsSVG(R.atoms, R.bonds, 'b-to') + plusSVG(L.plus, 'p-from') + plusSVG(R.plus, 'p-to') + atomsSVG, `Animação: os átomos de ${reaction.name.toLowerCase()} se rearranjam`)}
    </div>
    <div class="stage-foot">
      <span class="stage-caption" aria-hidden="true"></span>
      <button type="button" class="btn btn-ghost stage-replay">↻ Ver de novo</button>
    </div>
    <p class="stage-tally small">Átomos: <strong>${tally(L.atoms, order)}</strong> antes e <strong>${tally(R.atoms, order)}</strong> depois. Nenhum átomo some ou aparece: as ligações é que mudam.</p>`;

  const nodes = [...el.querySelectorAll('.atom')].map((g) => ({
    g,
    circle: g.querySelector('circle'),
    qFrom: g.querySelector('.q-from'),
    qTo: g.querySelector('.q-to'),
  }));
  const $ = (s) => el.querySelector(s);
  const caption = $('.stage-caption');

  function frame(t) {
    const unbond = clamp01((t - T.hold) / (T.unbond - T.hold));
    const move = ease(clamp01((t - T.unbond) / (T.move - T.unbond)));
    const bond = clamp01((t - T.move) / (T.bond - T.move));
    $('.b-from').style.opacity = String(1 - unbond);
    $('.p-from').style.opacity = String(1 - unbond);
    $('.b-to').style.opacity = String(bond);
    $('.p-to').style.opacity = String(bond);
    nodes.forEach(({ g, circle, qFrom, qTo }, i) => {
      const a = L.atoms[i];
      const b = R.atoms[match[i]];
      g.setAttribute('transform', `translate(${f(lerp(a.x, b.x, move))} ${f(lerp(a.y, b.y, move))})`);
      circle.setAttribute('r', f(lerp(atomRadius(a.el, a.charge), atomRadius(b.el, b.charge), move)));
      qFrom.setAttribute('opacity', String(1 - unbond));
      qTo.setAttribute('opacity', String(bond));
    });
    caption.textContent = t < T.hold ? 'Reagentes' : t < T.move ? 'As ligações se desfazem e os átomos se rearranjam…' : 'Produtos';
    el.classList.toggle('fx-on', t >= T.move);
  }

  let raf = 0;
  let timer = 0;
  function play() {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    el.classList.remove('fx-on');
    frame(0);
    if (reducedMotion()) {
      timer = setTimeout(() => frame(T.bond), 1200);
      return;
    }
    const start = performance.now();
    const step = (now) => {
      if (!el.isConnected) return;
      const t = now - start;
      frame(t);
      if (t < T.bond) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  $('.stage-replay').addEventListener('click', play);
  play();
  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
  };
}

/**
 * Sem reação (ou faltando energia): as substâncias se aproximam e voltam, sem mudar nada.
 * @param {'no-reaction' | 'needs-condition'} kind
 */
export function mountBounceStage(el, data, substanceIds, kind) {
  const units = substanceIds.map((id) => formulaUnit(data.substancesById.get(id), data)).filter(Boolean);
  if (units.length < 2) {
    el.innerHTML = '';
    return () => {};
  }
  const side = layoutSide(substanceIds.map((id) => ({ id, coef: 1 })), data);
  const box = bbox(side.atoms, 0.65);
  const groups = substanceIds.map((_, s) => {
    const idx = side.atoms.map((a, i) => (a.species === s ? i : -1)).filter((i) => i >= 0);
    const xs = idx.map((i) => side.atoms[i].x);
    return { idx, cx: (Math.min(...xs) + Math.max(...xs)) / 2 };
  });
  const inner = groups
    .map(({ idx }, s) => {
      const local = new Map(idx.map((i, k) => [i, k]));
      const atoms = idx.map((i) => side.atoms[i]);
      const bonds = side.bonds.filter((b) => local.has(b.a)).map((b) => ({ ...b, a: local.get(b.a), b: local.get(b.b) }));
      const atomG = atoms
        .map((a) => {
          const fill = ATOM_COLOR[a.el] ?? '#d0d0d0';
          const r = atomRadius(a.el, a.charge);
          return `<g transform="translate(${f(a.x)} ${f(a.y)})"><circle r="${f(r)}" fill="${fill}"/><text class="atom-label" font-size="${a.el.length > 1 ? 0.3 : 0.36}" fill="${labelColor(fill)}" dy="0.12">${a.el}</text>` +
            (a.charge ? `<text class="atom-charge" x="${f(r * 0.8)}" y="${f(-r * 0.75)}" font-size="0.3">${chargeText(a.charge)}</text>` : '') + '</g>';
        })
        .join('');
      return `<g class="species" data-s="${s}">${bondsSVG(atoms, bonds, '')}${atomG}</g>`;
    })
    .join('');
  const msg = kind === 'needs-condition' ? 'Elas se encontram, mas falta energia para começar' : 'Elas se encontram… e nada muda';
  el.innerHTML = `
    <div class="stage-box">${svgShell(box, plusSVG(side.plus, '') + inner, `Animação: ${msg.toLowerCase()}`)}</div>
    <div class="stage-foot"><span class="stage-caption">${esc(msg)}</span><button type="button" class="btn btn-ghost stage-replay">↻ Ver de novo</button></div>`;

  const gs = [...el.querySelectorAll('.species')];
  const center = (box.minX + box.maxX) / 2;
  let raf = 0;
  function play() {
    cancelAnimationFrame(raf);
    if (reducedMotion()) return;
    const start = performance.now();
    const DUR = 1800;
    const step = (now) => {
      if (!el.isConnected) return;
      const t = Math.min(1, (now - start) / DUR);
      const bump = Math.sin(Math.PI * Math.min(1, t * 2)) ** 2 * (t < 0.5 ? 1 : 0) + Math.sin(Math.PI * Math.max(0, t * 2 - 1)) ** 2 * 0.45;
      gs.forEach((g, s) => {
        const dir = Math.sign(center - groups[s].cx);
        g.setAttribute('transform', `translate(${f(dir * 0.45 * bump)} 0)`);
      });
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  el.querySelector('.stage-replay').addEventListener('click', play);
  play();
  return () => cancelAnimationFrame(raf);
}
