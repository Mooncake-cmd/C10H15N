# C10H15N — jogo educativo de química

Jogo 2D de navegador no estilo *crafting*: você junta elementos, compostos e ferramentas (calor,
faísca, luz, eletricidade, catalisador) e vê **reações químicas reais**, com a equação balanceada,
o porquê, a conservação de átomos e massa, os riscos de segurança e a fonte para conferir num
livro-texto. Quando não há reação, o jogo diz isso e explica o motivo.

**Fases 1 e 2 concluídas.** 25 elementos jogáveis (os 118 aparecem na tabela), 61 compostos
curados e mais 81 gerados a partir de íons, 53 reações curadas, 17 "não-reações" curadas e um
**motor de regras** que monta e balanceia sozinho cerca de 750 reações a partir de regras gerais
(solubilidade, ácido-base, série eletroquímica, combustão, decomposição), com explicação, fonte e
segurança. Há também uma calculadora de estequiometria (massa, mol, litros de gás, solução em
mol/L e rendimento), 19 níveis de progressão e um **glossário** com mais de 240 termos: nos textos, as palavras de química ficam sublinhadas e mostram a
definição ao toque. Na tabela periódica, cada um dos 118 elementos tem **curiosidades** (leitura
complementar, com a página do livro da DK), e a tabela pode ser colorida por raio atômico,
energia de ionização, afinidade eletrônica ou eletronegatividade.

**Fase 3 concluída**: energia (3A), velocidade (3B), equilíbrio (3C), moléculas em 3D (3D), química orgânica (3E) e **missões** (3F). Cada
reação mostra ΔH°/ΔS°/ΔG°, a velocidade (dado medido, catálise ou barreira de ativação), a
constante de equilíbrio e o princípio de Le Chatelier, o Kps dos precipitados, o pH de ácidos e
bases, a forma 3D das moléculas (VSEPR, com polaridade e hibridização), os
números de oxidação (quem oxida e quem reduz), a composição em massa dos produtos com as leis de
Proust e Dalton e, quando sai H₂, O₂ ou CO₂, como identificar o gás. No topo da página ficam o
**laboratório de velocidade**, o **laboratório de equilíbrio** (pH, tampão, Kps, K/Q/Le Chatelier) e as **calculadoras** (concentração, diluição, mistura de soluções e
fórmula mínima). No painel 🗺️ **Missões**, 16 histórias com kit limitado e tentativas
contadas, montadas a partir de aulas práticas de laboratório; no 🧰 **Laboratório**, os utensílios
(com desenho e uso), a separação de misturas e o teste de chama.

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
  kinetics.json             leis de velocidade, k e parâmetros de Arrhenius (Tabelas 14.1 e 14.4) (Fase 3B)
  gas-tests.json            testes de identificação de H2, O2 e CO2
  molecules.json            nomes das formas VSEPR, hibridização, ângulos e dipolos medidos (Fase 3D)
  equilibrium.json          K (Tabela 10.2), Kw, Ka/Kb (11.1, 11.2, 11.10), indicadores (12.3), Kps (12.4) (Fase 3C)
  missions.json             missões: história, kit, tentativas, etapas e perguntas com o porquê (Fase 3F)
  lab.json                  utensílios, métodos de separação, misturas e cores no teste de chama
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
  progression.js            estado do jogador, objetivos, níveis (e as transições das missões)
  missions.js               corrida de uma missão: kit, etapas, tentativas, contas e o caminho da conta (Fase 3F)
  lab.js                    separação de misturas (método × mistura, com o porquê) e teste de chama
  balancer.js               balanceamento automático (espaço nulo com frações exatas)
  ions.js                   solubilidade, fórmula e nome de compostos iônicos, compostos derivados
  stoichiometry.js          massas, mol, litros de gás, solução, reagente limitante e rendimento
  thermo.js                 ΔH°, ΔG° e ΔS° das reações pela lei de Hess (Fase 3A)
  kinetics.js               Arrhenius, leis integradas, meia-vida; ligação com as reações do jogo (Fase 3B)
  oxidation.js              número de oxidação (Toolbox K.1) e análise de oxirredução
  composition.js            composição em massa, fórmula mínima/molecular, leis de Proust e Dalton
  solutions.js              conversão de concentração, diluição e mistura de soluções
  organic.js                grupos funcionais, nome oficial (IUPAC) e isomeria deduzidos das estruturas (Fase 3E)
  vsepr.js                  VSEPR a partir das estruturas de Lewis: pares isolados, forma, hibridização,
                            coordenadas 3D e polaridade (Fase 3D)
  equilibrium.js            K↔ΔG°, van 't Hoff, Q, Le Chatelier, pH, tampão, Kps e íon comum (Fase 3C)
  rules/reaction-rules.js   motor de regras da Fase 2
  glossary.js               acha os termos do glossário num texto (forma mais longa, palavra inteira)
  structure.js              estruturas 2D: desenho, unidade-fórmula, montagem dos lados da equação,
                            pareamento de átomos para a animação e verificações
