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
  rendimento. **Resolvido com o Greenwood** (2. ed., recebido completo): páginas para o acetato
  básico de Fe³⁺ (p. 1090), o acetato de Al³⁺ (hidrólise, p. 225) e o carbonato de Fe²⁺ (p. 1092);
  regra grupo 2 + Cl2 → MCl2 e + O2 → MO (Be, Mg, Ca, Sr; Ba fica "não sei" porque forma BaO2,
  p. 112–113, 121); decomposição de carbonatos de Li, Sr e Ba (temperaturas da p. 114) e de
  hidróxidos de Ca, Sr e Ba (p. 119); Fe + S com fonte (p. 662, 649). **Ainda em aberto**:
  **Resolvido com pesquisa na internet + Greenwood** (nov. 2026): carbonato básico de Mg²⁺ (fonte da
  internet, Wikipédia); limite de deposição em água passou de −1,0 V para −1,5 V, entre o Mn (−1,18 V,
  eletrodepositado industrialmente — Reyes-Morales et al., RSC Advances 2021/2022) e o Al (−1,66 V),
  sem mudar nada para os metais do jogo; Fe + Cl2 → FeCl3 (Greenwood p. 1084), Zn + Cl2 → ZnCl2 e
  Zn + O2 → ZnO (p. 1205) curados; cu-o2 corrigido (p. 1181: CuO e Cu2O se formam no aquecimento, o
  Cu2O predomina em alta temperatura); Cu(OH)2 → CuO confirmado por artigo (Fukuda, Favergeon e
  Koga); cor de chama do cobre (verde; verde-azulada nos haletos — MFA CAMEO/Wikipédia, marcada
  como fonte da internet). **Ainda em aberto**:
  1. Exceções: nenhuma sem fonte (a do Mg²⁺ é só da internet).
  2. Metais de transição + O2/Cl2 sem regra geral: Cu + Cl2 (sem página de livro para CuCl2 × CuCl)
     e Fe + O2 (três óxidos de composição variável, Greenwood p. 1079; a reação curada fe-o2, do
     Brown, usa Fe2O3 como simplificação).
  3. Regras só para pares; combinações de 3+ substâncias não passam pelo motor (é decisão de
     projeto, não de fonte).
  4. Ácido nítrico + outros metais continua "não sei": o Greenwood (p. 467, 1206) confirma que depende
     da concentração e da temperatura (e da passivação de Al, Cr, Fe), mas não dá os produtos metal a
     metal; exemplos de sites de vestibular (Zn → NH4NO3 no muito diluído; Mg e Mn → H2) não entram
     como fonte.
- **Fontes da internet** (`sources.json` → `_meta.web`): artigos revisados por pares valem como
  confirmação; Wikipédia e enciclopédias de museu só para dados simples e sempre marcadas como fonte
  da internet; sites de vestibular nunca. Neste ambiente a busca funciona, mas abrir as páginas
  (wikipedia.org, pubs.rsc.org etc.) está bloqueado pela rede; citações completas vêm da busca.
