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
- **Pendências da Fase 2 (decidir com o usuário como proceder)**:
  1. Exceções do motor de regras sem fonte com página (Ag⁺ + OH⁻ → Ag2O, carbonatos básicos de
     Cu/Mg/Zn/Fe(II), carbonatos de Fe³⁺/Al³⁺ inexistentes, acetatos básicos, bicarbonatos só do
     grupo 1/NH4⁺) e limites numéricos escolhidos sem livro (−2,5 V "ataca a água", −0,8 V "não se
     deposita", −0,4 V para ácido fraco, passivação de Al/Be). Ideal: conferir no Greenwood.
  2. Síntese e decomposição estreitas: só óxido + água e carbonatos de Mg/Ca; sem regra geral para
     metal + O2 e metal + Cl2 (produto varia).
  3. Regras só para pares; combinações de 3+ substâncias não passam pelo motor.
  4. Estequiometria só com massa: faltam volume de gás, concentração (mol/L) e rendimento
     percentual (Atkins & Jones, seções G, L, M).
  5. A regra de combustão não tem combustível novo (só o metano, que é curado): depende de
     adicionar orgânicos como etanol e propano.
  6. Ácido nítrico + metais sempre "não sei"; curar casos clássicos (Cu + HNO3 diluído, p. 519).
- **Fase 3 (avançado) — próxima**: termodinâmica e cinética, equilíbrio, moléculas 3D, introdução à química
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