src/ui/, src/main.js        interface
  structure-svg.js          desenha as estruturas em SVG (cores CPK)
  reaction-stage.js         animação: rearranjo dos átomos, efeitos e "não reage"
  glossary-ui.js            termos clicáveis nos textos, balão com a definição e o diálogo do glossário
  kinetics-lab.js           laboratório de velocidade (curva de concentração, meia-vida, +10 °C)
  calculators.js            calculadoras: concentração, diluição, mistura, fórmula mínima
  molecule3d.js             visualizador 3D próprio em <canvas> (esferas e bastões, pares isolados)
  molecule-card.js          cartão da molécula: 3D + explicação; usado no painel e na galeria
  equilibrium-lab.js        laboratório de equilíbrio: pH com indicadores, tampão, Kps, K/Q/Le Chatelier
  missions-ui.js            lista de missões, quadro da missão em andamento e tela de missão concluída
  lab-ui.js                 painel 🧰 Laboratório: utensílios, separação de misturas e teste de chama
  glassware-svg.js          desenhos (traço) dos utensílios de laboratório
  chem-text.js              texto com fórmulas químicas em subscrito
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

**Dado de cinética**: em `data/kinetics.json`, a reação com `reactants`/`products` (o teste confere
átomos e cargas), `order`, `rateLaw`, `kUnit`, os pontos `[[T, k]]` da tabela e/ou `arrhenius {A, Ea}`
e a fonte com página. Se houver os dois, o teste confere um contra o outro. Para ligar a uma reação
do jogo, use `game`.

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
rendimento ou calor em kJ; a resposta certa é calculada); na Fase 3, também `kinetics`, `equilibrium`,
`molecule`, `organic` (perguntas) e `mission` (concluir uma missão). O teste de progressão avisa se um objetivo ficar
impossível. Inserir um nível no meio muda os índices dos saves: suba `STATE_VERSION` em
`src/core/progression.js`; saves antigos são migrados refazendo o caminho pelo histórico.

**Nova missão**: em `data/missions.json` (o `_meta` descreve os campos). Etapas de ação
(`reaction`, `produce`, `observe`) usam as reações do jogo — se faltar uma, ela entra antes em
`reactions.json`, com fonte. Perguntas de escolha precisam do porquê de **cada** alternativa;
contas (`stoich`, `titration`) têm a resposta e o caminho calculados. O teste joga cada missão
com um jogador que só usa o kit e confere que ela fecha com uma combinação por etapa e folga de
pelo menos 2 tentativas. Para contar no jogo, ponha um objetivo `mission` num nível.

**Mistura, método de separação ou cor de chama**: em `data/lab.json`. Cada mistura tem um `type`
(sólido-líquido, sólido dissolvido, líquidos miscíveis/imiscíveis, sólidos, substância) e os
métodos que funcionam com o texto do resultado (`ok`); para os outros, a explicação vem de
`failWhy` do método pelo tipo da mistura (ou de `fails` da própria mistura). O teste confere que
toda combinação mistura × método tem explicação. Cor de chama só com fonte: sem ela, o jogo
diz que não tem a cor em vez de inventar.

**Atualizar os elementos**: troque `data/source/PeriodicTableJSON.json` e rode
`npm run build:elements`.

## Fontes

As reações citam livros-texto de química geral (Brown et al., *Química: a ciência central*;
Atkins & Jones, *Princípios de Química*; Kotz et al., *Química Geral e Reações Químicas*;
Greenwood & Earnshaw, *Chemistry of the Elements*) e o *CRC Handbook* para os potenciais-padrão.
Essas citações indicam o **tópico**, sem página. As regras da Fase 2 e as confirmações em
`seeAlso` citam **seção e página** de Atkins & Jones, *Chemical Principles*, 5. ed. (2010),
conferidas no livro.