- **Fase 3 (avançado) — CONCLUÍDA**, em etapas publicadas uma a uma:
  - **3A Energia — CONCLUÍDA**: ΔH°/ΔS°/ΔG° pela lei de Hess (`data/thermo.json`, `src/core/thermo.js`),
    painel "Energia", calor na calculadora, nível "Energia das reações". Dados: Atkins FQ 12. ed.
    (Tabela 2C.7) + Atkins & Jones (Apêndice 2A). No PDF do Atkins & Jones o sinal de menos vem como
    o caractere `\x06` — trocar por "-" antes de ler números.
  - **3B Velocidade — CONCLUÍDA**: `data/kinetics.json` (Tabelas 14.1, p. 567, e 14.4, p. 589 de
    Atkins & Jones), `src/core/kinetics.js` (Arrhenius, leis integradas, meia-vida; o k é a taxa de
    consumo da espécie acompanhada, como nos exemplos do livro; nunca extrapola fora da faixa
    medida), painel "Velocidade", laboratório de velocidade e nível 14.
  - **Itens baratos das apostilas — FEITOS** (junto da 3B): propriedades periódicas na tabela, NOX
    em cada reação (`src/core/oxidation.js`; teste: NOX muda ⇔ marcação redox em todas as ~700
    reações), testes de gases (`data/gas-tests.json`), Proust/Dalton/composição/fórmula mínima
    (`src/core/composition.js`), concentração/diluição/mistura (`src/core/solutions.js`) e o
    diálogo de calculadoras.
  - **3C Equilíbrio — CONCLUÍDA**: `data/equilibrium.json` (Tabelas 10.2, 11.1, 11.2, 11.10, 12.3,
    12.4 e Kw), `src/core/equilibrium.js` (K pelo ΔG° da 3A, van 't Hoff, Q, Le Chatelier, pH exato,
    tampão, Kps, íon comum), painel "Equilíbrio", laboratório de equilíbrio e nível 15. Divergência
    do livro registrada: Tabela 10.2 × Apêndice 2A para o HCl (~40×).
  - **3D Moléculas 3D — CONCLUÍDA**: `src/core/vsepr.js` deduz pares isolados, AXE, forma,
    hibridização, coordenadas 3D e polaridade das estruturas de Lewis de `structures.json`;
    `data/molecules.json` (Fig. 3.1, Tabelas 3.1 e 3.2, ângulos medidos); visualizador próprio em
    canvas (`src/ui/molecule3d.js`), painel "Forma das moléculas", galeria 🧊 e nível 16. Ligação
    C–H tratada como praticamente apolar (Bernoulli v. 2 p. 78). Ainda não feito: interações
    intermoleculares (v. 3 C12) — item "médio".
  - **3E Orgânica — CONCLUÍDA**: 15 compostos novos com estrutura; `src/core/organic.js` deduz
    grupos funcionais, nome IUPAC (com o significado de cada pedaço) e isomeria (função, cadeia,
    posição); 8 reações curadas (A&J caps. 14, 18–19) e tipos novos `adicao`, `substituicao`,
    `condensacao`; nível 17. **NOX agora é átomo por átomo** nas moléculas com estrutura
    (Bernoulli v. 4 p. 31), e uma reação só é redox se mudam o NOX dos átomos E a média de cada
    molécula (esterificação e adição de HCl/H2O ao eteno não são; desproporcionamento é).
    Divergência do livro registrada: ΔcH° do acetato de etila (Atkins FQ, Tabela 2C.6).
  - **3F Missões — CONCLUÍDA**: mistura dos 3 formatos que o usuário aprovou (história, laboratório
    com recursos limitados, ambiental). `data/missions.json` (6 missões: balões H2/O2/CO2, do cobre
    ao cobre, CO2 e extintores, água oxigenada e catalisador, titulação do vinagre, chuva ácida),
    `src/core/missions.js` (kit limitado, tentativas — cada combinação e cada resposta errada gasta
    uma —, etapas de ação em grupo ou em ordem, contas `stoich`/`titration` com o caminho mostrado),
    painel 🗺️ (`src/ui/missions-ui.js`), objetivo `mission` e nível 18 (n17). Cada alternativa errada
    explica o porquê; conta errada mostra o caminho sem o número. Reação nova: Cu(OH)2 + calor →
    CuO (Farias p. 85–86; o A&J não tem a do cobre — ideal conferir no Greenwood).
  - **Laboratório e mais missões — CONCLUÍDO** (pedido do usuário: aplicar as partes não usadas dos
    manuais e os itens adiados): painel 🧰 com 20 utensílios, 8 métodos de separação × 7 misturas
    (cada combinação explicada) e teste de chama; 10 missões novas (etapas `separate`/`flame`, conta
    `cell`) e nível 19 (n18, "Laboratório de verdade"); reações Fe + S → FeS, NaHCO3 + calor e
    CuSO4 + 5 H2O → CuSO4·5H2O; desenho `hydrate`. Algumas missões são liberadas logo depois do
    nível 1 (fundamentos: utensílios, medidas, separação, método científico).
