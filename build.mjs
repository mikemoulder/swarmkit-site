import { mkdir, readFile, writeFile, readdir, copyFile } from "node:fs/promises";
import { guidePages } from "./guides.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const links = [
  ["Quickstart", "../docs/"],
  ["SDK reference", "../reference/"],
  ["Agent guide", "../agents/"],
];
for (const [slug, title] of guidePages) {
  if (!links.some(([, href]) => href === `../${slug}/`)) links.push([title, `../${slug}/`]);
}
const pages = [
  ["docs", "Run your first market", "Build a sealed-bid round with two buyers and two sellers. Run it locally with Node 22.18 or newer.", `
    <h2>Install the SDK</h2>
    <p>Run <code>npm ci</code> and <code>npm run pack:sdk</code> in the <a href="https://github.com/mikemoulder/swarmkit">SDK repository</a>. Install the resulting tarball in your Node project. The package name is <code>near-swarmkit</code>.</p>
    <pre><code>npm install /path/to/near-swarmkit-0.1.0.tgz</code></pre>
    <h2>Pool inference demand</h2>
    <p>Save this as <code>market.mjs</code> and run <code>node market.mjs</code>. Use integer strings for quantity and amounts.</p>
    <pre><code id="quickstart"></code></pre>
    <p>The first offer is cheaper but covers only four credits. The second seller clears all five. Research owes 12 credits and Indexer owes eight.</p>
    <h2>Follow a round into settlement</h2>
    <ol>
      <li><code>createRound</code> accepts buyer demand and seller commitments and reveals.</li>
      <li><code>settlementPlanFromTranscript</code> replays the recorded inputs and derives exact buyer payments.</li>
      <li><code>executeWithSpendingPolicies</code> checks buyer-signed approvals before a settlement transport can send.</li>
      <li><code>auditSettlement</code> compares receipt claims against an optional read-only verifier.</li>
    </ol>
    <p><a href="../reference/">Read the SDK reference</a></p>`],
  ["reference", "SDK reference", "The public TypeScript interface for procurement, replay, signing, and settlement.", `
    <h2>Coordinator and allocation</h2>
    <table class="doc-table">
      <thead><tr><th scope="col">Export</th><th scope="col">Use</th></tr></thead>
      <tbody>
        <tr><td><code>createRound</code></td><td>Configure buyers, sellers, one resource, one asset, three deadlines, and an optional clock and mechanism.</td></tr>
        <tr><td><code>commitBid</code></td><td>Hash the round ID, seller ID, capacity, price, and a 32-byte salt. Generate a fresh cryptographic salt for live bids.</td></tr>
        <tr><td><code>lowestPrice</code></td><td>Choose the cheapest seller that can cover the entire pool within all buyer caps. Account ID breaks ties.</td></tr>
        <tr><td><code>cheapestCapacity</code></td><td>Serve tight budgets first, drawing from lower-priced sellers. All demand must be filled. Charges use each seller’s bid.</td></tr>
        <tr><td><code>simulateProcurement</code></td><td>Run buyer and seller strategies with a seed. Inspect stage snapshots, the transcript and synthetic payments.</td></tr>
      </tbody>
    </table>
    <p>A custom <code>ProcurementMechanism</code> can select an eligible winner or supply split lines. Pin its implementation to a versioned ID when replaying a round.</p>
    <h2>Replay and storage</h2>
    <p><code>round.transcript()</code> returns accepted events, the round specification, and its observation time. <code>replayRound</code> recomputes a snapshot. <code>resumeRound</code> reopens a round with a clock at or after that observation time.</p>
    <p>Use <code>openStoredRound</code> and <code>submitStoredRoundEvent</code> with a <code>RoundStore</code>. Its compare-and-set operation must be atomic. A transcript proves consistency with its own recorded inputs. Use trusted storage and authenticate participants at your service boundary.</p>
    <h2>Settlement and NEAR</h2>
    <table class="doc-table">
      <thead><tr><th scope="col">Export</th><th scope="col">Use</th></tr></thead>
      <tbody>
        <tr><td><code>createSettlementPlan</code></td><td>Derive payment IDs and amounts from a closed snapshot. Split plans use one ID per buyer–seller pair.</td></tr>
        <tr><td><code>executeSettlement</code></td><td>Authorize, journal signed bytes, inspect the stored hash, and send or reconcile the same transaction.</td></tr>
        <tr><td><code>executeWithSpendingPolicies</code></td><td>Check buyer Ed25519 approvals against the plan’s asset, sellers, cumulative amounts, scope and expiry.</td></tr>
        <tr><td><code>planNearSubaccounts</code></td><td>Prepare create, fund, and add-key actions for direct children. The application supplies the parent signer.</td></tr>
        <tr><td><code>nearTestnetTransport</code></td><td>Settle native testnet NEAR with an application-supplied signer and check the finalized transfer.</td></tr>
        <tr><td><code>nearIntentsTransport</code></td><td>Settle supported NEP-141 Verifier balances with a buyer NEP-413 signer and relayer signer. Preflight and reconcile finalized execution.</td></tr>
        <tr><td><code>auditSettlement</code></td><td>Replay a transcript, check receipt IDs and hashes, and compare claimed and observed outcomes.</td></tr>
      </tbody>
    </table>
    <p class="note">Settlement transfers are independent. A round can settle partially. A confirmed transfer requires a separate seller-authorized payment to refund. Keep journal entries private because they contain signed transaction bytes.</p>
    <p><a href="https://docs.near-intents.org/">Read the NEAR Intents documentation</a></p>`],
  ["agents", "Build a procurement agent", "Give each agent a bounded role, then let the coordinator and settlement policy enforce the market rules.", `
    <h2>Give the agent one role</h2>
    <p>A buyer strategy turns application demand into a quantity and a budget. A seller strategy quotes a price and available capacity. The coordinator owns deadlines and clearing.</p>
    <pre><code>const buyer = {
  id: "research-agent",
  demand: () =&gt; ({ quantity: "3", budget: "15" }),
};

const seller = {
  id: "inference-seller",
  offer: () =&gt; ({ capacity: "5", unitPrice: "4" }),
};</code></pre>
    <p>Pass these strategies to <code>simulateProcurement</code>. For live participation, authenticate the caller before mapping its identity to a <code>RoundCommand</code>.</p>
    <h2>Keep approvals with the buyer</h2>
    <ol>
      <li>Derive and review a closed settlement plan. Resolve the buyer’s trusted public key outside the agent’s input.</li>
      <li>Set the round, asset, transport scope, seller allowlist, cumulative maximum and expiry in <code>SpendingPolicy</code>.</li>
      <li>Sign <code>spendingPolicyMessage(policy)</code> with the buyer’s Ed25519 approval key.</li>
      <li>Use <code>executeWithSpendingPolicies</code> with the same journal across attempts. Implement atomic <code>bindPlan</code> for split fulfillment.</li>
      <li>Inspect the existing hash after an ambiguous send. Authorize a replacement only after reconciling the original transaction.</li>
    </ol>
    <h2>Connect NEAR Intents</h2>
    <p>The buyer must hold a supported asset in the Verifier and have a recognized signing key. Supply a NEP-413 callback for the exact request and a separate relayer callback for the resulting Verifier call. Configure the transport for the asset in the plan.</p>
    <p>Test agent behavior with deterministic strategies first. Keep signing and RPC access on your backend. A read-only receipt view can remain public.</p>
    <p><a href="../llms.txt">Read the plain-text guide</a></p>`],
];

