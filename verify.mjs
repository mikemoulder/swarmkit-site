import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root=dirname(fileURLToPath(import.meta.url));
const index=JSON.parse(await readFile(join(root,'search-index.json'),'utf8'));
let checked=0;
for(const file of ['index.html',...index.map(p=>`${p.slug}/index.html`)]) {
  const html=await readFile(join(root,file),'utf8');
  assert.ok(html.includes('<h1'),'Missing page heading: '+file);
  for(const [,href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if(/^(https?:|mailto:|data:|#)/.test(href))continue;
    const path=resolve(dirname(join(root,file)),href.split(/[?#]/)[0]);
    await stat(path);checked++;
  }
}
const full=await readFile(join(root,'llms-full.txt'),'utf8');
for(const text of ['startSimulation','advanceSimulation','RoundStore','SettlementJournal','simulateProcurement({','spendingPolicyMessage'])assert.ok(full.includes(text),'Missing machine-readable contract '+text);
assert.equal(index.length,10);
console.log(`Verified ${index.length} documentation pages, ${checked} local references and machine-readable SDK content.`);
