// Leitura e formatação de fórmulas químicas.
//
// Sintaxe aceita:
//   - Elementos:            H2O, NaCl, CH3COOH
//   - Parênteses/colchetes: Ca(OH)2, [Cu(NH3)4]SO4
//   - Hidratos (· ou *):    CuSO4·5H2O
//   - Carga no final:       Na+, Cl-, NH4+, SO4^2-, Fe^3+
//     (carga com mais de 1 unidade exige "^" para não confundir com índice: Fe^3+ ≠ Fe3+)
//
// Módulo puro (sem DOM), usado tanto pelo jogo quanto pelos testes.

const CHARGE_RE = /(?:\^(\d+)?([+-])|([+-]))$/;

export class FormulaError extends Error {}

/**
 * @param {string} formula
 * @returns {{atoms: Record<string, number>, charge: number}}
 */
export function parseFormula(formula) {
  if (typeof formula !== 'string' || !formula.trim()) {
    throw new FormulaError(`Fórmula vazia ou inválida: ${formula}`);
  }
  let body = formula.trim();
  let charge = 0;
  const m = body.match(CHARGE_RE);
  if (m) {
    const sign = (m[2] || m[3]) === '+' ? 1 : -1;
    const magnitude = m[1] ? parseInt(m[1], 10) : 1;
    charge = sign * magnitude;
    body = body.slice(0, m.index);
  }
  if (!body) throw new FormulaError(`Fórmula sem átomos: ${formula}`);

  const atoms = {};
  for (const part of body.split(/[·*]/)) {
    const pm = part.match(/^(\d+)?(.+)$/);
    if (!pm) throw new FormulaError(`Parte inválida "${part}" em ${formula}`);
    const multiplier = pm[1] ? parseInt(pm[1], 10) : 1;
    const { counts, end } = parseGroup(pm[2], 0, formula);
    if (end !== pm[2].length) throw new FormulaError(`Caractere inesperado em ${formula}`);
    for (const [el, n] of Object.entries(counts)) {
      atoms[el] = (atoms[el] || 0) + n * multiplier;
    }
  }
  return { atoms, charge };
}

function parseGroup(str, start, original, closer = null) {
  const counts = {};
  let i = start;
  while (i < str.length) {
    const ch = str[i];
    if (ch === ')' || ch === ']') {
      if (ch !== closer) throw new FormulaError(`Parêntese desbalanceado em ${original}`);
      return { counts, end: i };
    }
    let inner;
    if (ch === '(' || ch === '[') {
      const res = parseGroup(str, i + 1, original, ch === '(' ? ')' : ']');
      inner = res.counts;
      i = res.end + 1;
    } else if (/[A-Z]/.test(ch)) {
      let sym = ch;
      i++;
      while (i < str.length && /[a-z]/.test(str[i])) sym += str[i++];
      inner = { [sym]: 1 };
    } else {
      throw new FormulaError(`Caractere inesperado "${ch}" em ${original}`);
    }
    let num = '';
    while (i < str.length && /\d/.test(str[i])) num += str[i++];
    const n = num ? parseInt(num, 10) : 1;
    for (const [el, c] of Object.entries(inner)) counts[el] = (counts[el] || 0) + c * n;
  }
  if (closer) throw new FormulaError(`Parêntese não fechado em ${original}`);
  return { counts, end: i };
}

/** Massa molar (g/mol) a partir de um mapa símbolo → massa atômica. */
export function molarMass(formula, atomicMasses) {
  const { atoms } = parseFormula(formula);
  let total = 0;
  for (const [el, n] of Object.entries(atoms)) {
    const m = atomicMasses[el];
    if (typeof m !== 'number') throw new FormulaError(`Massa atômica desconhecida para ${el}`);
    total += m * n;
  }
  return total;
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Fórmula em HTML com índices (<sub>) e cargas (<sup>). */
export function formatFormulaHTML(formula) {
  let body = formula;
  let chargeHtml = '';
  const m = body.match(CHARGE_RE);
  if (m) {
    const sign = (m[2] || m[3]) === '+' ? '+' : '−';
    chargeHtml = `<sup>${m[1] && m[1] !== '1' ? m[1] : ''}${sign}</sup>`;
    body = body.slice(0, m.index);
  }
  const html = body
    .split(/[·*]/)
    .map((part) => {
      const pm = part.match(/^(\d+)?(.*)$/);
      const coef = pm[1] || '';
      return coef + escapeHtml(pm[2]).replace(/(\d+)/g, '<sub>$1</sub>');
    })
    .join('·');
  return html + chargeHtml;
}

const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
/** Versão em texto puro com dígitos subscritos (útil para títulos/alt). */
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

/** Texto Unicode: índices subscritos e carga sobrescrita (Ba^2+ → Ba²⁺, SO4^2- → SO₄²⁻). */
export function formatFormulaText(formula) {
  let body = formula;
  let charge = '';
  const m = body.match(CHARGE_RE);
  if (m) {
    const n = m[1] && m[1] !== '1' ? [...m[1]].map((x) => SUP[x]).join('') : '';
    charge = n + ((m[2] || m[3]) === '+' ? '⁺' : '⁻');
    body = body.slice(0, m.index);
  }
  return body.replace(/([A-Za-z)\]])(\d+)/g, (_, a, d) => a + [...d].map((x) => SUB[x]).join('')) + charge;
}
