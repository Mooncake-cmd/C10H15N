// Fase 4A: fundamentos. Respostas calculadas (e explicadas) para as perguntas dos níveis
// iniciais: partículas do átomo, distribuição dos elétrons, estado físico e nomes de compostos.
// Puro, sem DOM. As perguntas de escolha simples ('quiz') têm a resposta nos dados.

import { compoundFormula, compoundName } from './ions.js';
import { molarMass } from './formula.js';

export const FUNDAMENTAL_TYPES = ['quiz', 'atom', 'electrons', 'state', 'naming', 'math'];

// ---------- Matemática da química (Fase 4B) ----------

/** Expoente da notação científica: 602000 → 5 (6,02 × 10⁵); 0,00042 → −4. */
export const sciExponent = (x) => Math.floor(Math.log10(Math.abs(x)) + 1e-9);

/**
 * Algarismos significativos de uma medida escrita (vírgula ou ponto decimal): zeros à esquerda
 * não contam; zeros à direita contam quando há vírgula. Sem vírgula, zeros finais são ambíguos.
 */
export function sigFigs(text) {
  const t = String(text).trim().replace(/^[-+−]/, '').split(/\s*[×x]\s*10/)[0].replace(/\s/g, '');
  if (!/^\d*[.,]?\d*$/.test(t) || !/\d/.test(t)) throw new Error(`medida ${text}`);
  const hasPoint = /[.,]/.test(t);
  const digits = t.replace(/[.,]/, '').replace(/^0+/, '');
  if (!hasPoint && /0$/.test(digits)) throw new Error(`${text}: zeros finais sem vírgula são ambíguos`);
  return digits.length;
}

/** Resposta de uma pergunta de matemática da química. */
export function mathAnswer(o, data) {
  switch (o.ask) {
    case 'exponent':
      return sciExponent(o.value);
    case 'sigfigs':
      return sigFigs(o.value);
    case 'moles':
      return o.grams / molarMass(data.substancesById.get(o.substance)?.formula ?? o.substance, data.atomicMasses);
    case 'pH':
      return -Math.log10(o.h);
    case 'ratio':
      return 10 ** Math.abs(o.pHa - o.pHb);
    default:
      throw new Error(`pergunta ${o.ask}`);
  }
}

const toNumber = (answer) => Number(String(answer).trim().replace(/−/g, '-').replace(/\s/g, '').replace(',', '.'));

function isMathRight(o, answer, data) {
  const right = mathAnswer(o, data);
  const x = toNumber(answer);
  if (!Number.isFinite(x)) return false;
  if (o.ask === 'moles') return Math.abs(x - right) <= 0.02 * right;
  if (o.ask === 'pH') return Math.abs(x - right) <= 0.02;
  if (o.ask === 'ratio') return Math.abs(x - right) <= 0.01 * right;
  return x === right;
}

const el = (data, symbol) => {
  const e = data.elementsBySymbol.get(symbol);
  if (!e) throw new Error(`elemento ${symbol}`);
  return e;
};

/** Ordem de preenchimento das subcamadas (regra de Madelung, o "diagrama de Pauling"). */
const AUFBAU = ['1s', '2s', '2p', '3s', '3p', '4s', '3d', '4p', '5s', '4d', '5p', '6s', '4f', '5d', '6p', '7s', '5f', '6d', '7p'];
const CAP = { s: 2, p: 6, d: 10, f: 14 };

/** Distribuição em subcamadas pelo diagrama de Pauling: 11 → "1s2 2s2 2p6 3s1". */
export function aufbauConfig(Z) {
  let left = Z;
  const parts = [];
  for (const sub of AUFBAU) {
    if (left <= 0) break;
    const n = Math.min(left, CAP[sub[1]]);
    parts.push(`${sub}${n}`);
    left -= n;
  }
  return parts.join(' ');
}

/** Configuração do dataset expandida ("[Ne] 3s1" → "1s2 2s2 2p6 3s1"), para conferir. */
export function expandConfig(symbol, data) {
  const conf = el(data, symbol).electronConfiguration;
  return conf.replace(/\[(\w+)\]/, (m, noble) => expandConfig(noble, data)).trim().replace(/\s+/g, ' ');
}

