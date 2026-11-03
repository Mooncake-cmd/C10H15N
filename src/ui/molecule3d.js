// Visualizador 3D das moléculas (Fase 3D): desenho próprio em <canvas>, sem bibliotecas.
// Esferas e bastões em projeção ortográfica, desenhados de trás para a frente; arrastar (ou as
// setas do teclado) gira a molécula. Gira sozinha devagar, exceto com "reduzir movimento".

import { ATOM_COLOR, labelColor } from './structure-svg.js';
import { vec as v } from '../core/vsepr.js';

const LP_COLOR = 'rgba(155, 110, 230, 0.35)';

/** Clareia/escurece uma cor #rrggbb. */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (x) => Math.max(0, Math.min(255, Math.round(k > 0 ? x + (255 - x) * k : x * (1 + k))));
  return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

/** Matriz de rotação (yaw em torno de y, depois pitch em torno de x). */
function rotation(yaw, pitch) {
  const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  return (p) => {
    const x = p[0] * cy + p[2] * sy;
    const z = -p[0] * sy + p[2] * cy;
    return [x, p[1] * cp - z * sp, p[1] * sp + z * cp];
  };
}

/**
 * @param canvas elemento <canvas>
 * @param model { atoms: [{ el, pos, charge }], bonds: [{ a, b, order }], lonePairs: [{ atom, dir }] }
 */
export function mountMolecule3D(canvas, model, { showLonePairs = true, label = '' } = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { destroy() {}, setLonePairs() {} };
  let yaw = 0.6;
  let pitch = -0.35;
  let lp = showLonePairs;
  let dragging = null;
  let auto = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  const maxR = Math.max(60, ...model.atoms.map((a) => v.len(a.pos))) + 70;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  canvas.tabIndex = 0;

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 260;
    const h = canvas.clientHeight || 220;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const scale = (0.46 * Math.min(w, h)) / maxR;
    const R = rotation(yaw, pitch);
    const P = (p) => {
      const q = R(p);
      return { x: w / 2 + q[0] * scale, y: h / 2 + q[1] * scale, z: q[2] };
    };
    const pts = model.atoms.map((a) => P(a.pos));
    const rad = (el) => (el === 'H' ? 24 : 36) * scale;
    const items = [];
    for (const b of model.bonds) items.push({ z: (pts[b.a].z + pts[b.b].z) / 2 - 1, draw: () => drawBond(pts[b.a], pts[b.b], b.order, scale) });
    if (lp) {
      for (const l of model.lonePairs) {
        const c = P(v.add(model.atoms[l.atom].pos, v.mul(l.dir, 72)));
        const base = pts[l.atom];
        items.push({ z: c.z, draw: () => drawLonePair(base, c, scale) });
      }
    }
    model.atoms.forEach((a, i) => items.push({ z: pts[i].z, draw: () => drawAtom(pts[i], a, rad(a.el)) }));
    items.sort((p, q) => q.z - p.z); // z maior = mais longe (para trás)
    for (const it of items) it.draw();
  }

  function drawBond(a, b, order, scale) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const [nx, ny] = [-dy / len, dx / len];
    const gap = 7 * scale;
    const offsets = order === 3 ? [-gap, 0, gap] : order === 2 ? [-gap / 2, gap / 2] : [0];
    ctx.lineCap = 'round';
    for (const o of offsets) {
      ctx.strokeStyle = '#7a8591';
      ctx.lineWidth = Math.max(2, (order > 1 ? 5 : 8) * scale);
      ctx.beginPath();
      ctx.moveTo(a.x + nx * o, a.y + ny * o);
      ctx.lineTo(b.x + nx * o, b.y + ny * o);
      ctx.stroke();
    }
  }

  function drawAtom(p, a, r) {
    const color = ATOM_COLOR[a.el] ?? '#ff1493';
    const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    g.addColorStop(0, shade(color, 0.6));
    g.addColorStop(0.55, color);
    g.addColorStop(1, shade(color, -0.45));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = labelColor(color);
    ctx.font = `600 ${Math.max(10, r * 0.8)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(a.el, p.x, p.y + 1);
    if (a.charge) {
      ctx.font = `700 ${Math.max(9, r * 0.6)}px system-ui, sans-serif`;
      ctx.fillStyle = a.charge > 0 ? '#1d4ed8' : '#b91c1c';
      ctx.fillText(a.charge > 0 ? '+' : '−', p.x + r * 0.85, p.y - r * 0.85);
    }
  }

  function drawLonePair(base, c, scale) {
    // "Nuvem" do par isolado com os dois elétrons.
    const ang = Math.atan2(c.y - base.y, c.x - base.x);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(ang);
    ctx.fillStyle = LP_COLOR;
    ctx.beginPath();
    ctx.ellipse(0, 0, 26 * scale, 17 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b3fc7';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(0, s * 6 * scale, Math.max(1.5, 3.2 * scale), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function loop() {
    if (!canvas.isConnected) return;
    if (auto && !dragging) yaw += 0.008;
    draw();
    raf = requestAnimationFrame(loop);
  }

  canvas.addEventListener('pointerdown', (ev) => {
    dragging = { x: ev.clientX, y: ev.clientY };
    auto = false;
    canvas.setPointerCapture?.(ev.pointerId);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!dragging) return;
    yaw += (ev.clientX - dragging.x) * 0.012;
    pitch = Math.max(-1.5, Math.min(1.5, pitch + (ev.clientY - dragging.y) * 0.012));
    dragging = { x: ev.clientX, y: ev.clientY };
    draw();
  });
  const stop = () => (dragging = null);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('keydown', (ev) => {
    const step = 0.15;
    const k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
    if (!k) return;
    ev.preventDefault();
    auto = false;
    yaw += k[0];
    pitch = Math.max(-1.5, Math.min(1.5, pitch + k[1]));
    draw();
  });

  draw();
  raf = requestAnimationFrame(loop);
  return {
    setLonePairs(on) {
      lp = on;
      draw();
    },
    destroy() {
      cancelAnimationFrame(raf);
    },
  };
}

/** Modelo para o visualizador a partir da análise VSEPR. */
export function modelFrom(analysis) {
  return {
    atoms: analysis.lewis.atoms.map((a, i) => ({ el: a.el, charge: a.charge, pos: analysis.geo.pos[i] })),
    bonds: analysis.lewis.bonds,
    lonePairs: analysis.geo.lonePairs,
  };
}
