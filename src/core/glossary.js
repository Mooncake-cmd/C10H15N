// Glossário: acha os termos de química num texto. Puro (sem DOM) e testável.
//
// Regras:
//   - a forma mais longa vence ("ácido forte" antes de "ácido", "íon espectador" antes de "íon");
//   - só palavras inteiras (com acentos: "sal" não casa dentro de "salgado");
//   - sem diferenciar maiúsculas;
//   - `exclude`: expressões em que a palavra não tem o sentido químico ("na base" = base de dados).

const LETTER = '\\p{L}\\p{N}';
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Formas de um termo que aparecem nos textos: o nome (se não tiver parênteses) e os apelidos. */
export const formsOf = (t) => [...(t.term.includes('(') ? [] : [t.term]), ...(t.aliases ?? [])].map((f) => f.toLowerCase());

export function createGlossary(raw) {
  const terms = raw?.terms ?? [];
  const byId = new Map(terms.map((t) => [t.id, t]));
  const formToId = new Map();
  for (const t of terms) for (const f of formsOf(t)) if (!formToId.has(f)) formToId.set(f, t.id);
  const forms = [...formToId.keys()].sort((a, b) => b.length - a.length);
  const re = forms.length ? new RegExp(`(?<![${LETTER}])(?:${forms.map(escapeRe).join('|')})(?![${LETTER}])`, 'giu') : null;
  const excludes = new Map(terms.filter((t) => t.exclude?.length).map((t) => [t.id, t.exclude.map((e) => e.toLowerCase())]));

  /** O trecho [start, end) está dentro de uma expressão excluída para esse termo? */
  function excluded(id, lower, start, end) {
    for (const ex of excludes.get(id) ?? []) {
      let i = lower.indexOf(ex, Math.max(0, start - ex.length));
      while (i !== -1 && i <= start) {
        if (i + ex.length >= end) return true;
        i = lower.indexOf(ex, i + 1);
      }
    }
    return false;
  }

  /**
   * Ocorrências de termos no texto, em ordem e sem sobreposição.
   * @returns {{ start: number, end: number, id: string, text: string }[]}
   */
  function find(text) {
    if (!re || !text) return [];
    const lower = text.toLowerCase();
    const out = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const id = formToId.get(m[0].toLowerCase());
      const start = m.index;
      const end = start + m[0].length;
      if (id && !excluded(id, lower, start, end)) out.push({ start, end, id, text: m[0] });
    }
    return out;
  }

  return { terms, byId, find };
}
