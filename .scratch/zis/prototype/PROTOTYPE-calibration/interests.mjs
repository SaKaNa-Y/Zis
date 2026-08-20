// PROTOTYPE — throwaway. Zis issue #21.
// Reads the handwritten Interest Profile out of the markdown file, so the
// profile stays a document a human edits rather than a literal in a script.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadInterests(file = join(import.meta.dirname, 'interests.draft.md')) {
  const src = readFileSync(file, 'utf8');
  const section = (heading) => {
    // `\z` is not JS. The last section has no `## ` after it, so the
    // alternative has to be end-of-input spelled the way JS spells it.
    const re = new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))`, 'mi');
    const m = src.match(re);
    if (!m) return [];
    return [...m[1].matchAll(/^\s*\d+\.\s+(.+?)\s*$/gm)].map((x) => x[1].trim()).filter(Boolean);
  };
  const positive = section('Positive Interests');
  const negative = section('Negative Interests');
  if (!positive.length) throw new Error(`no positive Interests parsed from ${file}`);
  // ADR-0003's caps, checked rather than assumed — a 400-char Interest is the
  // multi-subject blob #14 rejected, wearing a numbered list.
  const tooLong = [...positive, ...negative].filter((s) => s.length > 200);
  return { positive, negative, tooLong };
}
