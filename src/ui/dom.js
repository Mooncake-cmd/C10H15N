export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Template literal que escapa interpolações, exceto as marcadas com raw(). */
export function html(strings, ...values) {
  return strings.reduce((out, s, i) => {
    if (i === 0) return s;
    const v = values[i - 1];
    const str = Array.isArray(v) ? v.map((x) => (x?.__raw ? x.value : esc(x))).join('') : v?.__raw ? v.value : esc(v);
    return out + str + s;
  }, '');
}
export const raw = (value) => ({ __raw: true, value });

export const TYPE_LABEL = {
  sintese: 'Síntese',
  decomposicao: 'Decomposição',
  simples_troca: 'Simples troca',
  dupla_troca: 'Dupla troca',
  combustao: 'Combustão',
  acido_base: 'Ácido-base',
};

export const FAMILY_LABEL = {
  'metal-alcalino': 'Metais alcalinos',
  'metal-alcalino-terroso': 'Metais alcalino-terrosos',
  'metal-de-transicao': 'Metais de transição',
  'outro-metal': 'Outros metais',
  semimetal: 'Semimetais',
  ametal: 'Ametais',
  'gas-nobre': 'Gases nobres',
  lantanideo: 'Lantanídeos',
  actinideo: 'Actinídeos',
  desconhecida: 'Propriedades desconhecidas',
};

export const PHASE_LABEL = { s: 'sólido', l: 'líquido', g: 'gás' };

/** Categoria principal de uma substância, para a cor do chip. */
export function mainCategory(sub) {
  const order = ['gas-nobre', 'acido', 'base', 'sal', 'oxido', 'organico', 'peroxido', 'metal', 'ametal'];
  return order.find((c) => sub.categories.includes(c)) ?? 'outro';
}
