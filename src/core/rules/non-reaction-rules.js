// "Explainers": quando nenhuma reação é encontrada, explicam o porquê.
//
// Cada explainer é { id, explain(ctx) → resultado | null }. A ordem importa: o primeiro que
// responder vence. Distinção importante para a correção química:
//   - kind 'no-reaction': temos confiança de que NÃO reage (base curada ou regra sólida);
//   - kind 'unknown':     não está na base. Podemos sugerir uma previsão, mas sem afirmar.
// Novas regras (solubilidade, ácido-base genérico etc. — Fase 2) entram nesta lista.

import { setKey, isMetal } from '../data.js';
import { formatFormulaText } from '../formula.js';

const fmtV = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2).replace('.', ',')} V`;

export function curatedNonReactionExplainer(data) {
  const index = new Map(data.nonReactions.map((nr) => [setKey(nr.substances), nr]));
  return {
    id: 'curated-non-reactions',
    explain({ substanceIds }) {
      const nr = index.get(setKey(substanceIds));
      if (!nr) return null;
      return { kind: 'no-reaction', reasonId: nr.id, title: nr.title, reason: nr.reason, source: nr.source };
    },
  };
}

export const nobleGasRule = (data) => ({
  id: 'gas-nobre',
  explain({ substances }) {
    const gas = substances.find((s) => s.categories.includes('gas-nobre'));
    if (!gas) return null;
    const el = data.elementsBySymbol.get(gas.elementOf);
    const valence = el.shells?.[el.shells.length - 1];
    return {
      kind: 'no-reaction',
      reasonId: 'rule:gas-nobre',
      title: `${gas.name} é um gás nobre: não reage`,
      reason:
        `${gas.name} (grupo 18) tem a camada de valência completa — configuração ${el.electronConfiguration}, ` +
        `${valence} elétron${valence > 1 ? 's' : ''} na última camada${gas.id === 'He' ? ' (o máximo para a primeira camada)' : ''}. ` +
        'Ele não tem tendência a ganhar, perder ou compartilhar elétrons, e é por isso que os outros elementos "querem" ficar com essa configuração quando reagem. ' +
        'Curiosidade: gases nobres mais pesados, como o xenônio, formam alguns compostos em condições especiais — mas hélio, neônio e argônio não formam compostos estáveis conhecidos em condições comuns.',
      source: { ref: 'brown', topic: 'Gases nobres; configuração eletrônica', justification: 'He, Ne e Ar não formam compostos estáveis em condições ordinárias.' },
    };
  },
});

export const metalsOnlyRule = () => ({
  id: 'so-metais',
  explain({ substances }) {
    if (substances.length < 2 || !substances.every(isMetal)) return null;
    return {
      kind: 'no-reaction',
      reasonId: 'rule:so-metais',
      title: 'Metal + metal não forma composto',
      reason:
        'Metais tendem a PERDER elétrons. Para haver reação, alguém precisa recebê-los — e nenhum dos dois quer. ' +
        'Derretendo metais juntos obtém-se uma LIGA, que é uma mistura (não uma substância nova com fórmula própria): ' +
        'latão = cobre + zinco, bronze = cobre + estanho, aço = ferro + um pouco de carbono.',
      source: { ref: 'brown', topic: 'Ligação metálica; ligas', justification: 'Ligas são soluções sólidas/misturas de metais, não compostos iônicos ou moleculares.' },
    };
  },
});

/**
 * Série de reatividade: metal (elemento) + ácido (cátion H⁺) ou metal + sal de outro metal.
 * Se o metal é MENOS reativo que o cátion → não reage (confiante).
 * Se é MAIS reativo → provavelmente reage, mas a reação não está na base: avisamos sem inventar a equação.
 */
export const reactivitySeriesRule = (data) => {
  const byMetal = new Map(data.reactivitySeries.map((e) => [e.metal, e]));
  const byCation = new Map(data.reactivitySeries.map((e) => [e.cation, e]));
  return {
    id: 'reatividade',
    explain({ substances }) {
      if (substances.length !== 2) return null;
      const metal = substances.find(isMetal);
      const other = substances.find((s) => s !== metal);
      if (!metal || !other?.ions) return null;
      const m = byMetal.get(metal.elementOf);
      const c = byCation.get(other.ions.cation.formula);
      if (!m || !c) return null;
      const isAcid = c.metal === 'H';
      const alvo = isAcid ? 'o hidrogênio do ácido' : `o ${data.elementsBySymbol.get(c.metal).name.toLowerCase()} do sal`;
      const cationTxt = formatFormulaText(c.cation);

      if (m.metal === c.metal) {
        return {
          kind: 'no-reaction',
          reasonId: 'rule:mesmo-metal',
          title: 'Mesmo metal dos dois lados',
          reason: `O metal ${metal.name.toLowerCase()} e o cátion ${cationTxt} do sal são do mesmo elemento: trocar um pelo outro não muda nada.`,
        };
      }
      if (m.E0 >= c.E0) {
        return {
          kind: 'no-reaction',
          reasonId: 'rule:reatividade',
          title: `${metal.name} não desloca ${alvo}`,
          reason:
            `Na série de reatividade, ${metal.name.toLowerCase()} (E° = ${fmtV(m.E0)}) fica abaixo de ${isAcid ? 'H' : c.metal} (E° do ${cationTxt} = ${fmtV(c.E0)}). ` +
            `Um metal só desloca ${isAcid ? 'o H⁺ de um ácido' : 'outro metal de um sal'} se for mais reativo — ou seja, se perder elétrons com mais facilidade (E° mais negativo).`,
          source: data.reactivitySeriesSource,
        };
      }
      return {
        kind: 'unknown',
        reasonId: 'rule:reatividade-previsao',
        title: 'Provavelmente reage — mas ainda não está na base',
        reason:
          `Pela série de reatividade, ${metal.name.toLowerCase()} (E° = ${fmtV(m.E0)}) é mais reativo que ${isAcid ? 'o hidrogênio' : c.metal} (${fmtV(c.E0)}), ` +
          `então esperaríamos uma reação de simples troca em que ${metal.name.toLowerCase()} desloca ${alvo}. ` +
          'Essa reação ainda não foi curada (conferida com fonte) para o jogo; o motor de regras da Fase 2 vai montar e balancear equações assim automaticamente.',
        prediction: { type: 'simples_troca' },
      };
    },
  };
};

export const singleSubstanceRule = () => ({
  id: 'sozinha',
  explain({ substances, itemIds }) {
    if (substances.length !== 1) return null;
    const s = substances[0];
    if (itemIds.length === 0) {
      return {
        kind: 'no-reaction',
        reasonId: 'rule:sozinha',
        title: `${s.name} sozinho(a) não reage`,
        reason:
          'Uma substância sozinha só se transforma por DECOMPOSIÇÃO (quebrar-se em substâncias mais simples), e isso costuma exigir energia: calor, luz ou eletricidade — ou um catalisador. Tente juntar outra substância ou uma ferramenta.',
      };
    }
    return {
      kind: 'unknown',
      reasonId: 'rule:sozinha-desconhecida',
      title: 'Nenhuma decomposição conhecida aqui',
      reason: `A base do jogo não tem uma decomposição de ${s.name} com essa ferramenta. Muitas substâncias são estáveis (o NaCl, por exemplo, derrete a 801 °C sem se decompor).`,
    };
  },
});

export const fallbackExplainer = () => ({
  id: 'fallback',
  explain() {
    return {
      kind: 'unknown',
      reasonId: 'rule:desconhecida',
      title: 'Nada conhecido para essa combinação',
      reason:
        'Essa combinação não está na base de reações da Fase 1, e nenhuma regra geral se aplica. Isso NÃO prova que essas substâncias nunca reagem — só que o jogo ainda não tem uma reação conferida para elas. Dica: as reações mais comuns aqui envolvem oxigênio (combustão), água, ácidos ou bases.',
    };
  },
});

export function defaultExplainers(data) {
  return [
    curatedNonReactionExplainer(data),
    nobleGasRule(data),
    singleSubstanceRule(data),
    metalsOnlyRule(data),
    reactivitySeriesRule(data),
    fallbackExplainer(data),
  ];
}