- **Fase 4 (aprendizagem) — CONCLUÍDA**, em etapas publicadas uma a uma (recomendação aprovada
  pelo usuário):
  - **4A Fundamentos — CONCLUÍDA**: 5 níveis antes do n1 (`f1`–`f5`, `phase: 4`,
    `phaseLabel: "Fundamentos"`, `since: 3`): matéria/misturas e mudança física × química, átomo
    (prótons, nêutrons, isótopos, massa atômica), elétrons (camadas, diagrama de Pauling, valência),
    estados físicos e mudanças de estado, nomes e fórmulas de compostos iônicos. Tipos de objetivo
    `quiz`, `atom`, `electrons`, `state`, `naming` (`src/core/fundamentals.js`; resposta calculada,
    o porquê de cada alternativa e dos erros comuns sem entregar a resposta). Save v3: níveis com
    `since` maior que a versão do save contam como feitos para quem já jogava (o jogador não volta
    ao começo). Os desbloqueios do n1 passaram para o f1. Fonte: Kotz v. 1 com página; Bernoulli
    v. 1 p. 61–62 para camadas/diagrama. Missões de fundamentos continuam liberadas depois do n1.
  - **4B Degraus intermediários — CONCLUÍDA**: d1 "Contas da química" antes do n10 (expoente da
    notação científica, algarismos significativos, mol; tipo `math`), d2 "Rápido ou devagar" antes
    do n13 (fatores da velocidade, Kotz p. 622–623) e d3 "Ida e volta" antes do n14 (equilíbrio
    dinâmico, Le Chatelier, pH com potências de 10 e fator 10 por unidade; Kotz p. 124–126,
    191–192, 697). Regra: nível com `since` só pode ter perguntas (tipos de `FUNDAMENTAL_TYPES`),
    senão a migração do save mandaria o jogador de volta (há teste).
  - **4C Revisões espaçadas — CONCLUÍDA**: `src/core/review.js` (caixas de Leitner; relógio = nível
    atual; intervalos 1, 2, 4, 8 níveis; 4 acertos e a pergunta sai; erro volta para a caixa 0;
    até 3 por vez, de níveis diferentes). Caixa 🔁 acima dos objetivos, opcional, nunca muda os
    objetivos dos níveis. Campo `reviews` no estado (sem mudar a versão do save; pergunta sem
    registro = caixa 0, vence no nível seguinte ao dela). Ideia para depois: perguntas próprias de
    revisão no modelo das "Questões para estudo" do Kotz (respostas no Apêndice N).
  - **4D Tentativas e laboratórios — CONCLUÍDA**: `src/core/guard.js`. Perguntas de escolha têm menos
    tentativas que alternativas (n/2, mínimo 1); de conta, 3. Esgotadas, a pergunta descansa até
    outro objetivo ou uma revisão certa (`attempts`, `reviewHits`); nunca trava o nível.
    Laboratórios de velocidade/equilíbrio e a calculadora de estequiometria escondem só o número
    final (mostram o caminho) quando a configuração é uma pergunta pendente do nível atual
    (`pendingQuestion`). Ideias para depois: limitar combinações nos objetivos de bancada (hoje
    ainda dá para "combinar tudo"), perguntas próprias de revisão.
  - **Curiosidades dos elementos — CONCLUÍDA**: os 118 elementos têm descrição e curiosidades no
    painel da tabela periódica (`data/element-facts.json`), escritas com palavras próprias a partir
    do livro da DK (*The Periodic Table Book*, 2017), como leitura complementar com página. Erros do
    livro foram corrigidos e registrados em `_meta.corrections`; o livro nunca é fonte de reação.

## Plano combinado com o usuário (ordem)

