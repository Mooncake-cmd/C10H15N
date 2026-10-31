// Índices em memória sobre os JSON de data/. Puro: recebe os objetos já carregados
// (o navegador usa fetch em src/loader.js; os testes usam fs).

import { deriveSubstances, buildIonCatalog } from './ions.js';
import { createGlossary } from './glossary.js';

export function buildGameData(raw) {
  const elements = raw.elements.elements;
  const baseStructures = raw.structures ?? { ions: {}, substances: {} };
  // Fase 2: compostos iônicos que o motor de regras pode formar e que ainda não são curados.
  const derived = raw.ions ? deriveSubstances(raw.substances.substances, baseStructures, raw.ions) : { substances: [], structures: {} };
  const substances = [...raw.substances.substances, ...derived.substances];
  const structures = { ...baseStructures, substances: { ...baseStructures.substances, ...derived.structures } };
  const items = raw.items.items;
  const reactions = raw.reactions.reactions;
  const nonReactions = raw.nonReactions.nonReactions;

  const elementsBySymbol = new Map(elements.map((e) => [e.symbol, e]));
  const substancesById = new Map(substances.map((s) => [s.id, s]));
  const elementalBySymbol = new Map(substances.filter((s) => s.elementOf).map((s) => [s.elementOf, s]));
  const atomicMasses = Object.fromEntries(elements.map((e) => [e.symbol, e.atomicMass]));

  return {
    elements,
    substances,
    items,
    reactions,
    nonReactions,
    progression: raw.progression,
    structures,
    ions: raw.ions ? buildIonCatalog(raw.ions) : null,
    rules: raw.rules ?? null,
    glossary: createGlossary(raw.glossary),
    thermo: raw.thermo?.species ?? {},
    // Curiosidades dos elementos (leitura complementar, livro da DK), por símbolo.
    elementFacts: raw.elementFacts?.elements ?? {},
    elementFactsMeta: raw.elementFacts?._meta ?? null,
    sources: raw.sources.sources,
    complementarySources: raw.sources._meta.complementaryOnly ?? [],
    reactivitySeries: raw.reactivitySeries.series,
    reactivitySeriesSource: raw.reactivitySeries._meta.source,
    elementsBySymbol,
    substancesById,
    elementalBySymbol,
    itemsById: new Map(items.map((i) => [i.id, i])),
    reactionsById: new Map(reactions.map((r) => [r.id, r])),
    atomicMasses,
  };
}

/** Chave canônica de um conjunto de substâncias (ordem e repetição não importam). */
export const setKey = (ids) => [...new Set(ids)].sort().join('+');

export const isMetal = (sub) => sub?.categories?.includes('metal') && !!sub.elementOf;
