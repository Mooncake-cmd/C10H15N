# C10H15N — jogo educativo de química

Jogo 2D de navegador no estilo *crafting*: você junta elementos, compostos e ferramentas (calor,
faísca, luz, eletricidade, catalisador) e vê **reações químicas reais**, com a equação balanceada,
o porquê, a conservação de átomos e massa, os riscos de segurança e a fonte para conferir num
livro-texto. Quando não há reação, o jogo diz isso e explica o motivo.

**Fases 1 e 2 concluídas.** 25 elementos jogáveis (os 118 aparecem na tabela), 41 compostos
curados e mais 81 gerados a partir de íons, 38 reações curadas, 17 "não-reações" curadas e um
**motor de regras** que monta e balanceia sozinho cerca de 750 reações a partir de regras gerais
(solubilidade, ácido-base, série eletroquímica, combustão, decomposição), com explicação, fonte e
segurança. Há também uma calculadora de estequiometria, 11 níveis de progressão em duas fases e um
**glossário** com mais de 100 termos: nos textos, as palavras de química ficam sublinhadas e mostram a
definição ao toque.

## Como rodar

O jogo é HTML + CSS + JavaScript puro (módulos ES), sem dependências nem etapa de build. Como ele
carrega os dados com `fetch`, precisa ser servido por HTTP (abrir o `index.html` direto com
`file://` não funciona):

```bash
python3 -m http.server 8000
```

Depois abra http://localhost:8000. No GitHub Pages funciona sem mudar nada.

## Testes

Requer Node 18 ou mais recente; não há pacotes para instalar.

```bash
npm test
```

O que os testes garantem (são ~530 verificações):

- **Toda reação conserva átomos e carga** — tanto a equação completa quanto a equação iônica
  líquida, quando existe. Se você errar um coeficiente, o teste diz qual elemento não fecha
  (ex.: `Fe: 4 nos reagentes, 6 nos produtos`). Também confere se os coeficientes estão
  simplificados e se a massa se conserva.
- Os tipos declarados batem com a forma da equação (decomposição tem 1 reagente, combustão usa O2...).
- Toda reação tem explicação, porquê, fonte (referência + tópico + justificativa) e, se for
  `cuidado`/`perigo`, explica o perigo e o que fazer "em casa".
- Massas atômicas dos elementos jogáveis conferidas com a tabela abreviada da IUPAC 2021.
- A composição iônica de cada sal, ácido e base fecha com a fórmula (ex.: Ca²⁺ + 2 OH⁻ = Ca(OH)2).
- Nenhuma "não-reação" contradiz uma reação da base.
- **Todo desenho de molécula bate com a fórmula**: mesmos átomos, carga total certa, número de
  ligações de cada átomo dentro do esperado (H faz 1, O faz 2, C faz 4...) e distâncias plausíveis.
  Compostos iônicos aparecem como íons separados, com carga, nunca como molécula. Em toda reação,
  cada átomo dos reagentes casa com um átomo dos produtos (é o que a animação mostra).
- **O jogo pode ser concluído**: um jogador simulado passa por todos os níveis usando só o que
  já está desbloqueado em cada um (testando todos os pares de substâncias e respondendo às
  perguntas de estequiometria).
- **Balanceamento automático** reproduz os coeficientes de todas as 38 reações curadas e recusa
  equações impossíveis ou ambíguas.
- **Motor de regras**: onde uma regra se aplica a uma reação curada, ela dá exatamente os mesmos
  produtos e coeficientes; nunca contradiz uma não-reação curada; e uma varredura de TODOS os
  pares de substâncias confere cada equação gerada com os mesmos critérios das curadas (átomos,
  carga, coeficientes mínimos, estados, equação iônica, segurança, fonte e desenho).
- Regras de solubilidade conferidas caso a caso com a Tabela I.1 de Atkins & Jones; série de
  reatividade conferida com o Apêndice 2B do mesmo livro.

## Estrutura