1. ~~Terminar a Fase 3~~ — feito (3A–3F). Mais missões podem entrar a qualquer momento (ideias abaixo).
2. ~~**Fase 4 — aprendizagem**~~ — feito (4A–4D; ver acima). Pedido original do usuário, depois da Fase 3, para que um iniciante aprenda
   de verdade ao terminar os níveis:
   - **Fundamentos** no começo do jogo: átomo e distribuição eletrônica, estados da matéria,
     misturas, nomenclatura (itens "médios" das apostilas abaixo).
   - **Degraus intermediários** na Fase 3, para a dificuldade subir aos poucos (hoje o salto para
     logaritmos/exponenciais nos níveis 13–15 é grande).
   - **Revisões**: perguntas que voltam depois e misturam assuntos (revisão espaçada).
   - Problemas já identificados: dá para cumprir objetivos combinando tudo por tentativa, e os
     laboratórios mostram a resposta pronta das perguntas de cálculo (mostrar o caminho da conta
     e pedir raciocínio, com explicação do erro). Resolvido na 4D para as perguntas; os objetivos
     de bancada ("produza X") ainda aceitam tentativa e erro.
3. **Guardados para depois** (o usuário pediu para não perder): as pendências da Fase 2 (acima),
   os itens "médios" das apostilas e as etapas novas possíveis — listados na seção abaixo. (Os
   itens adiados, utensílios e separação de misturas, já foram feitos.)

## Apostilas Bernoulli (ensino médio) — mapeamento

O usuário enviou *Coleção Estudo – Química*, v. 1–6 (Editora Bernoulli; sem ISBN/ano na cópia, os
exercícios citam vestibulares até 2010). Citar como "Bernoulli, Química, v. X, Frente Y, Módulo Z,
p. N" (página impressa = página do PDF). Papel: **fonte secundária** para linguagem de iniciante e
convenções brasileiras (NOX, nomenclatura, "síntese/análise"); reação ou dado tirado delas tem de
ser conferido no Atkins & Jones (há erros: v. 5 p. 52 dá Al₂O₃ + 3 CO → 2 Al + 3 CO₂, mas o Al sai
por eletrólise; o quadro do v. 5 p. 49 generaliza demais a decomposição de oxissais).

- **Já no jogo**: reações e classificação, solubilidade, ácido-base de Arrhenius, série de
  reatividade (v. 4–5 Frente C); estequiometria (v. 1 D01–D03); termoquímica/Hess (v. 2–4 Frente A).
- **No plano**: 3B cinética (v. 2 B04; v. 3 B05–B06; v. 4 B07–B08); 3C equilíbrio (v. 5 C20;
  v. 6 C21–C24); 3D geometria/polaridade (v. 3 C10); 3E orgânica (v. 1 D04; v. 2 D05–D08;
  v. 3 D09–D12 com isomeria plana; v. 4 D13–D16 com isomeria espacial; v. 5 D17–D20; v. 6 D21–D22).
- **Itens baratos (FEITOS com a 3B)**: propriedades periódicas — raio, energia de
  ionização, afinidade eletrônica (v. 2 C06; dados já no dataset aberto); fórmula mínima/molecular
  e composição centesimal (v. 1 D02); concentração g/L, %, ppm, diluição e mistura (v. 5 A09–A10);
  leis de Proust e Dalton (v. 1 C01); NOX em cada oxirredução (v. 4 C13); testes de identificação
  de H₂, O₂ e CO₂ (v. 5 p. 49).
- **Médios (fora do plano)**: balanceamento manual pelo jogador (v. 5 C19); nomenclatura de
  ácidos, bases, sais e óxidos (v. 4 C14–C16, v. 5 C17); mudanças de estado e densidade
  (v. 1 A02); modelos atômicos e distribuição eletrônica (v. 1 C01–C04); ligação metálica e
  interações intermoleculares (v. 3 C11–C12, junto da 3D); energia de ligação (v. 3 A06, só como
  estimativa explícita); coeficiente/curvas de solubilidade (v. 4 A08); efusão e difusão
  (v. 2 B03); ácidos e bases de Lewis (v. 4 D15).
- **Etapas novas possíveis (depois da 3E, ordem a decidir)**: eletroquímica — pilhas, ddp,
  eletrólise, Faraday (v. 5 B09–B10, v. 6 B11; aqui entraria a pilha de mercúrio); coligativas e
  coloides (v. 6 A11–A12); reações nucleares (v. 6 B12; A&J cap. 17); química ambiental
  (v. 6 D23–D24, tema para as missões 3F); metalurgia (v. 5 p. 52–53).