/** Elétrons por camada (K, L, M, N…), do dataset. */
export const shellsOf = (symbol, data) => [...el(data, symbol).shells];

/** Elétrons de valência de um elemento representativo (grupos 1, 2 e 13–18): os da última camada. */
export function valenceElectrons(symbol, data) {
  const e = el(data, symbol);
  if (!(e.group <= 2 || e.group >= 13)) throw new Error(`${symbol}: só para elementos representativos`);
  return e.shells[e.shells.length - 1];
}

/** Partículas de um átomo ou íon: prótons = Z; nêutrons = A − Z; elétrons = Z − carga. */
export function atomParticles(o, data) {
  const Z = el(data, o.element).Z;
  return { protons: Z, neutrons: o.massNumber - Z, electrons: Z - (o.charge ?? 0), Z };
}

/** Estado físico do elemento à temperatura ambiente e pressão normal (do dataset). */
export const stateOf = (symbol, data) => el(data, symbol).phaseAtSTP;

const parseNumbers = (s) => (String(s).match(/\d+/g) ?? []).map(Number);
const normConfig = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(c))
    .replace(/\s+/g, '');
/** Subcamadas escritas pelo jogador: "1s2 2s2 2p4" (ou "1s²2s²2p⁴") → [['1','s',2], …]. */
const parseConfig = (s) => [...normConfig(s).matchAll(/(\d)([spdf])(\d{1,2}?)(?=\d[spdf]|$)/g)].map((m) => [m[1], m[2], Number(m[3])]);

/** Resposta certa de uma pergunta dos fundamentos. */
export function fundamentalsAnswer(o, data) {
  switch (o.type) {
    case 'quiz':
      return o.answer;
    case 'atom':
      return atomParticles(o, data)[o.ask];
    case 'electrons':
      if (o.ask === 'shells') return shellsOf(o.element, data).join(', ');
      if (o.ask === 'valence') return valenceElectrons(o.element, data);
      return aufbauConfig(el(data, o.element).Z);
    case 'state':
      return stateOf(o.element, data);
    case 'math':
      return mathAnswer(o, data);
    case 'naming':
      return o.ask === 'formula' ? compoundFormula(o.cation, o.anion) : compoundName(o.cation, o.anion, data.ions);
    default:
      throw new Error(`tipo ${o.type}`);
  }
}

export function isFundamentalsAnswerRight(o, answer, data) {
  if (o.type === 'math') return isMathRight(o, answer, data);
  const right = fundamentalsAnswer(o, data);
  if (o.type === 'atom' || (o.type === 'electrons' && o.ask === 'valence')) {
    const x = Number(String(answer).trim().replace(',', '.'));
    return Number.isFinite(x) && x === right;
  }
  if (o.type === 'electrons' && o.ask === 'shells') {
    const a = parseNumbers(answer);
    const b = parseNumbers(right);
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  if (o.type === 'electrons') return normConfig(answer) === normConfig(right);
  return String(answer) === String(right);
}

const STATE_NAME = { s: 'sólido', l: 'líquido', g: 'gasoso' };

/** Explicação da resposta certa (mostrada depois do acerto, ou como caminho depois de um erro). */
export function fundamentalsExplain(o, data) {
  if (o.type === 'quiz') return o.choices.find((c) => c.value === o.answer)?.why ?? '';
  if (o.type === 'atom') {
    const p = atomParticles(o, data);
    const e = el(data, o.element);
    const q = o.charge ?? 0;
    const ion = q ? `; como a carga é ${q > 0 ? '+' : '−'}${Math.abs(q)}, ${q > 0 ? 'perdeu' : 'ganhou'} ${Math.abs(q)} elétron${Math.abs(q) > 1 ? 's' : ''}` : '; o átomo é neutro, então tem tantos elétrons quanto prótons';
    return `${e.name}: número atômico ${p.Z}, ou seja, ${p.protons} prótons. Nêutrons = número de massa − prótons = ${o.massNumber} − ${p.Z} = ${p.neutrons}. Elétrons: ${p.electrons}${ion}.`;
  }
  if (o.type === 'electrons') {
    const e = el(data, o.element);
    const sh = shellsOf(o.element, data);
    const names = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];
    const shells = sh.map((n, i) => `${names[i]} = ${n}`).join(', ');
    if (o.ask === 'config') return `${e.name} tem ${e.Z} elétrons. Seguindo a ordem do diagrama de Pauling (1s, 2s, 2p, 3s, 3p, 4s…), enchendo cada subcamada até o máximo (s: 2, p: 6): ${aufbauConfig(e.Z)}.`;
    return `${e.name} tem ${e.Z} elétrons, distribuídos nas camadas ${shells}. A última camada tem ${sh[sh.length - 1]} — são os elétrons de valência, que decidem como o elemento reage.`;
  }
  if (o.type === 'state') {
    const e = el(data, o.element);
    return `${e.name} é ${STATE_NAME[stateOf(o.element, data)]} à temperatura ambiente e pressão normal.`;
  }
  if (o.type === 'math') return mathExplain(o, data);
  if (o.type === 'naming') {
    const cat = data.ions.cationsByFormula.get(o.cation);
    const an = data.ions.anionsByFormula.get(o.anion);
    return `Nome: o ânion (${an.name}) + "de" + o cátion (${cat.name}) = ${compoundName(o.cation, o.anion, data.ions)}. Fórmula: as cargas têm de se anular, então ${compoundFormula(o.cation, o.anion)}.`;
  }
  return '';
}

