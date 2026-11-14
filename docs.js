const input = document.getElementById('doc-search');
document.querySelector('.doc-menu')?.addEventListener('click', event => {
  const open=document.querySelector('.docs-nav').toggleAttribute('data-open');
  event.currentTarget.setAttribute('aria-expanded',String(open));
  event.currentTarget.textContent=open?'Close navigation −':'Browse documentation +';
});
document.getElementById('copy-page')?.addEventListener('click', async event => {
  try {await navigator.clipboard.writeText(document.querySelector('.docs-content').innerText);event.currentTarget.textContent='Copied';}
  catch {event.currentTarget.textContent='Select page text to copy';}
});
let index;
input?.addEventListener('input', async () => {
  try {
    index ??= await (await fetch('../search-index.json')).json();
    const query = input.value.trim().toLowerCase();
    const target = document.getElementById('search-results'); target.replaceChildren();
    if (query.length < 2) return;
    const matches = index.filter(page => `${page.title} ${page.description} ${page.text}`.toLowerCase().includes(query));
    for (const page of matches) { const link = document.createElement('a'); link.href = `../${page.slug}/`; link.textContent = page.title; target.append(link); }
    if (!matches.length) target.textContent = 'No matching guide. Try a function name or topic.';
  } catch { document.getElementById('search-results').textContent = 'Search unavailable. Use the guide links below.'; }
});
for (const pre of document.querySelectorAll('.docs-content pre')) {
  const button = document.createElement('button'); button.className = 'copy-code'; button.textContent = 'Copy code';
  button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pre.querySelector('code')?.textContent ?? pre.textContent); button.textContent = 'Copied'; }
    catch { button.textContent = 'Select and copy the code'; }
  });
  pre.before(button);
}
