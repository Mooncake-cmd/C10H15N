# C10H15N — jogo educativo de química

Jogo 2D de navegador no estilo *crafting*: você junta elementos, compostos e ferramentas (calor,
faísca, luz, eletricidade, catalisador) e vê **reações químicas reais**, com a equação balanceada,
o porquê, a conservação de átomos e massa, os riscos de segurança e a fonte para conferir num
livro-texto. Quando não há reação, o jogo diz isso e explica o motivo.

Esta é a **Fase 1 (protótipo)**: 25 elementos jogáveis (os 118 aparecem na tabela), 39 compostos,
38 reações curadas, 17 "não-reações" curadas, regras genéricas de explicação e 8 níveis de
progressão.

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

O que os testes garantem (são ~250 verificações):

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
  já está desbloqueado em cada um.

## Estrutura

```
index.html, css/            interface
data/                       TODO o conteúdo (JSON) — dá para editar sem mexer em código
  elements.json             118 elementos (gerado por scripts/build-elements.mjs)
  source/                   dataset aberto original (Periodic-Table-JSON)
  substances.json           substâncias jogáveis (fórmula, estado, categorias, íons, perigos)
  reactions.json            reações curadas, com fonte e segurança
  non-reactions.json        combinações que não reagem, com o motivo
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
  structure.js              estruturas 2D: desenho, unidade-fórmula, montagem dos lados da equação,
                            pareamento de átomos para a animação e verificações
src/ui/, src/main.js        interface
  structure-svg.js          desenha as estruturas em SVG (cores CPK)
  reaction-stage.js         animação: rearranjo dos átomos, efeitos e "não reage"
tests/                      testes (node:test)
```

### Como o motor decide o resultado

`engine.combine(seleção)` separa substâncias de ferramentas e devolve um destes resultados:

| tipo | quando |
|---|---|
| `reaction` | há reação curada com esses reagentes e as condições foram atendidas |
| `needs-condition` | os reagentes batem, mas falta uma ferramenta (o jogo explica energia de ativação/catálise) |
| `no-reaction` | **certeza** de que não reage: não-reação curada ou regra química sólida |
| `unknown` | não está na base. O jogo **não inventa**: pode sugerir uma previsão (ex.: pela série de reatividade, "deve haver simples troca"), mas avisa que ela ainda não foi conferida |

Essa separação entre "não reage" e "não sei" é o que mantém a correção química enquanto a base
ainda é pequena.

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

**Novo elemento jogável**: crie a forma elementar em `substances.json` (campo `elementOf`) e
desbloqueie-o em algum nível de `progression.json`. Os dados físicos já estão em `elements.json`.

**Novo nível/objetivo**: em `progression.json`. Tipos de objetivo: `produce`, `produceCategory`,
`reactionType`, `nonReaction` e `reaction`. O teste de progressão avisa se um objetivo ficar
impossível. Inserir um nível no meio muda os índices dos saves: suba `STATE_VERSION` em
`src/core/progression.js`; saves antigos são migrados refazendo o caminho pelo histórico.

**Atualizar os elementos**: troque `data/source/PeriodicTableJSON.json` e rode
`npm run build:elements`.

## Fontes

As reações citam livros-texto de química geral (Brown et al., *Química: a ciência central*;
Atkins & Jones, *Princípios de Química*; Kotz et al., *Química Geral e Reações Químicas*;
Greenwood & Earnshaw, *Chemistry of the Elements*) e o *CRC Handbook* para os potenciais-padrão.
Cada reação indica o **tópico**, e não o número da página, porque os capítulos mudam de uma
edição para outra. Para conferir, procure o tópico no índice remissivo da edição que você tiver.

Dados dos elementos: [Periodic-Table-JSON](https://github.com/Bowserinator/Periodic-Table-JSON),
compilado da Wikipédia (CC BY-SA). As massas atômicas são arredondadas a 5 algarismos
significativos e conferidas com a IUPAC nos testes.

## Roteiro: como as próximas fases se encaixam

Nada da Fase 1 precisa ser reescrito. Os pontos de extensão já estão separados:

**Fase 2 — motor de regras**
- *Balanceamento automático*: um novo módulo em `src/core/` (por exemplo, `balancer.js`, que
  resolve o espaço nulo da matriz elemento × espécie com frações exatas) e devolve o mesmo formato
  `{ formula, coef }[]`. A verificação de `equation.js` e os testes continuam valendo.
- *Motor de regras*: um novo **resolver** passado a `createEngine(data, { resolvers: [curated, regras] })`.
  O curado continua tendo prioridade. As regras de tipo de reação (simples/dupla troca,
  combustão, ácido-base) usam `ions`, `categories` e `reactivity-series.json`, que já existem.
- *Solubilidade*: um `data/solubility.json` e um explainer novo em `src/core/rules/`.
- *Estequiometria*: `molarMass` e `sideMass` já existem; falta a interface (um "quanto de produto
  sai de X gramas?") e objetivos novos em `OBJECTIVE_CHECKS`.

**Fase 3 — conteúdo avançado**
- Termodinâmica/cinética/equilíbrio: campos opcionais nas reações (`deltaH`, `Ea`, `K`) e painéis
  novos em `src/ui/`. Os testes de conservação não mudam.
- Moléculas 3D: um componente de UI à parte (ex.: 3Dmol.js) alimentado por um `data/structures/`.
- Química orgânica: novas substâncias/reações nos mesmos JSON (o leitor de fórmulas já aceita
  `CH3COOH` e similares).
- Missões: novos tipos em `OBJECTIVE_CHECKS` e um campo `missions` em `progression.json`
  (o estado salvo tem `version` para migração).
