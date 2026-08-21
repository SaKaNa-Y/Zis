// PROTOTYPE — throwaway. Zis #42, follow-up to rung-precedence.mjs.
// Reads that script's JSON — no embedding, no network.
//
// Hand-reading the 13 admitted disagreements turned up a pattern the ticket did
// not predict: in the cases where `citing` wins, the citing text is often the
// Item's OWN TITLE (an anchor that quotes it), and `own` is that same title plus
// the extracted body. If that holds, the contest is not `own` vs `citing` at all
// — it is title vs title+body, and the rung is not the variable.
import { readFileSync } from 'node:fs';
const { rows } = JSON.parse(readFileSync('rung-precedence.json', 'utf8'));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const head = (s, n) => norm(s).split(' ').slice(0, n).join(' ');

let quotes = 0, quotesWhenCiting = 0, citingWins = 0;
const lenWin = { shorter: 0, longer: 0 };
for (const r of rows) {
  // does the citing text quote the start of own's text (i.e. the Item's title)?
  const q = head(r.altText, 6).length > 12 && norm(r.ownText).startsWith(head(r.altText, 6));
  if (q) quotes++;
  if (r.byRel === 'citing') {
    citingWins++;
    if (q) quotesWhenCiting++;
    lenWin[(r.altText || '').length < (r.ownText || '').length ? 'shorter' : 'longer']++;
  } else {
    lenWin[(r.ownText || '').length < (r.altText || '').length ? 'shorter' : 'longer']++;
  }
}
console.log(`n=${rows.length}`);
console.log(`citing text quotes the Item's own title: ${quotes}/${rows.length}`);
console.log(`  of the ${citingWins} where higher REL+ picks citing: ${quotesWhenCiting} are that same-title case`);
console.log(`higher REL+ picks the SHORTER of the two texts: ${lenWin.shorter}/${rows.length}  (longer: ${lenWin.longer})`);

const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(p * s.length)]; };
const ownL = rows.map((r) => (r.ownText || '').length), altL = rows.map((r) => (r.altText || '').length);
console.log(`own text length   median ${q(ownL, 0.5)}  p90 ${q(ownL, 0.9)}`);
console.log(`citing text length median ${q(altL, 0.5)}  p90 ${q(altL, 0.9)}`);
const tiny = rows.filter((r) => (r.altText || '').length < 25);
console.log(`citing text under 25 chars ("Docs", "v1.0.0", "published"): ${tiny.length}/${rows.length}`);
console.log(`  of those, higher REL+ still picks citing: ${tiny.filter((r) => r.byRel === 'citing').length}`);
console.log(`  of those, higher GAP  still picks citing: ${tiny.filter((r) => r.byGap === 'citing').length}`);
