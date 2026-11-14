// Documentation pages: phone menu, search, copy buttons and the active heading in "On this page".
const nav = document.querySelector('.docs-nav');
const menu = document.querySelector('.docs-menu');
menu?.addEventListener('click', () => {
  const open = nav.toggleAttribute('data-open');
  menu.setAttribute('aria-expanded', String(open));
  menu.firstChild.textContent = open ? 'Close the docs menu ' : 'Browse the docs ';
  menu.querySelector('span').textContent = open ? '−' : '+';
});

document.getElementById('copy-page')?.addEventListener('click', async event => {
  const button = event.currentTarget;
  try { await navigator.clipboard.writeText(document.querySelector('.doc').innerText); button.textContent = 'Copied'; }
  catch { button.textContent = 'Select the text to copy it'; }
});

const input = document.getElementById('doc-search');
const results = document.getElementById('search-results');
let index;
input?.addEventListener('input', async () => {
  try {
    index ??= await (await fetch('../search-index.json')).json();
    const query = input.value.trim().toLowerCase();
    results.replaceChildren();
    if (query.length < 2) return;
    const matches = index.filter(page => `${page.title} ${page.description} ${page.text}`.toLowerCase().includes(query));
    for (const page of matches.slice(0, 8)) {
      const link = document.createElement('a');
      link.href = `../${page.slug}/`;
      link.textContent = page.title;
      results.append(link);
    }
    if (!matches.length) results.textContent = 'No page matches. Try a function name such as createRound.';
  } catch { results.textContent = 'Search could not load. Use the links below.'; }
});

for (const pre of document.querySelectorAll('.doc__body pre')) {
  const box = document.createElement('div');
  box.className = 'code-block';
  pre.before(box);
  box.append(pre);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-code';
  button.textContent = 'Copy';
  button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pre.querySelector('code')?.textContent ?? pre.textContent); button.textContent = 'Copied'; setTimeout(() => { button.textContent = 'Copy'; }, 1600); }
    catch { button.textContent = 'Select to copy'; }
  });
  box.append(button);
}

const tocLinks = [...document.querySelectorAll('.docs-toc a')];
if (tocLinks.length && 'IntersectionObserver' in window) {
  const byId = new Map(tocLinks.map(a => [a.hash.slice(1), a]));
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      tocLinks.forEach(a => a.classList.remove('is-on'));
      byId.get(entry.target.id)?.classList.add('is-on');
    }
  }, { rootMargin: '-80px 0px -70% 0px' });
  for (const id of byId.keys()) { const h = document.getElementById(id); if (h) observer.observe(h); }
}