```
index.html, css/            interface
data/                       TODO o conteúdo (JSON) — dá para editar sem mexer em código
  elements.json             118 elementos (gerado por scripts/build-elements.mjs)
  source/                   dataset aberto original (Periodic-Table-JSON)
  substances.json           substâncias jogáveis (fórmula, estado, categorias, íons, perigos)
  reactions.json            reações curadas, com fonte e segurança
  non-reactions.json        combinações que não reagem, com o motivo
  ions.json                 íons, regras de solubilidade (Tabela I.1), compostos que não existem
  rules.json                textos, fontes e segurança das regras da Fase 2
  glossary.json             glossário (definição, exemplo, relacionados, página do glossário do livro)
  items.json                ferramentas (calor, faísca, luz, eletricidade, catalisador)
  reactivity-series.json    série de reatividade (E°), usada pelas regras
  progression.json          níveis, desbloqueios e objetivos
  sources.json              referências bibliográficas
  structures.json           desenho 2D das moléculas, dos íons poliatômicos e dos óxidos iônicos
src/core/                   química e regras do jogo — sem DOM, testável no Node
  formula.js                lê fórmulas (parênteses, hidratos, cargas), massa molar, formatação
  equation.js               conservação de átomos/carga/massa, formatação de equações
  engine.js                 motor de combinação (resolvers + explainers)
  rules/                    explicações de "não reage" (gás nobre, só metais, série de reatividade...)
  progression.js            estado do jogador, objetivos, níveis
  balancer.js               balanceamento automático (espaço nulo com frações exatas)
  ions.js                   solubilidade, fórmula e nome de compostos iônicos, compostos derivados
  stoichiometry.js          massas, mol e reagente limitante
  rules/reaction-rules.js   motor de regras da Fase 2
  glossary.js               acha os termos do glossário num texto (forma mais longa, palavra inteira)
  structure.js              estruturas 2D: desenho, unidade-fórmula, montagem dos lados da equação,
                            pareamento de átomos para a animação e verificações
src/ui/, src/main.js        interface
  structure-svg.js          desenha as estruturas em SVG (cores CPK)
  reaction-stage.js         animação: rearranjo dos átomos, efeitos e "não reage"
  glossary-ui.js            termos clicáveis nos textos, balão com a definição e o diálogo do glossário
tests/                      testes (node:test)
```

### Como o motor decide o resultado

`engine.combine(seleção)` separa substâncias de ferramentas e devolve um destes resultados:

| tipo | quando |
|---|---|
| `reaction` | há reação curada com esses reagentes e as condições foram atendidas |
| `needs-condition` | os reagentes batem, mas falta uma ferramenta (o jogo explica energia de ativação/catálise) |
| `no-reaction` | **certeza** de que não reage: não-reação curada ou regra química sólida |
| `unknown` | nem a base nem uma regra sólida decidem. O jogo **não inventa**: explica por que a regra simples não vale (anfóteros, ácidos oxidantes, metais que atacam a água, compostos que não existem...) |

A ordem é: **base curada** (reações e não-reações conferidas uma a uma) → **motor de regras**
(Fase 2) → explicações genéricas. Uma reação gerada por regra aparece com o selo "Prevista por
regra" e tem id `gen:A+B`, recalculado a partir dos reagentes (por isso pode ser salva no
progresso). As regras de `src/core/rules/reaction-rules.js`:

| regra | exemplo | fonte (Atkins & Jones, 5. ed.) |
|---|---|---|
| ácido + hidróxido → sal + água | H2SO4 + 2 NaOH | J.3, p. F75 |
| ácido + óxido básico/anfótero | Al2O3 + 6 HCl | 11.3, p. 428–429 |
| ácido + carbonato → sal + água + CO2 | Na2CO3 + 2 HCl | 15.6, p. 623 |
| amônia + ácido → sal de amônio | 2 NH3 + H2SO4 | J.1, p. F73 |
| precipitação (dupla troca) | BaCl2 + Na2SO4 | I.2–I.4 e Tabela I.1, p. F67–F69 |
| metal + ácido não oxidante → sal + H2 | 2 Al + 6 HCl | 13.7, p. 534 |
| metal + sal de metal menos reativo | Mg + CuSO4 | 13.7, p. 534; p. F84 |
| óxido básico + água → hidróxido | BaO + H2O | 11.3, p. 428 |
| CO2 + hidróxido → carbonato + água | 2 NaOH + CO2 | 11.3, p. 428 |
| bicarbonato + hidróxido → carbonato | NaHCO3 + NaOH | 15.8, p. 627 |
| decomposição de carbonatos de Mg e Ca | MgCO3 → MgO + CO2 | 15.7–15.8, p. 624–627 |
| combustão completa de compostos de C, H (e O) | (para combustíveis futuros) | H e M, p. F64 e F95 |

E as exceções que viram `unknown` em vez de uma equação errada: Ag⁺ + OH⁻ (forma Ag2O), NH4⁺ +
OH⁻ (forma NH3), carbonatos de Cu²⁺, Fe³⁺ e Al³⁺ (não existem), metais anfóteros (Al, Zn, Be) em
base forte, ácido nítrico com metais (oxidante: forma NO/NO2), metais do grupo 1 e Ca/Sr/Ba em
soluções de sais (atacam a água primeiro), Al e Mg que não se depositam a partir de água,
compostos pouco solúveis, misturas de ácidos com o nítrico (água régia, mistura sulfonítrica).

## Como adicionar conteúdo