const sample = await readFile(join(root, "examples", "quickstart.mjs"), "utf8");
const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const sdkArg = process.argv.indexOf('--sdk');
const declarations = join(root, 'sdk-reference');
await mkdir(declarations, { recursive: true });
if (sdkArg !== -1) {
  const source = join(root, process.argv[sdkArg + 1]);
  for (const file of await readdir(source)) if (file.endsWith('.d.ts')) await copyFile(join(source, file), join(declarations, file));
  await mkdir(join(root, 'assets', 'sdk'), { recursive: true });
  for (const file of await readdir(source)) if (file.endsWith('.js')) await copyFile(join(source,file), join(root,'assets','sdk',file));
  for (const file of ['incremental-market.mjs', 'sqlite-round-store.mjs', 'agent-service.mjs']) {
    await copyFile(join(source, 'examples', file), join(root, 'examples', file));
  }
}
for (const page of guidePages) {
  const index = pages.findIndex(([slug]) => slug === page[0]);
  if (index === -1) pages.push(page); else pages[index] = page;
}
const declarationFiles = (await readdir(declarations)).filter(file => file.endsWith('.d.ts')).sort();
if (!declarationFiles.length) throw new Error('Generate the SDK reference with --sdk <compiled SDK directory>');
pages[pages.findIndex(([slug]) => slug === 'reference')] = ['reference', 'SDK reference', 'TypeScript contracts generated from the packaged SDK declarations.',
  '<h2>Public entry point</h2><p>Import public symbols from near-swarmkit. The index below lists the public exports; module declarations provide their full types. Supporting internal types are shown for context and are not separate package entry points.</p>' +
  (await Promise.all(['index.d.ts', ...declarationFiles.filter(f => f !== 'index.d.ts')].map(async file =>
    `<section class="api-module" id="${file.replace('.d.ts','')}"><h2>${escapeHtml(file.replace('.d.ts',''))}</h2><pre><code>${escapeHtml(await readFile(join(declarations,file),'utf8'))}</code></pre></section>`))).join('')];

