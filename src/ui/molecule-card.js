// Cartão de uma molécula (Fase 3D): visualizador 3D + explicação VSEPR, polaridade e fontes.
// Usado no painel da reação ("Forma das moléculas") e na galeria de moléculas.

import { esc } from './dom.js';
import { formatFormulaHTML } from '../core/formula.js';
import { analyzeMolecule, moleculeKeys } from '../core/vsepr.js';
import { mountMolecule3D, modelFrom } from './molecule3d.js';
import { sourceText } from './kinetics-lab.js';
import { analyzeOrganic, FUNCTION_LABEL, FUNCTION_GROUP } from '../core/organic.js';

const num = (x) => String(x).replace('.', ',');
const plural = (n, s, p) => (n === 0 ? `nenhum ${s}` : `${n} ${n === 1 ? s : p}`);

/** Nome de uma molécula ou íon poliatômico do jogo. */
export function moleculeName(key, data) {
  return data.substancesById.get(key)?.name ?? data.ions.anionsByFormula.get(key)?.name ?? data.ions.cationsByFormula.get(key)?.name ?? key;
}

/** Texto explicativo da análise VSEPR. */
export function moleculeInfoHTML(m, data) {
  const M = data.molecules;
  const parts = [];
  const c = m.main;
  if (!c) {
    parts.push(`<p><strong>Forma: linear.</strong> Com só dois átomos, não há outra possibilidade.</p>`);
  } else {
    const X = m.geo.sites[c.atom].neighbors.length;
    const extra = c.unpaired ? ' e um elétron desemparelhado (que também conta como região)' : '';
    parts.push(`<p><strong>Forma: ${esc(c.shape)}</strong> (${esc(c.axe)}). O átomo central, ${esc(c.el)}, tem ${plural(X, 'ligação', 'ligações')} e ${plural(c.lonePairs, 'par isolado', 'pares isolados')}${extra}: ${c.regions} regiões, que se afastam ao máximo num arranjo ${esc(c.arrangement)} — hibridização ${esc(c.hybridization)}.</p>`);
    const measured = m.measuredAngle;
    parts.push(`<p class="small">Ângulo de ligação ideal: ${num(c.idealAngle)}°${measured ? (measured.angle < c.idealAngle ? `; medido: ${num(measured.angle)}° — menor, porque os pares isolados ocupam mais espaço e apertam as ligações` : `; medido: ${num(measured.angle)}°`) : ''}.</p>`);
    if (m.centers.length > 1) {
      const groups = new Map();
      for (const x of m.centers) {
        const k = `${x.el}|${x.shape}|${x.hybridization}`;
        groups.set(k, (groups.get(k) ?? 0) + 1);
      }
      const list = [...groups].map(([k, n]) => {
        const [el, shape, hyb] = k.split('|');
        return `${esc(el)}${n > 1 ? ` (×${n})` : ''}: ${esc(shape)}, ${esc(hyb)}`;
      });
      parts.push(`<p class="small">Esta molécula tem vários "centros". Em volta de cada átomo: ${list.join('; ')}.</p>`);
    }
  }
  if (m.charge) {
    parts.push(`<p class="small">É um íon (carga ${m.charge > 0 ? '+' : '−'}${Math.abs(m.charge) > 1 ? Math.abs(m.charge) : ''}): ele já tem carga total, então não se fala em molécula polar ou apolar. A carga aparece num átomo do desenho, mas na verdade se espalha pelos átomos equivalentes (ressonância).</p>`);
  } else {
    const p = m.polarity;
    const mu = m.measuredDipole != null ? ` (momento de dipolo medido: ${num(m.measuredDipole)} D)` : '';
    let why;
    if (p.polar) why = 'os dipolos das ligações não se cancelam por causa da forma';
    else if (!p.polarBonds) why = m.lewis.atoms.every((a) => a.el === m.lewis.atoms[0].el) ? 'os átomos são iguais, então as ligações não são polares' : 'as ligações são praticamente apolares (C–H)';
    else why = 'as ligações são polares, mas os dipolos se cancelam pela simetria';
    parts.push(`<p class="small"><strong>Molécula ${p.polar ? 'polar' : 'apolar'}</strong>: ${why}${mu}.</p>`);
  }
  const src = [M.shapesSource, M.hybridizationSource, M.dipolesSource];
  if (m.measuredAngle) src.push(M.measuredAnglesSource);
  parts.push(`<p class="small muted">Forma deduzida da estrutura de Lewis pelo modelo VSEPR. Fonte: ${sourceText(data, src)}. Comprimentos de ligação aproximados (soma dos raios covalentes).</p>`);
  return parts.join('');
}

const ISOMER_TEXT = { função: 'de função', cadeia: 'de cadeia', posição: 'de posição' };

