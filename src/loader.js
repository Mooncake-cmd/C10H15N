// Carrega os JSON de data/ no navegador. (Os testes carregam os mesmos arquivos via fs.)
import { buildGameData } from './core/data.js';

const FILES = {
  elements: 'elements.json',
  substances: 'substances.json',
  items: 'items.json',
  reactions: 'reactions.json',
  nonReactions: 'non-reactions.json',
  progression: 'progression.json',
  sources: 'sources.json',
  reactivitySeries: 'reactivity-series.json',
  structures: 'structures.json',
  ions: 'ions.json',
  rules: 'rules.json',
};

export async function loadGameData(base = './data/') {
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => {
      const res = await fetch(base + file);
      if (!res.ok) throw new Error(`Falha ao carregar ${file}: ${res.status}`);
      return [key, await res.json()];
    }),
  );
  return buildGameData(Object.fromEntries(entries));
}
