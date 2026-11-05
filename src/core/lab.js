// Laboratório: utensílios, separação de misturas e teste de chama. Puro (sem DOM).
// Os dados ficam em data/lab.json; aqui só a lógica de "este método separa esta mistura?" e
// "que cor esta substância dá na chama?".

export function buildLab(raw) {
  if (!raw) return null;
  const byId = (list) => new Map(list.map((x) => [x.id, x]));
  return {
    ...raw,
    glasswareById: byId(raw.glassware),
    methodsById: byId(raw.methods),
    mixturesById: byId(raw.mixtures),
  };
}

/** Fontes de um item (aceita um objeto ou uma lista). */
export const sourcesOf = (x) => [].concat(x?.source ?? []);

/**
 * Tenta separar uma mistura com um método.
 * @returns {{ ok: boolean, text: string, obtains?: string, next?: string }}
 */
export function separate(mixtureId, methodId, lab) {
  const mix = lab.mixturesById.get(mixtureId);
  const method = lab.methodsById.get(methodId);
  if (!mix || !method) throw new Error(`mistura ${mixtureId} ou método ${methodId} desconhecido`);
  const ok = mix.ok[methodId];
  if (ok) return { ok: true, ...ok };
  const why = mix.fails?.[methodId] ?? method.failWhy[mix.type] ?? (mix.type === 'solidos-insoluveis' ? method.failWhy.solidos : null) ?? method.failWhy.default;
  return { ok: false, text: why };
}

/** Elemento que colore a chama: o do cátion (H+ nos ácidos) ou o próprio elemento. */
export function flameElement(sub, data) {
  if (!sub) return null;
  if (sub.elementOf) return sub.elementOf;
  const ionic = sub.ions ?? (data.structures?.substances?.[sub.id]?.kind === 'ionic' ? data.structures.substances[sub.id] : null);
  const m = ionic?.cation.formula.match(/^([A-Z][a-z]?)/);
  return m ? m[1] : null;
}

/**
 * Teste de chama de uma substância: a cor (ou "não muda") só quando o jogo tem fonte para ela.
 * @returns {{ element, color: string|null, css: string|null, text, source } | null}
 */
export function flameTest(substanceId, data) {
  const el = flameElement(data.substancesById.get(substanceId), data);
  const entry = el ? data.lab.flame[el] : null;
  return entry ? { element: el, ...entry } : null;
}