**Nova reação**: acrescente um objeto em `data/reactions.json` (o bloco `_meta.fields` no topo
descreve cada campo) e rode `npm test`. Se alguma substância for nova, crie-a antes em
`substances.json`. Condições usam lista de alternativas: `[["calor", "faisca"]]` significa
calor OU faísca; `[["calor"], ["catalisador"]]` significa calor E catalisador.

A fonte principal (`source.ref`) é sempre um livro-texto. Livros de divulgação (marcados em
`sources.json` → `_meta.complementaryOnly`) só entram como leitura complementar em
`source.seeAlso: [{ ref, topic, pages? }]`, e os testes conferem isso. Não invente páginas: só
cite `pages` que você conferiu no livro.

**Desenho da substância**: em `data/structures.json`. Moléculas e ácidos precisam de átomos e
ligações (coordenadas em comprimentos de ligação, y para baixo); íons poliatômicos novos entram
em `ions`, com cargas formais. Sais, bases e outros compostos com `ions` em `substances.json`
são montados sozinhos a partir dos íons; metais e gases nobres também. `npm test` diz se faltar
um desenho ou se ele não fechar com a fórmula.

**Nova não-reação**: em `data/non-reactions.json`, com motivo e fonte.

**Novo termo no glossário**: em `data/glossary.json`. Escreva a definição com suas palavras,
em linguagem simples, com um exemplo do jogo e a página do glossário de Atkins & Jones (B1–B30).
Em `aliases` vão as formas que aparecem nos textos (plural, gênero); em `exclude`, expressões em
que a palavra não tem sentido químico. Nenhuma forma pode pertencer a dois termos (o teste
avisa). Os links nos textos são automáticos: não é preciso marcar nada.

**Novo elemento jogável**: crie a forma elementar em `substances.json` (campo `elementOf`) e
desbloqueie-o em algum nível de `progression.json`. Os dados físicos já estão em `elements.json`.

**Nova regra ou novo íon**: íons e solubilidade em `data/ions.json` (pares que não formam o
composto esperado vão em `anomalies`); textos, fontes e segurança das regras em
`data/rules.json`; a lógica em `src/core/rules/reaction-rules.js`. A varredura de todos os pares
em `tests/rules.test.js` confere tudo o que a regra nova passar a gerar — antes de confiar,
revise uma amostra das equações geradas.

**Novo nível/objetivo**: em `progression.json` (cada nível tem `phase`). Tipos de objetivo:
`produce`, `produceCategory`, `reactionType`, `nonReaction`, `reaction` e `stoich` (pergunta de
estequiometria; a resposta certa é calculada). O teste de progressão avisa se um objetivo ficar
impossível. Inserir um nível no meio muda os índices dos saves: suba `STATE_VERSION` em
`src/core/progression.js`; saves antigos são migrados refazendo o caminho pelo histórico.

**Atualizar os elementos**: troque `data/source/PeriodicTableJSON.json` e rode
`npm run build:elements`.

## Fontes

As reações citam livros-texto de química geral (Brown et al., *Química: a ciência central*;
Atkins & Jones, *Princípios de Química*; Kotz et al., *Química Geral e Reações Químicas*;
Greenwood & Earnshaw, *Chemistry of the Elements*) e o *CRC Handbook* para os potenciais-padrão.
Essas citações indicam o **tópico**, sem página. As regras da Fase 2 e as confirmações em
`seeAlso` citam **seção e página** de Atkins & Jones, *Chemical Principles*, 5. ed. (2010),
conferidas no livro.

Dados dos elementos: [Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON),
compilado da Wikipédia (CC BY-SA). As massas atômicas são arredondadas a 5 algarismos
significativos e conferidas com a IUPAC nos testes.

## Roteiro: como a Fase 3 se encaixa

A Fase 2 entrou sem reescrever a Fase 1: o motor de regras é um resolver e um explainer a mais
em `createEngine`, o balanceamento devolve o mesmo formato de equação, e a estequiometria usa as
massas molares que já existiam. A Fase 3 segue o mesmo caminho:

**Fase 3 — conteúdo avançado**
- Termodinâmica/cinética/equilíbrio: campos opcionais nas reações (`deltaH`, `Ea`, `K`) e painéis
  novos em `src/ui/`. Os testes de conservação não mudam. As tabelas de dados do Atkins de
  físico-química (12. ed., p. 884–909) já foram conferidas e cobrem ΔfH° de 22 das 38 reações
  curadas; o Apêndice 2A de Atkins & Jones completa o resto.
- Moléculas 3D: um componente de UI à parte (ex.: 3Dmol.js) alimentado por um `data/structures/`.
- Química orgânica: novas substâncias/reações nos mesmos JSON (o leitor de fórmulas já aceita
  `CH3COOH` e similares).
- Missões: novos tipos em `OBJECTIVE_CHECKS` e um campo `missions` em `progression.json`
  (o estado salvo tem `version` para migração).
