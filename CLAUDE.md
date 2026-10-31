# C10H15N — instruções para o Claude

Jogo educativo de química 2D para navegador, no estilo crafting (parecido com Little Alchemy): o
jogador junta substâncias e ferramentas e vê reações químicas reais, com equação balanceada e
explicação curta do porquê. Quando não há reação, o jogo diz isso e explica o motivo. Público
inicial: curiosos que querem aprender o básico. O projeto deve crescer para conteúdo avançado.
Detalhes de arquitetura, estrutura de pastas e "como adicionar conteúdo" estão no README.md.

## Fases

- **Fase 1 (protótipo) — CONCLUÍDA**: ~20 elementos, reações curadas, tabela periódica navegável,
  inventário, bancada, painel de explicação, 8 níveis de progressão (grupos 1 e 2 ampliados com
  base no livro de divulgação DK, só como leitura complementar).
- **Fase 2 (motor de regras) — CONCLUÍDA**: balanceamento automático, motor de regras para
  combinações não previstas (precipitação pela Tabela I.1, ácido-base, série eletroquímica,
  óxidos, combustão, decomposição), compostos iônicos gerados a partir de íons, estequiometria
  (calculadora e objetivos) e 3 níveis novos. Fonte principal das regras: Atkins & Jones,
  *Chemical Principles*, 5. ed., com página. Detalhes no README.
- **Pendências da Fase 2**: o que o livro (Atkins & Jones) cobria foi feito — fontes com página nas
  exceções, limites trocados pelo que o livro diz, metal alcalino + Cl2, Mg(OH)2 → MgO, Cu + HNO3
  diluído (com o radical NO), etanol e propano, estequiometria com mol, litros de gás, solução e
  rendimento. **Ainda em aberto** (o livro não supre):
  1. Exceções sem página: carbonatos básicos de Mg²⁺ e Fe²⁺ (escopo "precipitation"), a formação
     dos acetatos básicos de Fe³⁺/Al³⁺ em si, e o limite de −1,0 V para "não se deposita" (é uma
     estimativa a partir das p. 543–544). Ideal: conferir no Greenwood.
  2. Sem regra geral para metais do grupo 2 e de transição + O2/Cl2 (o produto varia); só o grupo 1
     + Cl2 tem regra. Decomposição: só carbonatos de Mg/Ca e o Mg(OH)2 curado.
  3. Regras só para pares; combinações de 3+ substâncias não passam pelo motor (é decisão de
     projeto, não de fonte).
  4. Ácido nítrico + outros metais continua "não sei" (produtos dependem da concentração).
- **Fase 3 (avançado) — EM ANDAMENTO**, em etapas publicadas uma a uma:
  - **3A Energia — CONCLUÍDA**: ΔH°/ΔS°/ΔG° pela lei de Hess (`data/thermo.json`, `src/core/thermo.js`),
    painel "Energia", calor na calculadora, nível "Energia das reações". Dados: Atkins FQ 12. ed.
    (Tabela 2C.7) + Atkins & Jones (Apêndice 2A). No PDF do Atkins & Jones o sinal de menos vem como
    o caractere `\x06` — trocar por "-" antes de ler números.
  - 3B Cinética (Atkins & Jones cap. 14; Atkins FQ Focus 17), 3C Equilíbrio (caps. 10–12), 3D
    Moléculas 3D (cap. 3, VSEPR), 3E Orgânica (caps. 18–19), 3F Missões (decidir com o usuário).
  - Proposta pendente de aprovação: curiosidades/descrições dos elementos a partir do livro da DK
    (*The Periodic Table Book*, 2017), escritas com palavras próprias (sem copiar o texto), como
    leitura complementar com página.

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
   Toda regra nova do motor (Fase 2+) precisa listar as exceções químicas conhecidas como
   `unknown` e passar pela varredura de todos os pares em `tests/rules.test.js`.
4. **Progressão pedagógica**: começar com poucos elementos, desbloquear por níveis (famílias,
   periodicidade), objetivos simples, feedback que explica o porquê. O teste de progressão
   garante que o jogo é concluível.
5. **Segurança**: reações perigosas podem aparecer, mas sempre explicando por que são perigosas
   e por que não se faz em casa (`safety.level`, `safety.why`, `safety.home`).
6. **Vocabulário explicado**: o público é iniciante. Ao introduzir um conceito novo nos textos,
   acrescente o termo em `data/glossary.json` (definição simples + exemplo + fonte com página).
7. **Arquitetura extensível**: `src/core/` é puro (sem DOM) e testável; novas fases entram como
   resolvers/explainers/tipos de objetivo novos, sem reescrever a Fase 1.

## Publicação

O site é estático (sem build) e é publicado pelo GitHub Pages a partir do branch `main`, pasta
raiz. Qualquer push no `main` atualiza o site em `https://mooncake-cmd.github.io/c10h15n/`.
Por isso, use caminhos relativos (sem `/` inicial) em HTML/JS/CSS.
O usuário pediu que **toda mudança seja publicada**: ao terminar, abra o PR para o `main` e faça o
merge (depois, realinhe o branch de trabalho com o `main`).
