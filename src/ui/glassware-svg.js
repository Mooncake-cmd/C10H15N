// Desenhos simples (traço) dos utensílios de laboratório, em SVG. viewBox 64×64; o traço usa
// currentColor e o líquido a cor --liquid, para funcionar no tema claro e no escuro.

const L = 'class="gw-liquid"';
const P = {
  bequer: `<path d="M16 10h32M18 10v42a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4V10"/><path d="M16 10l-3-3"/><path ${L} d="M19 34h26v18a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3z"/><path d="M40 20h6M40 28h6"/>`,
  erlenmeyer: `<path d="M26 8h12M28 8v16L12 52a4 4 0 0 0 4 5h32a4 4 0 0 0 4-5L36 24V8"/><path ${L} d="M18 42h28l5 10a3 3 0 0 1-3 4H16a3 3 0 0 1-3-4z"/>`,
  'tubo-ensaio': `<path d="M26 6h12M28 6v46a4 4 0 0 0 8 0V6"/><path ${L} d="M28.5 34h7v18a3.5 3.5 0 0 1-7 0z"/>`,
  proveta: `<path d="M22 6h20M24 6v48M40 6v48M16 58h32l-4-4H20z"/><path ${L} d="M24.5 26h15v28h-15z"/><path d="M34 14h6M36 20h4M34 26h6M36 32h4M34 38h6M36 44h4"/>`,
  'pipeta-volumetrica': `<path d="M30 2v20M34 2v20M30 22c-8 2-8 14 0 16M34 22c8 2 8 14 0 16M30 38v22l2 3 2-3V38"/><path d="M28 10h8"/><path ${L} d="M27 26c-2 3-2 6 0 9h10c2-3 2-6 0-9z"/>`,
  'pipeta-graduada': `<path d="M30 2v54l2 5 2-5V2"/><path d="M34 10h4M34 16h3M34 22h4M34 28h3M34 34h4M34 40h3M34 46h4"/><path ${L} d="M30.5 30h3v26l-1.5 3-1.5-3z"/>`,
  bureta: `<path d="M28 2v46M36 2v46M28 48l3 4h2l3-4"/><path d="M32 52v4M27 52h10"/><path d="M36 8h4M36 14h3M36 20h4M36 26h3M36 32h4M36 38h3"/><path ${L} d="M28.5 18h7v30h-7z"/>`,
  'balao-volumetrico': `<path d="M29 4h6M30 4v24M34 4v24M30 28c-14 4-14 28 2 28s16-24 2-28"/><path d="M28 14h8"/><path ${L} d="M22 40c0 10 4 15 10 15s10-5 10-15z"/>`,
  funil: `<path d="M12 12h40L36 34v24M28 34v24M12 12l16 22"/><path d="M18 14h28L34 28h-4z" ${L}/>`,
  'funil-separacao': `<path d="M30 4h4M30 6c-16 6-18 30 0 38v4M34 6c16 6 18 30 0 38v4"/><path d="M26 48h12M32 48v12"/><path ${L} d="M18 30c2 6 6 10 14 12 8-2 12-6 14-12z"/><path d="M19 22c4 2 22 2 26 0" stroke-dasharray="3 2"/>`,
  buchner: `<path d="M18 6h28v10L36 22v8h-8v-8L18 16z"/><path d="M18 14h28"/><path d="M24 30h16v4l6 22H18l6-22z"/><path d="M40 38h10"/><path ${L} d="M20 50h24l1.5 5h-27z"/>`,
  'balao-destilacao': `<path d="M29 4h6M30 4v20M34 4v20M34 14l18 8M30 24c-12 4-12 30 2 30s14-26 2-30"/><path ${L} d="M21 38c0 9 4 15 11 15s11-6 11-15z"/>`,
  condensador: `<path d="M8 14l48 36"/><path d="M14 12l40 30M10 20l40 30"/><path d="M18 14l-2-6M46 44l2 6"/><path d="M14 12l-4 8M54 42l-4 8"/>`,
  'bico-bunsen': `<path d="M28 56V24h8v32M18 58h28l-2-4H20z"/><path d="M36 46h8"/><path class="gw-flame" d="M32 4c6 6 6 12 0 18-6-6-6-12 0-18z"/>`,
  capsula: `<path d="M8 28h48c-2 14-12 20-24 20S10 42 8 28z"/><path d="M8 28l-3-2"/><path ${L} d="M12 32h40c-3 9-10 13-20 13s-17-4-20-13z"/>`,
  cadinho: `<path d="M20 18h24l-4 34H24z"/><path d="M18 18h28"/><path ${L} d="M22 40h20l-1.5 12h-17z"/>`,
  'vidro-relogio': `<path d="M6 30c8 10 44 10 52 0"/><path d="M6 30c8 6 44 6 52 0"/>`,
  bastao: `<path d="M14 54L50 10"/><circle cx="14" cy="54" r="2"/><circle cx="50" cy="10" r="2"/>`,
  pisseta: `<path d="M22 22h20v32a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4z"/><path d="M28 22v-6h8v6M32 16v-6l14-4"/><path ${L} d="M23 36h18v18a3 3 0 0 1-3 3H26a3 3 0 0 1-3-3z"/>`,
  suporte: `<path d="M10 58h36v-4H10zM20 54V4"/><path d="M20 22h18M38 18v8"/><path d="M20 40h12"/>`,
};

/** SVG de um utensílio (ou um frasco genérico). */
export function glasswareSVG(id, { size = 56, label = '' } = {}) {
  const body = P[id] ?? P.bequer;
  return `<svg class="gw-svg" viewBox="0 0 64 64" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>${body}</svg>`;
}

export const GLASSWARE_IDS = Object.keys(P);