**Greenwood & Earnshaw, *Chemistry of the Elements*, 2. ed. (1997)** — conferido com página:
regras do grupo 2 com cloro e oxigênio (o bário fica "não sei", porque também forma o peróxido
BaO2), decomposição dos carbonatos de Li, Sr e Ba (com a temperatura) e dos hidróxidos de Ca, Sr e
Ba, a síntese Fe + S, as exceções dos acetatos de Fe³⁺ e Al³⁺ e do carbonato de Fe²⁺, o motivo de o
ácido nítrico com metais continuar "não sei" e as cores de chama de Li, K, Rb e Cs.

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

## Fase 3B: velocidade das reações

`data/kinetics.json` traz as reações das Tabelas 14.1 (leis de velocidade e constantes, p. 567) e
14.4 (parâmetros de Arrhenius, p. 589) de Atkins & Jones. Com elas, `src/core/kinetics.js` calcula
k(T) pela equação de Arrhenius, as leis integradas de 1ª e 2ª ordem e a meia-vida — seguindo a
convenção dos exemplos resolvidos do livro (o k dá a taxa de consumo da espécie acompanhada).
O jogo **nunca extrapola**: fora da faixa de temperatura medida, não há k.

- **Painel "Velocidade"** em cada reação: dado medido quando existe (neutralização H₃O⁺ + OH⁻,
  CO₂ + OH⁻ — inclusive nas reações geradas pelas regras, reconhecidas pela equação iônica), o
  papel do catalisador (H₂O₂ com KI/Br₂, p. 596; ferro no processo Haber, p. 597) ou, para
  reações que precisam de faísca/calor, a barreira de energia de ativação. Sem dado: o jogo diz que
  não estima.
- **Laboratório de velocidade**: escolha a reação, a temperatura e a concentração; veja k, a
  meia-vida, a curva [A] × t e quanto +10 °C acelera.
- **Nível 14** com perguntas de cálculo (meia-vida, lei integrada, efeito da temperatura, 2ª ordem).
- Testes: as duas tabelas do livro conferem uma à outra (k medido ≈ A·e^(−Ea/RT)), a reta de
  Arrhenius pelos pontos do N₂O₅ dá os 103 kJ/mol da Tabela 14.4, e o exemplo resolvido da p. 573
  (N₂O₅ a 65 °C) é reproduzido.

## Fase 3C: equilíbrio químico

`data/equilibrium.json` traz as tabelas de Atkins & Jones: 10.2 (K de reações entre gases, p. 389),
Kw (p. 430), 11.1 e 11.2 (Ka e Kb, p. 436–437), 11.10 (ácidos polipróticos, p. 455), 12.3
(indicadores, p. 493) e 12.4 (Kps, p. 497). `src/core/equilibrium.js` faz as contas:

- **K = e^(−ΔG°/RT)** com os dados da Fase 3A, para qualquer reação do jogo; van 't Hoff para
  outras temperaturas; **Q × K** para a direção; **Le Chatelier** (concentração, pressão pelo Δn
  de gás, temperatura pelo sinal de ΔH°).
- **pH** de ácidos e bases fortes (com a autoprotólise da água) e fracos (equação de 2º grau sem
  aproximação), H₂SO₄ com a 2ª ionização, **tampão** (pH = pKa + log [base]/[ácido]), **Kps**,
  solubilidade molar e **efeito do íon comum**, cor dos indicadores.
- **Painel "Equilíbrio"** em cada reação, **laboratório de equilíbrio** (⚖️) e **nível 15** com
  perguntas de pH, tampão, Kps e Le Chatelier (múltipla escolha).
- **Testes**:
  - K × Kc em todos os pontos da Tabela 10.2;
  - a Tabela 10.2 conferida contra a termodinâmica da Fase 3A (NH₃ e SO₃ batem; o HCl diverge
    ~40× do Apêndice 2A do próprio livro, e isso está registrado e mostrado no laboratório);
  - os Kps conferidos contra a regra de solubilidade usada pelo motor (todo "insolúvel" dissolve
    menos que todo "pouco solúvel");
  - os exemplos 10.3, 10.13, 11.7, 12.1, 12.8 e o Self-Test 11.15A reproduzidos.

## Fase 3F: missões

