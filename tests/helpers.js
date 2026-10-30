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
  };
}

export const loadData = () => buildGameData(loadRaw());