for (const page of pages) page[3] = page[3].replace('id="quickstart"></code>', `id="quickstart">${escapeHtml(sample.trimEnd())}</code>`);
for (const [slug, title, description, body] of pages) {
  const groups = [ ['Start here', [['Quickstart','docs'],['Coordination model','concepts']]],
    ['Build a market', [['Allocation rules','mechanisms'],['Simulation & strategies','simulation'],['State & recovery','storage'],['NEAR settlement','settlement']]],
    ['Reference', [['SDK API','reference'],['Architecture','architecture'],['Errors & troubleshooting','errors']]],
    ['For agents', [['Agent integration','agents']]] ];
  const navigation = groups.map(([group,items])=>`<h2>${group}</h2>`+items.map(([label,path])=>`<a href="../${path}/"${path===slug?' aria-current="page"':''}>${label}</a>`).join('')).join('');
  const headings=[];
  const indexedBody=body.replace(/<h2>(.*?)<\/h2>/g,(_,label)=>{const id=label.replace(/<[^>]*>/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');headings.push([id,label]);return `<h2 id="${id}">${label}</h2>`;});
  const pageIndex=pages.findIndex(p=>p[0]===slug),next=pages[(pageIndex+1)%pages.length];
  const html = `<!doctype html>
<html lang="en" data-type="software" data-radius="sharp">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | SwarmKit</title>
  <meta name="description" content="${description}">
  <meta name="theme-color" content="#191b19">
  <meta name="page-type" content="software">
  <meta name="site-kind" content="software">
  <link rel="icon" href="../icon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../assets/system.css">
  <link rel="stylesheet" href="../site.css?v=20261114-3">
</head>
<body class="docs-body">
  <header class="site-header"><div class="wrap topbar">
    <a class="skip-link" href="#main">Skip to content</a>
    <a class="brand" href="../">SwarmKit<span class="brand-dot">.</span></a>
    <nav aria-label="Main"><a href="../docs/">Docs</a><a href="../agents/">Agent guide</a><a href="https://github.com/mikemoulder/swarmkit">GitHub ↗</a></nav>
  </div></header>
  <main id="main" class="wrap docs-layout">
    <nav class="docs-nav" aria-label="Documentation"><button class="doc-menu" aria-expanded="false" aria-controls="nav-groups">Browse documentation +</button><label class="doc-search-label">Find a guide<input type="search" id="doc-search" placeholder="Search documentation" autocomplete="off"></label><div id="search-results" aria-live="polite"></div><div class="nav-groups" id="nav-groups">${navigation}</div></nav>
    <article class="docs-content"><div class="doc-breadcrumb">Documentation / ${slug==='docs'?'Quickstart':slug}</div><h1>${title}</h1><p>${description}</p><div class="page-actions"><button id="copy-page">Copy page text</button><a href="../llms-full.txt">Full text for agents ↗</a></div>${indexedBody}<nav class="page-next" aria-label="Next page"><span>Continue reading</span><a href="../${next[0]}/">${next[1]} ↗</a></nav></article>
    <aside class="docs-toc" aria-label="On this page"><h2>On this page</h2>${headings.map(([id,label])=>`<a href="#${id}">${label}</a>`).join('')}</aside>
  </main>
  <footer class="site-footer"><div class="wrap"><a class="brand" href="../">SwarmKit</a><nav aria-label="Footer"><a href="../llms.txt">llms.txt</a><a href="https://mikemoulder.github.io/swarmkit-market/">Market ↗</a></nav></div></footer>
<script src="../docs.js" defer></script></body>
</html>
`;
  await mkdir(join(root, slug), { recursive: true });
  await writeFile(join(root, slug, "index.html"), html);
}

const plain = value => value.replace(/<[^>]*>/g,' ').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&').replace(/[ \t]+/g,' ');
await writeFile(join(root,'search-index.json'), JSON.stringify(pages.map(([slug,title,description,body]) => ({ slug,title,description,text:plain(body) }))));
await writeFile(join(root,'llms-full.txt'), pages.map(([slug,title,description,body]) => `# ${title}\nhttps://mikemoulder.github.io/swarmkit-site/${slug}/\n${description}\n${plain(body)}\n`).join('\n'));
await writeFile(join(root,'llms.txt'), '# SwarmKit\n\nTypeScript SDK for procurement and agent coordination on NEAR. Package: near-swarmkit.\n\n' + pages.map(([slug,title])=>`- [${title}](https://mikemoulder.github.io/swarmkit-site/${slug}/)`).join('\n') + '\n- [Full documentation](https://mikemoulder.github.io/swarmkit-site/llms-full.txt)\n\nUse canonical integer strings. Authenticate actors outside the SDK. Keep checkpoints and signing keys private. Never raise spending caps without buyer authorization. Distinguish simulation, native testnet transfers and actual Intents execution.\n');