- **Adiado pelo usuário — FEITO**: utensílios de laboratório e separação de misturas (v. 2 A03 —
  filtração, decantação, destilação; centrifugação ficou de fora).
- **Pendências da Fase 2**: o quadro do v. 5 p. 49 dá pistas (hidreto/peróxido/superóxido + água,
  decomposição de hidróxidos e oxissais, ustulação), mas cada regra precisa de confirmação no
  A&J/Greenwood; HNO₃ + metais e carbonatos básicos não são resolvidos pelas apostilas.

## Kotz (enviado para a Fase 4) — mapeamento

**Kotz, Treichel, Townsend e Treichel, *Química Geral e Reações Químicas*, tradução da 9. ed.
norte-americana, Cengage, 2015** (`kotz`). v. 1: ISBN 978-85-221-1628-1 (caps. 1–13); v. 2: ISBN
978-85-221-1630-4 (caps. 14–25, a partir da p. 616). PDF escaneado: OCR com `tesseract -l por`;
página impressa = página do PDF − 27 (v. 1) e + 589 (v. 2). A numeração continua entre os volumes,
então citar só a página. Papel: fonte principal dos fundamentos e dos degraus (linguagem de
iniciante, em português); reações continuam conferidas no Atkins & Jones/Greenwood.
- **v. 1**: cap. 1 (p. 1–25) — química verde p. 6, misturas p. 8–9, elementos/compostos p. 10–11,
  mudança física × química p. 15 (H2 + O2 do balão); Revisão (p. 26–53) — notação científica e
  algarismos significativos p. 36–41; cap. 2 — átomo p. 55–57 (sódio-23), isótopos p. 58, peso
  atômico p. 60–61 (cloro 35,45), íons p. 76–77, fórmulas p. 79, nomes p. 81–82 (romanos p. 81);
  cap. 3 — balanceamento p. 121, introdução ao equilíbrio p. 124; cap. 4 — economia atômica
  p. 180, escala de pH p. 191; cap. 5 — mudanças de estado p. 233, gelo-seco sublima p. 237;
  cap. 6 — cores dos fogos p. 287; cap. 7 — configuração p. 314, valência p. 316, íons p. 323;
  caps. 8–9 ligações; cap. 10 efusão p. 478; cap. 11 forças intermoleculares p. 496–533; cap. 12
  ligação metálica p. 550, diagramas de fase p. 561; cap. 13 solubilidade p. 583, coligativas
  p. 588, coloides p. 602; Apêndice A, logaritmos p. A-2.
- **v. 2**: cap. 14 cinética (p. 616; 14-1/14-2 qualitativo, 14-4 leis integradas); cap. 15
  equilíbrio (p. 676; Le Chatelier p. 697, Haber-Bosch p. 701); caps. 16–17 pH p. 719, tampão
  p. 776, titulação p. 784, ácidos de Lewis p. 752; cap. 19 eletroquímica (eletrólise p. 907,
  Faraday p. 913); cap. 20 os 12 princípios da química verde p. 961, CO2 p. 958, cloração p. 939;
  caps. 21–23 dureza da água p. 988, polímeros p. 1114, PET p. 1120; cap. 25 nuclear p. 1168.
- **Já usado**: fundamentos da 4A (caps. 1, 2, 5 e 7) e degraus da 4B (Revisão p. 36–38; cap. 2
  p. 88–90; cap. 3 p. 124–126; cap. 4 p. 191–192; cap. 14 p. 622–623; cap. 15 p. 697).

## Manuais de laboratório (enviados para a 3F) — mapeamento

Fontes de **roteiro, observação e segurança** (`sources.json` → `_meta.labManuals`); a química de
cada reação continua conferida no Atkins & Jones.
- **Lenzi et al., *Química Geral Experimental*, 3. ed., Freitas Bastos, 2024** (`lenzi`; EPUB sem
  página impressa → citar por Unidade Didática, "UD 01"). 28 UDs: laboratório e segurança,
  vidraria, bico de Bunsen, método científico (observar uma vela), medidas e algarismos
  significativos, **separação de misturas (UD 10–12)**, propriedades físicas, soluções e
  padronização, **análise pela chama (UD 19)**, reações (UD 20–22), cinética, equilíbrio/Kps,
  calor de reação, eletroquímica (UD 28).