/** Bloco de química orgânica (Fase 3E): função, nome oficial explicado e isômeros. */
export function organicInfoHTML(key, data) {
  const o = analyzeOrganic(key, data);
  if (!o) return '';
  const others = o.types.filter((t) => t !== o.fn).map((t) => FUNCTION_LABEL[t]);
  const parts = o.iupac.parts.map((p) => `<li><code>${esc(p.text)}</code> — ${esc(p.meaning)}</li>`).join('');
  const iso = o.isomers.length
    ? `Isômeros no jogo (mesma fórmula, outra estrutura): ${o.isomers
        .map((i) => `${formatFormulaHTML(i.id)} — ${esc(moleculeName(i.id, data))} (isomeria ${ISOMER_TEXT[i.type]})`)
        .join('; ')}.`
    : '';
  return `<div class="org-info"><h5>Química orgânica</h5>
    <p><strong>Função: ${esc(FUNCTION_LABEL[o.fn])}</strong> — ${esc(FUNCTION_GROUP[o.fn])}.${others.length ? ` Também tem: ${esc(others.join(', '))}.` : ''} ${o.saturated ? 'Cadeia saturada (só ligações simples entre carbonos).' : 'Cadeia insaturada (tem ligação dupla ou tripla).'}</p>
    <p>Nome oficial (IUPAC): <strong>${esc(o.iupac.name)}</strong></p>
    <ul class="org-parts small">${parts}</ul>
    <p class="small">Fórmula molecular: ${formatFormulaHTML(o.molecularFormula)}. ${iso}</p>
    <p class="small muted">Nome e função deduzidos da estrutura. Fonte: ${sourceText(data, [
      { ref: 'atkins-jones', topic: 'Seções 18.1–18.2: nomes e isômeros', pages: '739–741' },
      { ref: 'atkins-jones', topic: 'Tabela 19.1 e seções 19.1–19.7: grupos funcionais', pages: '762–766' },
    ])}; Bernoulli, Química, v. 3, Frente D, Módulo 12 (isomeria plana).</p></div>`;
}

/**
 * Desenha o cartão de uma molécula em `box` (substitui o conteúdo) e monta o visualizador.
 * @returns {() => void} função para parar a animação
 */
export function renderMoleculeCard(box, key, data, { lonePairs = true } = {}) {
  const m = analyzeMolecule(key, data);
  if (!m) {
    box.innerHTML = '<p class="small muted">Sem estrutura molecular para mostrar.</p>';
    return () => {};
  }
  const name = moleculeName(key, data);
  box.innerHTML = `<div class="mol3d">
      <div class="mol3d-view"><canvas class="mol3d-canvas" width="260" height="220"></canvas>
        <label class="small mol3d-lp"><input type="checkbox" ${lonePairs ? 'checked' : ''}> pares isolados</label>
        <p class="small muted mol3d-hint">Arraste (ou use as setas) para girar.</p></div>
      <div class="mol3d-info"><h4>${formatFormulaHTML(key)} — ${esc(name)}</h4>${organicInfoHTML(key, data)}${moleculeInfoHTML(m, data)}</div></div>`;
  const viewer = mountMolecule3D(box.querySelector('canvas'), modelFrom(m), {
    showLonePairs: lonePairs,
    label: `Modelo 3D de ${name}: forma ${m.shape}. Arraste ou use as setas para girar.`,
  });
  box.querySelector('.mol3d-lp input').addEventListener('change', (ev) => viewer.setLonePairs(ev.target.checked));
  return () => viewer.destroy();
}

/** Moléculas e íons poliatômicos de uma reação, compostos primeiro. */
export function reactionMoleculeKeys(r, data) {
  const keys = [];
  const add = (k) => k && !keys.includes(k) && analyzeMolecule(k, data) && keys.push(k);
  for (const e of [...r.reactants, ...r.products]) {
    const sub = data.substancesById.get(e.id);
    add(sub.id);
    // Íons poliatômicos só de compostos iônicos (o acetato do ácido acético não vira aba).
    if (sub.ions && !analyzeMolecule(sub.id, data)) {
      add(sub.ions.cation.formula);
      add(sub.ions.anion.formula);
    }
  }
  const size = (k) => analyzeMolecule(k, data).lewis.atoms.length;
  return keys.sort((a, b) => (size(a) > 2) === (size(b) > 2) ? 0 : size(a) > 2 ? -1 : 1);
}

/** Lista para a galeria: [rótulo do grupo, chaves]. */
export function galleryGroups(data) {
  const all = moleculeKeys(data);
  const ions = new Set(Object.keys(data.structures.ions));
  return [
    ['Moléculas', all.filter((k) => !ions.has(k))],
    ['Íons poliatômicos', all.filter((k) => ions.has(k))],
  ];
}