Seis missões, misturando os três formatos combinados — histórias, desafios de laboratório com
recursos limitados e química ambiental:

| Missão | Formato | Libera depois do | O que se faz |
| --- | --- | --- | --- |
| 🎈 O gás misterioso dos balões | história | nível 8 | produzir H₂, O₂ e CO₂; densidade × massa molar; testes de identificação |
| 🔁 Do cobre ao cobre | laboratório | nível 10 | Cu → Cu(NO₃)₂ → Cu(OH)₂ → CuO → CuSO₄ → Cu; conservação da massa; o zinco como redutor |
| 🧯 Por que o CO₂ apaga o fogo? | história | nível 12 | CO₂ do bicarbonato com vinagre; litros de gás; abafamento; óleo e magnésio em chamas |
| 🫧 A água oxigenada que borbulha | laboratório | nível 14 | observar a decomposição lenta, acelerar com catalisador; o que o catalisador muda e o que não muda |
| 🧪 Quanto ácido tem o vinagre? | laboratório | nível 15 | titulação: escolher o indicador, calcular mol/L e g/L |
| 🌧️ Chuva ácida na cidade | ambiental | nível 15 | SO₂ da queima do enxofre, pH da chuva natural, ácidos no ar, ataque ao mármore |

- **Kit limitado e tentativas contadas**: durante a missão, só o kit (e o que foi produzido nela)
  vale na bancada; cada combinação e cada resposta errada gasta uma tentativa. Isso tira a
  vantagem de "combinar tudo até dar certo". Respostas certas não gastam nada. Se as tentativas
  acabam, a missão é recomeçada (o que foi descoberto fica no inventário).
- **Feedback que explica**: cada alternativa errada diz por que está errada; numa conta errada
  aparece o caminho (as fórmulas, sem o número), e na certa, a conta inteira com os números.
- **Nível 18 (Missões de laboratório)**: um objetivo por missão. As missões vão sendo liberadas
  ao longo do jogo, então quem já as fez cumpre o nível ao chegar nele.
- **Reação nova**: Cu(OH)₂ aquecido → CuO + H₂O (prática "Do cobre ao cobre" de Farias, p. 85–86;
  o Atkins & Jones traz o mesmo padrão para o Mg(OH)₂, p. 626, mas não o do cobre).
- **Fontes novas — manuais de laboratório** (`sources.json` → `_meta.labManuals`): Lenzi et al.,
  *Química Geral Experimental* (3. ed., 2024); Reis (org.), *Química Geral: práticas
  fundamentais* (Editora UFV, 2021); Farias, *Práticas de Química Inorgânica*. Dão os roteiros, as
  observações e a segurança; a química continua conferida no Atkins & Jones (densidade dos gases,
  p. 145; titulação, p. F89–F90 e 487–493; catálise, p. 413 e 595–596; chuva ácida, p. 462–463;
  carbonatos e monumentos, p. 504; magnésio e CO₂, p. 625).
- Testes (`tests/missions.test.js`): dados, cada missão concluível com o kit, regras de
  tentativa e falha, contas (0,835 mol/L; 2,45 L), o pH no fim da titulação (~9, dentro da faixa
  da fenolftaleína e fora das outras alternativas) e as massas molares citadas nos textos.

## Laboratório e mais missões (manuais de laboratório)

As partes dos manuais de laboratório que ainda não tinham sido usadas, e os itens que o usuário
tinha adiado (utensílios e separação de misturas):

- **🧰 Laboratório** (`data/lab.json`, `src/core/lab.js`, `src/ui/lab-ui.js`): 20 utensílios
  com desenho, uso e cuidados (Reis/UFV, Prática nº 1); 8 métodos de separação (decantação, funil
  de separação, filtração, evaporação, destilação simples e fracionada, ímã, dissolução
  fracionada) testáveis livremente em 7 misturas, cada combinação com o porquê (Atkins & Jones,
  seção G, p. F52–F54; Bernoulli v. 2, Frente A, Módulo 03; Lenzi, UD 10–12); e o teste de chama
  (Na, Ca, Sr, Ba, e Li, K, Rb, Cs pelo Greenwood p. 75; o HCl não dá cor). Cores sem fonte (como
  Cu) não entram.