const fmt = (x, d = 2) => String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ',');

function mathExplain(o, data) {
  const r = mathAnswer(o, data);
  if (o.ask === 'exponent') {
    const n = Math.abs(r);
    return o.value >= 1
      ? `A vírgula anda ${n} casa${n === 1 ? '' : 's'} para a esquerda até sobrar um algarismo antes dela: expoente +${n}.`
      : `A vírgula anda ${n} casa${n === 1 ? '' : 's'} para a direita até o primeiro algarismo diferente de zero: expoente −${n} (número menor que 1, expoente negativo).`;
  }
  if (o.ask === 'sigfigs') return `Em ${o.value}, os zeros do começo só marcam a posição da vírgula e não contam; os outros dígitos, incluindo zeros no fim depois da vírgula, contam: ${r} algarismos significativos.`;
  if (o.ask === 'moles') {
    const f = data.substancesById.get(o.substance)?.formula ?? o.substance;
    const M = molarMass(f, data.atomicMasses);
    return `Massa molar de ${f}: ${fmt(M)} g/mol (soma das massas atômicas). n = massa ÷ massa molar = ${o.grams} g ÷ ${fmt(M)} g/mol = ${fmt(r)} mol.`;
  }
  if (o.ask === 'pH') return `pH = −log[H₃O⁺] = −log(${String(o.h).replace('.', ',')}) = ${fmt(r)}. Para potências de 10 é só pegar o expoente e trocar o sinal.`;
  const d = Math.abs(o.pHa - o.pHb);
  return `Cada unidade de pH é um fator 10 na concentração de H₃O⁺. A diferença é de ${d} unidade${d === 1 ? '' : 's'}: 10^${d} = ${fmt(r, 0)} vezes.`;
}

function mathMistake(o, answer, data) {
  const right = mathAnswer(o, data);
  const x = toNumber(answer);
  const hint = o.hint ? ` Dica: ${o.hint}` : '';
  if (!Number.isFinite(x)) return 'Escreva só o número.';
  if (o.ask === 'exponent' && x === -right) return 'O sinal está trocado: número maior que 1 tem expoente positivo; menor que 1, negativo.';
  if (o.ask === 'exponent' && Math.abs(x - right) === 1) return 'Quase: conte de novo as casas. Na notação científica fica exatamente um algarismo (de 1 a 9) antes da vírgula.';
  if (o.ask === 'sigfigs') {
    const lead = (String(o.value).match(/^[^1-9]*/)?.[0].match(/0/g) ?? []).length;
    if (x === right + lead) return 'Os zeros do começo (antes do primeiro algarismo diferente de zero) não contam: só mostram onde fica a vírgula.';
    if (x < right) return 'Zeros no fim, depois da vírgula, contam: a balança mediu aquele zero.';
  }
  if (o.ask === 'moles') {
    const M = molarMass(data.substancesById.get(o.substance)?.formula ?? o.substance, data.atomicMasses);
    if (Math.abs(x - o.grams * M) <= 0.02 * o.grams * M) return 'Você multiplicou. Para achar o número de mol, divida a massa pela massa molar.';
    if (Math.abs(x - M / o.grams) <= 0.02 * (M / o.grams)) return 'A divisão está invertida: é massa ÷ massa molar.';
  }
  if (o.ask === 'pH' && Math.abs(x + right) <= 0.02) return 'Lembre do sinal de menos: pH = −log[H₃O⁺], e o pH de um ácido é positivo.';
  if (o.ask === 'ratio' && x === Math.abs(o.pHa - o.pHb)) return 'Essa é a diferença de pH, não quantas vezes. Cada unidade de pH multiplica por 10.';
  return `Ainda não.${hint}`;
}

