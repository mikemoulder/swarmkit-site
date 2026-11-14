import { mkdir, readFile, writeFile, readdir, copyFile } from "node:fs/promises";
import { guidePages } from "./guides.mjs";
import { highlightBlocks } from "./highlight.mjs";
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
  const navigation = groups.map(([group,items])=>`<h2>${group}</h2>`+items.map(([label,path])=>`<a class="docs-nav__link" href="../${path}/"${path===slug?' aria-current="page"':''}>${label}</a>`).join('')).join('');
  const current = groups.flatMap(([, items]) => items).find(([, path]) => path === slug)?.[0] ?? title;
  const headings=[];
  const indexedBody=body.replace(/<h2>(.*?)<\/h2>/g,(_,label)=>{const id=label.replace(/<[^>]*>/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');headings.push([id,label]);return `<h2 id="${id}">${label}</h2>`;});
  const order = groups.flatMap(([, items]) => items.map(([, path]) => path));
  const nextSlug = order[(order.indexOf(slug) + 1) % order.length], next = pages.find(([s]) => s === nextSlug) ?? pages[0];
  const html = `<!doctype html>
<html lang="en" data-type="software" data-radius="sharp" data-buttons="tonal">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${title} · SwarmKit docs</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${title} · SwarmKit docs">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="../share.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#eef0f3">
  <meta name="page-type" content="software">
  <meta name="site-kind" content="software">
  <link rel="icon" href="../favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wdth,wght@75..100,400..700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../assets/system.css">
  <style>:root{--p-bg:#eef0f3;--p-surface:#e2e5ea;--p-ink:#0b0c0e;--p-muted:#5d6470;--p-accent:#1f2de6;--p-accent-ink:#fff;--p-action:#1f2de6;--p-action-ink:#fff;--font-display:"Instrument Sans",system-ui,sans-serif;--font-text:"Instrument Sans",system-ui,sans-serif;--font-mono:"DM Mono",ui-monospace,Menlo,Consolas,monospace;--display-weight:500;--display-tracking:-0.028em;--display-tracking-xl:-0.036em;--display-stretch:96%}</style>
  <link rel="stylesheet" href="../site.css?v=20261114-4">
</head>
<body class="docs-page">
  <header class="nav">
    <div class="wrap nav__bar">
      <a class="skip-link" href="#doc">Skip to content</a>
      <a class="nav__logo" href="../"><svg class="logo-mark" viewBox="0 0 32 32" aria-hidden="true"><g fill="currentColor"><circle cx="16" cy="4" r="2.9"/><circle cx="23.5" cy="4.6" r="2.9"/><circle cx="8.5" cy="10" r="2.9"/><circle cx="23.5" cy="22" r="2.9"/><circle cx="8.5" cy="27.4" r="2.9"/><circle cx="16" cy="28" r="2.9"/></g><circle cx="16" cy="16" r="3.6" fill="#1f2de6"/></svg>SwarmKit</a>
      <nav class="nav__links" aria-label="Main">
        <div class="nav__item"><a class="nav__link" href="../docs/"${slug==='docs'?' aria-current="page"':''}>Docs</a></div>
        <div class="nav__item"><a class="nav__link" href="../reference/"${slug==='reference'?' aria-current="page"':''}>Reference</a></div>
        <div class="nav__item"><a class="nav__link" href="../agents/"${slug==='agents'?' aria-current="page"':''}>Agents</a></div>
        <div class="nav__item"><a class="nav__link" href="https://swarmkit-coop.pages.dev/">Market demo</a></div>
      </nav>
      <div class="nav__actions"><a class="btn btn--secondary" href="https://github.com/mikemoulder/swarmkit">View on GitHub</a></div>
    </div>
  </header>
  <main class="docs">
    <div class="wrap">
      <nav class="docs-nav" aria-label="Documentation">
        <button class="docs-menu" type="button" aria-expanded="false" aria-controls="docs-groups">Browse the docs <span aria-hidden="true">+</span></button>
        <label class="docs-nav__search">Search the docs<input type="search" id="doc-search" autocomplete="off" placeholder="createRound, journal, Intents"></label>
        <div id="search-results" aria-live="polite"></div>
        <div class="docs-nav__groups" id="docs-groups">${navigation}</div>
      </nav>
      <article class="doc" id="doc">
        <p class="doc__crumb">Docs / ${current}</p>
        <h1>${title}</h1>
        <p class="doc__lead">${description}</p>
        <div class="doc__actions"><button class="btn btn--secondary" id="copy-page" type="button">Copy page as text</button><a class="link" href="../llms-full.txt">Read every page as plain text</a></div>
        <div class="doc__body">${highlightBlocks(indexedBody)}</div>
        <nav class="doc__next" aria-label="Next page"><span>Next</span><a href="../${next[0]}/">${next[1]} →</a></nav>
      </article>
      <aside class="docs-toc" aria-label="On this page"><h2>On this page</h2>${headings.map(([id,label])=>`<a href="#${id}">${label.replace(/<[^>]*>/g,'')}</a>`).join('')}</aside>
    </div>
  </main>
  <footer class="docs-foot"><div class="wrap"><span>© 2026 SwarmKit · near-swarmkit 0.1.0 · MIT or Apache-2.0</span><nav aria-label="Footer"><a href="../">Home</a><a href="../llms.txt">llms.txt</a><a href="https://github.com/mikemoulder/swarmkit">SDK source</a><a href="https://github.com/mikemoulder/swarmkit-market">Market source</a></nav></div></footer>
<script src="../docs.js" defer></script></body>
</html>
`;
  await mkdir(join(root, slug), { recursive: true });
  await writeFile(join(root, slug, "index.html"), html);
}

const plain = value => value.replace(/<[^>]*>/g,' ').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&').replace(/[ \t]+/g,' ');
await writeFile(join(root,'search-index.json'), JSON.stringify(pages.map(([slug,title,description,body]) => ({ slug,title,description,text:plain(body) }))));
await writeFile(join(root,'llms-full.txt'), pages.map(([slug,title,description,body]) => `# ${title}\nhttps://swarmkit.pages.dev/${slug}/\n${description}\n${plain(body)}\n`).join('\n'));
await writeFile(join(root,'llms.txt'), '# SwarmKit\n\nTypeScript SDK for procurement and agent coordination on NEAR. Package: near-swarmkit.\n\n' + pages.map(([slug,title])=>`- [${title}](https://swarmkit.pages.dev/${slug}/)`).join('\n') + '\n- [Full documentation](https://swarmkit.pages.dev/llms-full.txt)\n\nUse canonical integer strings. Authenticate actors outside the SDK. Keep checkpoints and signing keys private. Never raise spending caps without buyer authorization. Distinguish simulation, native testnet transfers and actual Intents execution.\n');
