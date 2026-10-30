// Motor de combinação.
//
// combine(selection) recebe ids de substâncias e de ferramentas que o jogador colocou na bancada
// e devolve UM resultado, de um destes tipos:
//
//   { kind: 'reaction',        reaction, ... }      reação encontrada e condições satisfeitas
//   { kind: 'needs-condition', reaction, missing }  as substâncias reagem, mas falta calor/catalisador...
//   { kind: 'no-reaction',     reasonId, title, reason, source? }   não reage, com explicação confiável
//   { kind: 'unknown',         title, reason, prediction? }         fora da base; não afirmamos nada
//   { kind: 'invalid',         title, reason }      bancada vazia etc.
//
// `resolvers` e `explainers` são listas. Um resolver procura reações: o da base curada vem
// primeiro e o motor de regras da Fase 2 (rules/reaction-rules.js) depois, de modo que conteúdo
// curado sempre tem prioridade.
// Um explainer explica por que não houve reação (base curada de não-reações + regras genéricas).

import { setKey } from './data.js';
import { defaultExplainers } from './rules/non-reaction-rules.js';
import { createRules } from './rules/reaction-rules.js';

const rulesCache = new WeakMap();
/** Motor de regras de um conjunto de dados (criado uma vez e reaproveitado). */
export function rulesFor(data) {
  if (!rulesCache.has(data)) rulesCache.set(data, createRules(data));
  return rulesCache.get(data);
}

/**
 * Reação por id: curada (data.reactionsById) ou gerada por regra ("gen:A+B"), que é recalculada
 * a partir dos reagentes — por isso ids gerados podem ser salvos no progresso do jogador.
 */
export function lookupReaction(data, id) {
  const curated = data.reactionsById.get(id);
  if (curated || !id?.startsWith('gen:')) return curated;
  const found = rulesFor(data).resolver.find(id.slice(4).split('+'), ['calor', 'faisca', 'luz', 'eletricidade', 'catalisador']);
  return found.find((r) => r.id === id);
}

/** Resolver da base curada: casa pelo conjunto exato de substâncias. */
export function curatedResolver(data) {
  const index = new Map();
  for (const r of data.reactions) {
    const key = setKey(r.reactants.map((e) => e.id));
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(r);
  }
  return {
    id: 'curated',
    find(substanceIds) {
      return index.get(setKey(substanceIds)) ?? [];
    },
  };
}

/** Uma condição é [[a, b], [c]] = (a OU b) E c. Retorna os requisitos não atendidos. */
export function missingConditions(reaction, itemIds) {
  const have = new Set(itemIds);
  return (reaction.conditions ?? []).filter((anyOf) => !anyOf.some((id) => have.has(id)));
}

export function createEngine(data, { resolvers = [curatedResolver(data), rulesFor(data).resolver], explainers = defaultExplainers(data, rulesFor(data).explainer) } = {}) {
  function split(selection) {
    const substanceIds = [];
    const itemIds = [];
    for (const id of selection) {
      if (data.itemsById.has(id)) itemIds.push(id);
      else if (data.substancesById.has(id)) substanceIds.push(id);
    }
    return { substanceIds: [...new Set(substanceIds)], itemIds: [...new Set(itemIds)] };
  }

  function combine(selection) {
    const { substanceIds, itemIds } = split(selection);
    const ctx = { data, substanceIds, itemIds, substances: substanceIds.map((id) => data.substancesById.get(id)) };

    if (substanceIds.length === 0) {
      return {
        kind: 'invalid',
        title: 'Bancada sem substâncias',
        reason: itemIds.length
          ? 'Ferramentas como calor ou eletricidade não reagem sozinhas: elas fornecem energia (ou aceleram) reações entre substâncias. Adicione pelo menos uma substância.'
          : 'Coloque substâncias na bancada clicando nelas no inventário ou na tabela periódica.',
      };
    }

    // Prioridade: o primeiro resolver que achar algo decide (curado antes das regras).
    let candidates = [];
    for (const r of resolvers) {
      candidates = r.find(substanceIds, itemIds, ctx);
      if (candidates.length) break;
    }
    const ready = candidates.find((r) => missingConditions(r, itemIds).length === 0);
    if (ready) return { kind: 'reaction', reaction: ready, ...ctx };
    if (candidates.length) {
      // Escolhe a candidata com menos requisitos faltando.
      const best = candidates
        .map((r) => ({ r, missing: missingConditions(r, itemIds) }))
        .sort((a, b) => a.missing.length - b.missing.length)[0];
      return { kind: 'needs-condition', reaction: best.r, missing: best.missing, ...ctx };
    }

    for (const ex of explainers) {
      const res = ex.explain(ctx);
      if (res) return { ...ctx, ...res };
    }
    return { kind: 'unknown', title: 'Sem resultado', reason: 'Nenhuma regra se aplicou.', ...ctx };
  }

  return { combine, split };
}