- **10 missões novas** e o **nível 19, "Laboratório de verdade"**. Algumas são liberadas logo no
  começo do jogo e funcionam como fundamentos: 🥽 primeiro dia no laboratório (utensílio certo,
  algarismos significativos, segurança), 🏞️ água do rio (decantar/filtrar, depois destilar),
  🫗 água, óleo e álcool (funil × destilação; azeótropo), 🧲 ferro e enxofre (mistura × composto),
  🕯️ o que uma vela produz (método científico); depois 🎆 cores dos fogos (teste de chama),
  🍞 o segredo do fermento, 🔋 pilha de Daniell (1,10 V com o caminho da conta), ⚡ eletrólise
  da água e 💧 o detector de água (CuSO₄ anidro × penta-hidratado).
- Etapas novas de missão: `separate` (escolher o método para uma mistura) e `flame` (levar uma
  amostra à chama); conta nova `cell` (E°pilha = E°cátodo − E°ânodo, com a série do jogo).
- **Reações novas**: Fe + S → FeS com calor (Reis p. 45–46 do PDF; Bernoulli v. 1 p. 38; ΔfG° do
  FeS no Atkins FQ — o Atkins & Jones não traz), 2 NaHCO₃ → Na₂CO₃ + H₂O + CO₂ com calor (Farias
  p. 87–88) e CuSO₄ + 5 H₂O → CuSO₄·5H₂O (Atkins & Jones p. F31; ΔH° = −79 kJ/mol pela Tabela 2C.7;
  Farias p. 65–66 mede −78,5). Substâncias novas: FeS e o hidrato CuSO₄·5H₂O (novo tipo de
  desenho `hydrate`; NOX do sal + água).
- **Glossário**: misturas homogênea/heterogênea, filtração, decantação, destilação, evaporação,
  azeótropo, hidrato, menisco, algarismos significativos, hipótese, método científico, pilha,
  ânodo, cátodo, ponte salina e teste de chama.
- Testes: `tests/lab.test.js` (utensílios, toda combinação mistura × método explicada, a química
  de cada separação, cores de chama com fonte, 1,10 V) e as missões novas jogadas pelo "jogador
  esperto" do teste (só o kit, uma tentativa por etapa).

## Fase 3E: química orgânica

- **15 compostos orgânicos novos** (eteno, etino, etano, metanol, metoximetano, etanal, propanona,
  acetato de etila, clorometano, cloroetano, 1,2-dicloroetano, butano, metilpropano, propan-1-ol,
  propan-2-ol), com estrutura de Lewis — e, por isso, com forma 3D, NOX e polaridade automáticos.
- **`src/core/organic.js`** deduz da estrutura: os **grupos funcionais** (Tabela 19.1), a
  **função principal**, o **nome oficial IUPAC** com cada pedaço explicado (prefixo + infixo +
  sufixo; localizadores só quando precisa: "propan-2-ol", mas "propanona"; ésteres como
  "etanoato de etila"; éteres como "metoximetano") e os **isômeros** do jogo, com o tipo de
  isomeria plana (função, cadeia, posição). O teste confere que o nome deduzido é o nome escrito
  à mão para cada composto.
- **8 reações curadas** do Atkins & Jones, caps. 14, 18 e 19: substituição (CH₄ + Cl₂ com luz,
  p. 744), adições ao eteno (H₂ com níquel, p. 597; Cl₂, p. 746; HCl, p. 747; H₂O com ácido
  fosfórico, p. 763), esterificação (p. 766), o vinho que vira vinagre (p. 765; com o
  *Acetobacter* do Bernoulli v. 1, p. 8) e a combustão do etanol (p. 270). Tipos novos de reação:
  adição, substituição e condensação.
- **NOX átomo por átomo** nas moléculas (Bernoulli v. 4, p. 31): cada ligação dá os elétrons ao
  átomo mais eletronegativo. Uma reação só é oxirredução quando muda o NOX dos átomos **e** a
  média de cada molécula — assim a esterificação e a adição de H₂O/HCl ao eteno não viram
  "redox", mas o desproporcionamento da água oxigenada continua sendo. A varredura de ~700
  reações confere isso.
- No cartão de cada molécula (painel e galeria 🧊), um bloco **"Química orgânica"**; **nível 17**
  com adição, substituição, esterificação, nome oficial, função e isomeria.
- Divergência registrada: a Tabela 2C.6 do Atkins FQ dá ΔcH° = −2231 kJ/mol para o acetato de
  etila, mas o seu ΔfH° leva a −2238 kJ/mol pela lei de Hess.

