// Texto com fórmulas químicas: escapa o HTML e põe subscritos nas fórmulas (H2O → H₂O).

import { esc } from './dom.js';
import { formatFormulaHTML } from '../core/formula.js';

export const chemText = (text) => esc(text).replace(/\b((?:[A-Z][a-z]?\d*|\((?:[A-Z][a-z]?\d*)+\)\d+){2,})\b/g, (f) => (/\d/.test(f) ? formatFormulaHTML(f) : f));
