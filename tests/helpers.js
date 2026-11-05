import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameData } from '../src/core/data.js';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const read = (f) => JSON.parse(readFileSync(join(dataDir, f), 'utf8'));

export function loadRaw() {
  return {
    elements: read('elements.json'),
    substances: read('substances.json'),
    items: read('items.json'),
    reactions: read('reactions.json'),
    nonReactions: read('non-reactions.json'),
    progression: read('progression.json'),
    sources: read('sources.json'),
    reactivitySeries: read('reactivity-series.json'),
    structures: read('structures.json'),
    ions: read('ions.json'),
    rules: read('rules.json'),
    glossary: read('glossary.json'),
    thermo: read('thermo.json'),
    elementFacts: read('element-facts.json'),
    kinetics: read('kinetics.json'),
    gasTests: read('gas-tests.json'),
    equilibrium: read('equilibrium.json'),
    molecules: read('molecules.json'),
    missions: read('missions.json'),
  };
}

export const loadData = () => buildGameData(loadRaw());

/**
 * Jogador "esperto" de uma missão (Fase 3F): antes de gastar uma tentativa, testa de graça no
 * motor qual combinação do kit cumpre uma etapa atual; responde as perguntas certo.
 * Devolve o estado final, quantas combinações usou e, se não concluiu, onde travou.
 */
export async function playMission(state, missionId, data, engine) {
  const { startMission, missionCombine, answerMission } = await import('../src/core/progression.js');
  const { currentSteps, missionInventory, actionMatches, isAction, missionAnswer } = await import('../src/core/missions.js');
  const mission = data.missionsById.get(missionId);
  let s = startMission(state, missionId, data);
  if (!s.missionRun) return { state: s, attempts: null, stuck: 'não liberada' };
  const subsets = (arr, max) => {
    const out = [[]];
    for (const x of arr) for (const sub of [...out]) if (sub.length < max) out.push([...sub, x]);
    return out.filter((x) => x.length);
  };
  let used = 0;
  for (let guard = 0; s.missionRun && guard < 50; guard++) {
    const run = s.missionRun;
    if (run.failed) return { state: s, attempts: used, stuck: 'falhou' };
    const [step] = currentSteps(run, mission);
    if (!step) break;
    if (!isAction(step)) {
      s = answerMission(s, step.id, missionAnswer(step, data), data).state;
      continue;
    }
    const inv = missionInventory(run, mission);
    const itemSets = [[], ...inv.items.map((i) => [i]), inv.items];
    const candidates = currentSteps(run, mission).flatMap((st) => (st.kind === 'observe' ? [st.selection] : subsets(inv.substances, 3).flatMap((sub) => itemSets.map((it) => [...sub, ...it]))));
    const sel = candidates.find((c) => currentSteps(run, mission).some((st) => actionMatches(st, c, engine.combine(c))));
    if (!sel) return { state: s, attempts: null, stuck: currentSteps(run, mission).map((x) => x.id).join(', ') };
    s = missionCombine(s, sel, engine.combine(sel), data).state;
    used += 1;
  }
  return { state: s, attempts: used, stuck: s.missionRun ? 'não concluiu' : null };
}