## Fase 3D: moléculas em 3D

A forma das moléculas **não é digitada**: `src/core/vsepr.js` a deduz das estruturas de Lewis que
já existiam (`structures.json`). Para cada átomo, conta os elétrons de valência, as ligações (uma
dupla ou tripla conta como uma região) e a carga formal, e daí os pares isolados e as regiões
(Atkins & Jones, seções 3.1–3.2, p. 94–100). Com isso vêm a notação AXE, o arranjo eletrônico, a
forma (Fig. 3.1), a hibridização (Tabela 3.2, p. 109) e as **coordenadas 3D**, montadas átomo a
átomo com as direções ideais de cada arranjo. A **polaridade** é a soma vetorial dos dipolos das
ligações (diferença de eletronegatividade), com a ligação C–H tratada como praticamente apolar
(Bernoulli v. 2, p. 78).

- **Visualizador 3D próprio** (sem bibliotecas), em `<canvas>`: gira arrastando ou com as setas,
  mostra os pares isolados e respeita "reduzir movimento".
- **Painel "Forma das moléculas (3D)"** em cada reação (abas com as moléculas e íons
  poliatômicos) e **galeria** 🧊 com as 26 moléculas e íons do jogo.
- **Nível 16** com perguntas de forma, pares isolados, polaridade e hibridização.
- **Testes**: formas e notações AXE dos exemplos do livro (CH₄, H₂O, NH₃, CO₂, SO₂, NO₃⁻, CO₃²⁻,
  SO₄²⁻, NH₄⁺), octeto em toda estrutura, ângulos ideais em toda a geometria 3D sem átomos
  sobrepostos, polaridade prevista × momentos de dipolo medidos (Tabela 3.1, p. 102) e ângulos
  medidos menores que os ideais quando há pares isolados (p. 95).

## Itens das apostilas do ensino médio

O mapeamento das apostilas Bernoulli (v. 1–6) está no `CLAUDE.md`. Já entraram:

- **Propriedades periódicas** (v. 2, Módulo 06): a tabela pode ser colorida por raio atômico
  (covalente), energia de ionização, afinidade eletrônica e eletronegatividade, com escala e a
  tendência explicada. Os dados vêm do dataset aberto; os testes conferem as tendências.
- **NOX** (v. 4, Módulo 13; Atkins & Jones, Toolbox K.1, p. F80): cada reação mostra o número de
  oxidação de cada substância e quem oxida e quem reduz. Compostos iônicos são resolvidos íon por
  íon. Um teste varre as ~700 reações (curadas e geradas) e confirma: NOX muda ⇔ a reação está
  marcada como oxirredução.
- **Testes de gases** (v. 5, p. 49): palito aceso para H₂, palito em brasa para O₂, água de cal
  para CO₂ (`data/gas-tests.json`).
- **Leis de Proust e Dalton, composição centesimal, fórmula mínima** (v. 1, Módulos 01 e D02;
  Atkins & Jones, seção F): no painel de cada reação e na calculadora; os testes reproduzem os
  Exemplos F.1–F.4.
- **Concentração (g/L, mg/L ≈ ppm, % m/V), diluição e mistura** (v. 5, Módulos 09–10; Atkins &
  Jones, seção G.4): nas calculadoras; o teste reproduz o Exemplo G.4.

As apostilas são **fonte secundária** (`sources.json`, `_meta.secondary`): linguagem de iniciante e
convenções brasileiras; o que vem delas é conferido em Atkins & Jones.

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
- Termodinâmica (3A) e cinética (3B): prontas, como dados à parte (`thermo.json`,
  `kinetics.json`) e painéis novos em `src/ui/`, sem mudar as reações nem os testes de conservação.
- Equilíbrio (3C): pronto, no mesmo formato (`equilibrium.json`, painel, laboratório, objetivo).
- Moléculas 3D (3D): pronto, com renderizador próprio e geometria deduzida pelo VSEPR.
- Química orgânica (3E): pronta, com nomes, funções e isomeria deduzidos das estruturas.
- Missões (3F): prontas, como dados à parte (`missions.json`), um módulo puro (`missions.js`), o
  tipo de objetivo `mission` e campos novos no estado salvo (`missionsDone`, `missionRun`), sem
  mudar a versão do save.
