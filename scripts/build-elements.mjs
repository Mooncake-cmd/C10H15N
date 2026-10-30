#!/usr/bin/env node
// Gera data/elements.json a partir do dataset aberto Periodic-Table-JSON
// (https://github.com/Bowserinator/Periodic-Table-JSON, cópia em data/source/PeriodicTableJSON.json).
//
// Uso: node scripts/build-elements.mjs
//
// O que este script faz além de copiar campos:
//   - Mantém só os 118 elementos confirmados (o dataset traz também o hipotético 119, Uue).
//   - Arredonda a massa atômica para 5 algarismos significativos, no estilo da tabela
//     "abridged" da IUPAC/CIAAW. (O dataset concatena a incerteza nos dígitos — ex.: 4.0026022
//     vem de 4.002602(2) — então usar o número cru daria falsa precisão.) Os testes conferem os
//     elementos jogáveis contra os valores abreviados da IUPAC 2021.
//   - Grupo = null para lantanídeos/actinídeos (bloco f), em vez do "3" que o dataset usa.
//   - Acrescenta o nome em português e uma família em português.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(readFileSync(join(root, 'data/source/PeriodicTableJSON.json'), 'utf8'));

const NOMES_PT = {
  H: 'Hidrogênio', He: 'Hélio', Li: 'Lítio', Be: 'Berílio', B: 'Boro', C: 'Carbono', N: 'Nitrogênio', O: 'Oxigênio',
  F: 'Flúor', Ne: 'Neônio', Na: 'Sódio', Mg: 'Magnésio', Al: 'Alumínio', Si: 'Silício', P: 'Fósforo', S: 'Enxofre',
  Cl: 'Cloro', Ar: 'Argônio', K: 'Potássio', Ca: 'Cálcio', Sc: 'Escândio', Ti: 'Titânio', V: 'Vanádio', Cr: 'Cromo',
  Mn: 'Manganês', Fe: 'Ferro', Co: 'Cobalto', Ni: 'Níquel', Cu: 'Cobre', Zn: 'Zinco', Ga: 'Gálio', Ge: 'Germânio',
  As: 'Arsênio', Se: 'Selênio', Br: 'Bromo', Kr: 'Criptônio', Rb: 'Rubídio', Sr: 'Estrôncio', Y: 'Ítrio', Zr: 'Zircônio',
  Nb: 'Nióbio', Mo: 'Molibdênio', Tc: 'Tecnécio', Ru: 'Rutênio', Rh: 'Ródio', Pd: 'Paládio', Ag: 'Prata', Cd: 'Cádmio',
  In: 'Índio', Sn: 'Estanho', Sb: 'Antimônio', Te: 'Telúrio', I: 'Iodo', Xe: 'Xenônio', Cs: 'Césio', Ba: 'Bário',
  La: 'Lantânio', Ce: 'Cério', Pr: 'Praseodímio', Nd: 'Neodímio', Pm: 'Promécio', Sm: 'Samário', Eu: 'Európio',
  Gd: 'Gadolínio', Tb: 'Térbio', Dy: 'Disprósio', Ho: 'Hólmio', Er: 'Érbio', Tm: 'Túlio', Yb: 'Itérbio', Lu: 'Lutécio',
  Hf: 'Háfnio', Ta: 'Tântalo', W: 'Tungstênio', Re: 'Rênio', Os: 'Ósmio', Ir: 'Irídio', Pt: 'Platina', Au: 'Ouro',
  Hg: 'Mercúrio', Tl: 'Tálio', Pb: 'Chumbo', Bi: 'Bismuto', Po: 'Polônio', At: 'Astato', Rn: 'Radônio', Fr: 'Frâncio',
  Ra: 'Rádio', Ac: 'Actínio', Th: 'Tório', Pa: 'Protactínio', U: 'Urânio', Np: 'Netúnio', Pu: 'Plutônio', Am: 'Amerício',
  Cm: 'Cúrio', Bk: 'Berquélio', Cf: 'Califórnio', Es: 'Einstênio', Fm: 'Férmio', Md: 'Mendelévio', No: 'Nobélio',
  Lr: 'Laurêncio', Rf: 'Rutherfórdio', Db: 'Dúbnio', Sg: 'Seabórgio', Bh: 'Bóhrio', Hs: 'Hássio', Mt: 'Meitnério',
  Ds: 'Darmstácio', Rg: 'Roentgênio', Cn: 'Copernício', Nh: 'Nihônio', Fl: 'Fleróvio', Mc: 'Moscóvio', Lv: 'Livermório',
  Ts: 'Tenesso', Og: 'Oganessônio',
};

// Família em português (a categoria do dataset mistura "diatomic"/"polyatomic nonmetal"; unificamos em "ametal").
const FAMILIA = {
  'alkali metal': 'metal-alcalino',
  'alkaline earth metal': 'metal-alcalino-terroso',
  'transition metal': 'metal-de-transicao',
  'post-transition metal': 'outro-metal',
  metalloid: 'semimetal',
  'diatomic nonmetal': 'ametal',
  'polyatomic nonmetal': 'ametal',
  'noble gas': 'gas-nobre',
  lanthanide: 'lantanideo',
  actinide: 'actinideo',
};

const FASE = { Gas: 'g', Liquid: 'l', Solid: 's' };

const elements = src.elements
  .filter((e) => e.number <= 118)
  .map((e) => {
    const fBlock = e.block === 'f' || e.ypos >= 9;
    return {
      Z: e.number,
      symbol: e.symbol,
      name: NOMES_PT[e.symbol],
      nameEn: e.name,
      atomicMass: Number(e.atomic_mass.toPrecision(5)),
      group: fBlock ? null : e.group,
      period: e.period,
      block: e.block,
      family: FAMILIA[e.category] ?? 'desconhecida',
      electronegativity: e.electronegativity_pauling ?? null,
      electronConfiguration: e.electron_configuration_semantic,
      shells: e.shells,
      phaseAtSTP: FASE[e.phase] ?? null,
      // Posição na grade de 18 colunas (linhas 9–10 = lantanídeos/actinídeos, como no dataset).
      xpos: e.xpos,
      ypos: e.ypos,
    };
  });

const missing = elements.filter((e) => !e.name).map((e) => e.symbol);
if (missing.length) throw new Error(`Sem nome em português: ${missing.join(', ')}`);

const out = {
  _meta: {
    source: 'Periodic-Table-JSON (Bowserinator), https://github.com/Bowserinator/Periodic-Table-JSON — dados compilados da Wikipédia (CC BY-SA)',
    generatedBy: 'scripts/build-elements.mjs',
    notes: [
      'atomicMass arredondada a 5 algarismos significativos (estilo IUPAC abridged).',
      'group = null para lantanídeos e actinídeos.',
      'phaseAtSTP: s/l/g a 0 °C e 1 atm.',
    ],
  },
  elements,
};

writeFileSync(join(root, 'data/elements.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`data/elements.json: ${elements.length} elementos`);
