// PROTOTYPE — which multi-publisher Signals does the reference filter kill?
import { ingestAll } from './ingest.mjs';
import { buildCorpus } from './cluster.mjs';
const items = await ingestAll({ log: () => {} });
const on = await buildCorpus(items, { log: () => {} });
const off = await buildCorpus(items, { log: () => {}, dropReferenceOnly: false, dropIntraPublisherLinks: false });
const keys = (c) => new Set(c.signals.filter(s => s.strength >= 2).flatMap(s => s.links));
const kOn = keys(on);
console.log('signals lost to the citation-worthiness filters (strength>=2 only):');
for (const s of off.signals.filter(s => s.strength >= 2)) {
  if (s.links.some(l => kOn.has(l))) continue;
  console.log(`  s=${s.strength} ${s.links[0]}`);
  console.log(`     voters: ${s.voters.join(', ')}`);
}