const SHELL_CAP = [2, 8]; // K e L (as camadas seguintes dependem da ordem das subcamadas)

/**
 * Por que a resposta está errada: o porquê da alternativa escolhida ou o engano mais comum
 * (confundir número de massa com nêutrons, somar elétrons errado, passar do limite de uma
 * camada…). Sem entregar a resposta certa.
 */
export function fundamentalsMistake(o, answer, data) {
  const hint = o.hint ? ` Dica: ${o.hint}` : '';
  if (o.type === 'quiz' || o.type === 'naming') {
    return o.choices?.find((c) => String(c.value) === String(answer))?.why ?? `Ainda não.${hint}`;
  }
  if (o.type === 'state') return `Ainda não.${hint}`;
  if (o.type === 'math') return mathMistake(o, answer, data);
  const e = el(data, o.element);
  if (o.type === 'atom') {
    const x = Number(String(answer).trim().replace(',', '.'));
    const q = o.charge ?? 0;
    if (x === o.massNumber && o.ask !== 'protons') return `${x} é o número de massa: prótons + nêutrons juntos. A pergunta é só sobre os ${o.ask === 'neutrons' ? 'nêutrons' : 'elétrons'}.`;
    if (o.ask === 'neutrons' && x === e.Z) return `${x} é o número de prótons (o Z). Os nêutrons são o que sobra do número de massa.`;
    if (o.ask === 'protons' && x === o.massNumber - e.Z) return `${x} são os nêutrons. Os prótons são o número atômico, Z.`;
    if (o.ask === 'electrons' && q && x === e.Z) return `${x} seria o número de elétrons do átomo neutro. Este é um íon, com carga ${q > 0 ? '+' : '−'}${Math.abs(q)}.`;
    if (o.ask === 'electrons' && q && x === e.Z + q) return `Atenção ao sinal: carga negativa quer dizer elétrons a mais que prótons; positiva, elétrons a menos.`;
    return `Ainda não.${hint}`;
  }
  if (o.type === 'electrons') {
    if (o.ask === 'valence') {
      const x = Number(String(answer).trim());
      if (x === e.Z) return `${x} é o total de elétrons. Os de valência são só os da última camada.`;
      return `Ainda não.${hint}`;
    }
    const nums = o.ask === 'shells' ? parseNumbers(answer) : parseConfig(answer).map((t) => t[2]);
    const sum = nums.reduce((a, b) => a + b, 0);
    if (sum !== e.Z) return `Os números somam ${sum}, e são ${e.Z} elétrons (${e.name}: Z = ${e.Z}) — todos têm de entrar, sem sobrar nenhum.`;
    if (o.ask === 'shells' && nums.some((n, i) => n > (SHELL_CAP[i] ?? Infinity))) return 'A camada K comporta no máximo 2 elétrons e a L, no máximo 8.';
    if (o.ask === 'config') {
      const over = parseConfig(answer).find(([, l, n]) => n > CAP[l]);
      if (over) return `A subcamada ${over[1]} comporta no máximo ${CAP[over[1]]} elétrons.`;
      return 'A soma está certa; confira a ordem das subcamadas (1s, 2s, 2p, 3s, 3p, 4s, 3d…) e se cada uma foi enchida antes da próxima.';
    }
    return `Ainda não.${hint}`;
  }
  return `Ainda não.${hint}`;
}