- **Reis (org.), *Química Geral: práticas fundamentais*, Editora UFV, 2021** (`reis-ufv`; páginas
  do PDF, sem numeração impressa). Segurança e primeiros socorros (p. 16: fogo em óleo/elétrico)
  e 14 práticas: materiais de laboratório, pureza/fracionamento, soluções, reações e energia,
  obtenção/purificação, família periódica, equilíbrio, velocidade, catálise (nº 9, p. 89–91),
  ácido-base, titulação (nº 11, p. 107), oxirredução, pilhas, eletrólise.
- **Farias, *Práticas de Química Inorgânica*** (`farias`; cópia digitalizada sem editora/ano/ISBN).
  41 sínteses; usada "Do cobre ao cobre" (p. 85–86). Há práticas perigosas ou avançadas demais
  para iniciantes (solução sulfocrômica, HF/ácido hexafluorossilícico, compostos de coordenação).
- **Página do Lenzi**: o EPUB não traz número em toda página; a página = número do arquivo
  `eb-N` + 0 (parte 1), +236 (parte 2) ou +486 (parte 3) — confere com os números impressos.
- **Já usados**: segurança (fogo, respingos), catálise da H2O2, titulação, do cobre ao cobre,
  utensílios (UFV Prática 1), separação de misturas (UFV Prática 2; Lenzi UD 10–12), algarismos
  significativos (Lenzi UD 04, p. 130–132), método científico com a vela (Lenzi UD 03), análise
  pela chama (Lenzi UD 19; cores do A&J p. 50 e 625 e do Bernoulli v. 1 p. 53), pilha e eletrólise
  (UFV Práticas 13–14), NaHCO3 → Na2CO3 (Farias p. 87–88), hidratação do CuSO4 (Farias p. 65–66).
- **Ainda não usados**: síntese de HCl e Cl2 (perigosas e precisam de substâncias novas, como
  MnO2/KMnO4), cores de chama de K, Li e Cu (sem fonte de livro-texto ainda), cristalização,
  cromatografia, Faraday (quantidade de eletricidade) — ficam para a etapa de eletroquímica.
- **Adiados pelo usuário — FEITOS**: utensílios de laboratório e separação de misturas.
- **Greenwood & Earnshaw, *Chemistry of the Elements*, 2. ed. (1997)** — recebido (RAR em 8 partes;
  PDF escaneado, sem texto: ler com OCR — `pdfimages -tiff` + `tesseract -l eng`; a página impressa
  está no cabeçalho de cada página, e a imagem N do PDF corresponde à página impressa ~N−16 a
  N−22, conforme o trecho). Já usado: cores de chama de Li, K, Rb, Cs (p. 75) e de Ca/Sr/Ba (p. 108),
  grupo 2 (p. 112–121), Fe + S (p. 649, 662), acetatos/carbonatos de Fe e Al (p. 225, 1090, 1092),
  HNO3 (p. 467). Não resolve: Cu(OH)2 → CuO (p. 1181 só diz que o CuO se obtém calcinando o
  nitrato ou o carbonato básico; fonte continua o Farias), a cor de chama do cobre (p. 867 fala
  só do CuCl azul nos fogos) e o carbonato básico de Mg. Útil para o futuro: vidro e silicatos
  (p. 345–346, "vidro feito da terra") e cloro/hipoclorito (cap. 17, p. 789+, "água sanitária").
- **Vídeos do canal Bounty Breaker** (pedido do usuário, ainda não aplicados): "X feito de Y" vira
  missão em várias etapas. Avaliado: vidro da terra (viável), bala de banana/éster (viável),
  baunilha das fezes (só separação/identificação), dinamite da picanha (só a saponificação; a
  nitroglicerina só como explicação, sem reação nem roteiro), refrigerante zero da água sanitária
  (aguarda transcrição). O usuário pode mandar as transcrições.

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
