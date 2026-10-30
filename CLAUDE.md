# Elementar — instruções para o Claude

Jogo educativo de química 2D para navegador, no estilo crafting (parecido com Little Alchemy): o
jogador junta substâncias e ferramentas e vê reações químicas reais, com equação balanceada e
explicação curta do porquê. Quando não há reação, o jogo diz isso e explica o motivo. Público
inicial: curiosos que querem aprender o básico. O projeto deve crescer para conteúdo avançado.
Detalhes de arquitetura, estrutura de pastas e "como adicionar conteúdo" estão no README.md.

## Fases

- **Fase 1 (protótipo) — CONCLUÍDA**: ~20 elementos, reações curadas, tabela periódica navegável,
  inventário, bancada, painel de explicação, 7 níveis de progressão.
- **Fase 2 (motor de regras) — próxima**: combinações não previstas, balanceamento automático,
  tipos de reação (síntese, decomposição, simples troca, dupla troca, combustão, ácido-base),
  regras de solubilidade, série de reatividade, massa molar e estequiometria básica. Os pontos de
  extensão estão descritos no fim do README ("Roteiro").
- **Fase 3 (avançado)**: termodinâmica e cinética, equilíbrio, moléculas 3D, introdução à química
  orgânica, missões e progressão mais elaborada.

## Requisitos que valem para qualquer mudança

1. **Correção química acima de tudo.** Dados dos elementos vêm de dataset aberto
   (`data/source/`, gerado por `scripts/build-elements.mjs`). Reações ficam em arquivos de dados
   (`data/*.json`), nunca no código. Toda reação precisa de fonte (livro-texto + tópico) e
   justificativa. Não inventar número de página.
2. **Testes**: `npm test` (Node ≥ 18, sem dependências) precisa passar. Os testes verificam
   conservação de átomos e de carga em toda equação da base. Uma reação errada TEM que fazer o
   teste falhar — não enfraquecer testes para passar.
3. **"Não reage" ≠ "não sei"**: o motor só afirma que algo não reage com base curada ou regra
   sólida; fora disso devolve `unknown` e no máximo sugere uma previsão, sem inventar equação.
4. **Progressão pedagógica**: começar com poucos elementos, desbloquear por níveis (famílias,
   periodicidade), objetivos simples, feedback que explica o porquê. O teste de progressão
   garante que o jogo é concluível.
5. **Segurança**: reações perigosas podem aparecer, mas sempre explicando por que são perigosas
   e por que não se faz em casa (`safety.level`, `safety.why`, `safety.home`).
6. **Arquitetura extensível**: `src/core/` é puro (sem DOM) e testável; novas fases entram como
   resolvers/explainers/tipos de objetivo novos, sem reescrever a Fase 1.

## Publicação

O site é estático (sem build) e é publicado pelo GitHub Pages a partir do branch `main`, pasta
raiz. Qualquer push no `main` atualiza o site em `https://mooncake-cmd.github.io/c10h15n/`.
Por isso, use caminhos relativos (sem `/` inicial) em HTML/JS/CSS.
