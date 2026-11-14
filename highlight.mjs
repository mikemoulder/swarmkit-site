// Build-time syntax colouring for documentation code blocks. Input and output are HTML-escaped text;
// tokens become <span class="tk-…">. No runtime script, so search and llms text stay plain.
const unescape = s => s.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&');
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const wrap = (kind, text) => `<span class="tk-${kind}">${escape(text)}</span>`;

const KEYWORDS = 'const let var function return if else for of in while do await async import export from as type interface declare readonly new throw try catch finally class extends implements typeof keyof instanceof void delete default switch case break continue this yield static get set enum namespace satisfies';
const LITERALS = 'null undefined true false NaN Infinity';
const PRIMITIVES = 'string number bigint boolean unknown never any object symbol';
const words = list => list.split(' ').join('|');

const SCRIPT = new RegExp([
  String.raw`(\/\/[^\n]*|\/\*[\s\S]*?\*\/)`,                                   // 1 comment
  String.raw`("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\x60(?:\\.|[^\x60\\])*\x60)`, // 2 string
  String.raw`\b(\d[\d_]*(?:\.\d+)?n?)\b`,                                       // 3 number
  String.raw`\b(${words(KEYWORDS)})\b`,                                          // 4 keyword
  String.raw`\b(${words(LITERALS)})\b`,                                          // 5 literal
  String.raw`\b(${words(PRIMITIVES)})\b`,                                        // 6 primitive type
  String.raw`\b([A-Z][A-Za-z0-9_]*)\b`,                                          // 7 type or class
  String.raw`([A-Za-z_$][\w$]*)(?=\s*(?:<[^>\n]*>)?\s*\()`,                      // 8 function call or declaration
].join('|'), 'g');
const SCRIPT_KINDS = [, 'comment', 'string', 'number', 'keyword', 'literal', 'type', 'type', 'fn'];

function tokenise(code, re, kinds) {
  let out = '', last = 0;
  for (const m of code.matchAll(re)) {
    const group = m.findIndex((g, i) => i > 0 && g !== undefined);
    out += escape(code.slice(last, m.index)) + wrap(kinds[group], m[0]);
    last = m.index + m[0].length;
  }
  return out + escape(code.slice(last));
}

function shell(code) {
  return code.split('\n').map(line => {
    if (/^\s*#/.test(line)) return wrap('comment', line);
    let first = true;
    return line.split(/(\s+)/).map(part => {
      if (!part.trim()) return part;
      if (first) { first = false; return /^\$$/.test(part) ? wrap('comment', part) : wrap('fn', part); }
      if (/^--?[\w-]+/.test(part)) return wrap('keyword', part);
      if (/^["'].*["']$/.test(part)) return wrap('string', part);
      if (/^(https?:\/\/|\.{0,2}\/)/.test(part)) return wrap('string', part);
      return escape(part);
    }).join('');
  }).join('\n');
}

function http(code) {
  const [head, ...rest] = code.split('\n');
  const line = head.replace(/^([A-Z]+)(\s+)(\S+)(.*)$/, (_, verb, gap, path, tail) => wrap('keyword', verb) + gap + wrap('string', path) + escape(tail));
  return rest.length ? line + '\n' + tokenise(rest.join('\n'), SCRIPT, SCRIPT_KINDS) : line;
}

export function languageOf(code) {
  const first = code.trimStart().split('\n')[0];
  if (/^(\$\s|npm |npx |node |git |cd |curl |pnpm |yarn )/.test(first)) return 'shell';
  if (/^(GET|POST|PUT|PATCH|DELETE) \//.test(first)) return 'http';
  if (!/[;={}()]/.test(code)) return 'text';
  return 'ts';
}

// Colour every <pre><code> block of an HTML fragment.
export function highlightBlocks(html) {
  return html.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (whole, attrs, inner) => {
    if (inner.includes('<span')) return whole;
    const code = unescape(inner), lang = languageOf(code);
    const body = lang === 'shell' ? shell(code) : lang === 'http' ? http(code) : lang === 'text' ? escape(code) : tokenise(code, SCRIPT, SCRIPT_KINDS);
    return `<pre data-lang="${lang}"><code${attrs}>${body}</code></pre>`;
  });
}
