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
  - **Curiosidades dos elementos — CONCLUÍDA**: os 118 elementos têm descrição e curiosidades no
    painel da tabela periódica (`data/element-facts.json`), escritas com palavras próprias a partir
    do livro da DK (*The Periodic Table Book*, 2017), como leitura complementar com página. Erros do
    livro foram corrigidos e registrados em `_meta.corrections`; o livro nunca é fonte de reação.

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
- **Itens baratos (aprovados para fazer com a 3B)**: propriedades periódicas — raio, energia de
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
