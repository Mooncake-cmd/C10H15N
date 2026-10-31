# C10H15N — jogo educativo de química

Jogo 2D de navegador no estilo *crafting*: você junta elementos, compostos e ferramentas (calor,
faísca, luz, eletricidade, catalisador) e vê **reações químicas reais**, com a equação balanceada,
o porquê, a conservação de átomos e massa, os riscos de segurança e a fonte para conferir num
livro-texto. Quando não há reação, o jogo diz isso e explica o motivo.

**Fases 1 e 2 concluídas.** 25 elementos jogáveis (os 118 aparecem na tabela), 44 compostos
curados e mais 81 gerados a partir de íons, 41 reações curadas, 17 "não-reações" curadas e um
**motor de regras** que monta e balanceia sozinho cerca de 750 reações a partir de regras gerais
(solubilidade, ácido-base, série eletroquímica, combustão, decomposição), com explicação, fonte e
segurança. Há também uma calculadora de estequiometria (massa, mol, litros de gás, solução em
mol/L e rendimento), 13 níveis de progressão e um **glossário** com mais de 140 termos: nos textos, as palavras de química ficam sublinhadas e mostram a
definição ao toque. Na tabela periódica, cada um dos 118 elementos tem **curiosidades** (leitura
complementar, com a página do livro da DK).

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
- **Balanceamento automático** reproduz os coeficientes de todas as reações curadas e recusa
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
  thermo.json               ΔfH°, ΔfG° e S° a 298 K por espécie e estado (Fase 3A), com livro e página
  element-facts.json        curiosidades dos 118 elementos (leitura complementar, livro da DK, com página)
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
  stoichiometry.js          massas, mol, litros de gás, solução, reagente limitante e rendimento
  thermo.js                 ΔH°, ΔG° e ΔS° das reações pela lei de Hess (Fase 3A)
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
| metal alcalino + cloro → cloreto | 2 K + Cl2 → 2 KCl | 15.5, p. 621 |
| combustão completa de compostos de C, H (e O) | C2H5OH + 3 O2, C3H8 + 5 O2 | H e M, p. F64 e F95; etanol, p. 270 |

E as exceções que viram `unknown` em vez de uma equação errada, quase todas com a página do livro
na própria explicação: Ag⁺ + OH⁻ forma Ag2O (p. 389; com NaOH é a reação curada `agno3-naoh`),
NH4⁺ + OH⁻ forma NH3 (p. 425), carbonatos de Cu²⁺ e Zn²⁺ são básicos (p. 677–679), Fe³⁺ e Al³⁺ são
cátions ácidos (p. 450), bicarbonatos sólidos só do grupo 1 e NH4⁺ (p. 351), metais anfóteros em
base forte (p. 429, 626, 679), ácido nítrico com metais (o caso Cu + HNO3 diluído da p. 519 é
curado), metais que atacam a água fria — grupo 1, Ca, Sr, Ba (p. 621, 625) —, Al e Mg que não se
depositam a partir de água (p. 543–544), compostos pouco solúveis, água régia e mistura sulfonítrica.

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

**Curiosidade de elemento**: em `data/element-facts.json`, pelo símbolo: `summary` (descrição
curta), `facts` (1 a 4 curiosidades) e `pages` (páginas do livro da DK). Escreva com suas
palavras — nada de tradução ou cópia do livro. O livro é de divulgação: quando ele divergir de um
livro-texto ou do dataset dos elementos, vale o livro-texto, e a correção vai para
`_meta.corrections`. Os testes conferem cobertura, páginas e algumas afirmações numéricas contra
`data/source/`.

**Novo elemento jogável**: crie a forma elementar em `substances.json` (campo `elementOf`) e
desbloqueie-o em algum nível de `progression.json`. Os dados físicos já estão em `elements.json`.

**Nova regra ou novo íon**: íons e solubilidade em `data/ions.json` (pares que não formam o
composto esperado vão em `anomalies`); textos, fontes e segurança das regras em
`data/rules.json`; a lógica em `src/core/rules/reaction-rules.js`. A varredura de todos os pares
em `tests/rules.test.js` confere tudo o que a regra nova passar a gerar — antes de confiar,
revise uma amostra das equações geradas.

**Novo nível/objetivo**: em `progression.json` (cada nível tem `phase`). Tipos de objetivo:
`produce`, `produceCategory`, `reactionType`, `nonReaction`, `reaction`, `thermo` (fazer uma reação
que libera ou absorve calor) e `stoich` (pergunta de estequiometria em g, mol, L de gás, solução,
rendimento ou calor em kJ; a resposta certa é calculada). O teste de progressão avisa se um objetivo ficar
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

## Fase 3A: energia das reações

Cada reação mostra **ΔH°** (calor liberado ou absorvido), **ΔS°** e **ΔG°** a 25 °C, calculados pela
lei de Hess a partir de `data/thermo.json`. Os dados vêm da Tabela 2C.7 do *Atkins' Physical
Chemistry* (12. ed.) e, onde ela não tem a espécie, do Apêndice 2A de Atkins & Jones; as duas
tabelas foram comparadas e concordam em 107 de 110 espécies em comum. Compostos iônicos
dissolvidos sem linha própria são a soma dos íons. Quando falta o dado de uma espécie, o jogo diz
"sem dado conferido" — nunca estima. Os testes conferem: ΔfG° = ΔfH° − T·ΔfS° para todo composto
(pega colunas trocadas), combustões calculadas contra as entalpias de combustão medidas, exemplos
dos livros (metano −890 kJ, etanol −1368 kJ) e que nenhuma reação marcada como exotérmica ou
endotérmica — curada ou gerada pelas regras — tenha o sinal de ΔH° trocado.

## Curiosidades dos elementos

Ao clicar num elemento da tabela periódica, o painel mostra uma descrição curta e algumas
curiosidades (origem do nome, descoberta, onde aparece, para que serve), escritas para o jogo a
partir da leitura de *The Periodic Table Book* (DK, 2017) e citadas com a página. É **leitura
complementar**: o livro não é fonte de nenhuma reação nem dado do jogo. Onde ele erra ou simplifica
demais (ex.: data de descoberta do hélio, "o argônio não reage com nada", carbonato de cálcio
chamado de álcali, meia-vida do bismuto), o texto foi corrigido e a correção está registrada em
`data/element-facts.json` (`_meta.corrections`). Termos novos que as curiosidades usam
(radioatividade, meia-vida, fissão nuclear, minério, lantanídeo, actinídeo, espectro…) entraram no
glossário com a página de Atkins & Jones.

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
