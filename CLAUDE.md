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
  - Próxima: **Fase 4 (aprendizagem)**.
  - **Curiosidades dos elementos — CONCLUÍDA**: os 118 elementos têm descrição e curiosidades no
    painel da tabela periódica (`data/element-facts.json`), escritas com palavras próprias a partir
    do livro da DK (*The Periodic Table Book*, 2017), como leitura complementar com página. Erros do
    livro foram corrigidos e registrados em `_meta.corrections`; o livro nunca é fonte de reação.

## Plano combinado com o usuário (ordem)

1. ~~Terminar a Fase 3~~ — feito (3A–3F). Mais missões podem entrar a qualquer momento (ideias abaixo).
2. **Fase 4 — aprendizagem** (pedido do usuário, depois da Fase 3), para que um iniciante aprenda
   de verdade ao terminar os níveis:
   - **Fundamentos** no começo do jogo: átomo e distribuição eletrônica, estados da matéria,
     misturas, nomenclatura (itens "médios" das apostilas abaixo).
   - **Degraus intermediários** na Fase 3, para a dificuldade subir aos poucos (hoje o salto para
     logaritmos/exponenciais nos níveis 13–15 é grande).
   - **Revisões**: perguntas que voltam depois e misturam assuntos (revisão espaçada).
   - Problemas já identificados: dá para cumprir objetivos combinando tudo por tentativa, e os
     laboratórios mostram a resposta pronta das perguntas de cálculo (mostrar o caminho da conta
     e pedir raciocínio, com explicação do erro).
3. **Guardados para depois** (o usuário pediu para não perder): as pendências da Fase 2 (acima),
   os itens "médios" das apostilas, as etapas novas possíveis e os itens adiados pelo usuário
   (utensílios de laboratório e separação de misturas) — todos listados na seção abaixo.

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
- **Adiado pelo usuário**: utensílios de laboratório e separação de misturas (v. 2 A03 —
  filtração, decantação, destilação, centrifugação).
- **Pendências da Fase 2**: o quadro do v. 5 p. 49 dá pistas (hidreto/peróxido/superóxido + água,
  decomposição de hidróxidos e oxissais, ustulação), mas cada regra precisa de confirmação no
  A&J/Greenwood; HNO₃ + metais e carbonatos básicos não são resolvidos pelas apostilas.

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
- **Já usados**: segurança com fogo, catálise da H2O2, titulação, do cobre ao cobre.
- **Ainda não usados** (bons para missões novas ou para a Fase 4): análise pela chama (precisa de
  dados de cor de emissão com fonte), método científico com a vela, algarismos significativos,
  vidraria e separação de misturas (itens que o usuário adiou), pilhas e eletrólise (etapa de
  eletroquímica), H2 e Cl2 por síntese, NaHCO3 → Na2CO3, calor de hidratação do CuSO4.
- **Livro que ajudaria** (pedir ao usuário se precisar): **Greenwood & Earnshaw, *Chemistry of the
  Elements*** — confirmaria Cu(OH)2 → CuO e as pendências da Fase 2 (carbonatos básicos, acetatos
  básicos, metais + O2/Cl2, HNO3 + metais).

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
