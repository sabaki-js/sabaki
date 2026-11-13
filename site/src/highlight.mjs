// Tiny build-time syntax highlighter for the snippets (ts, bash, json). No runtime JS needed.
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const span = (c, s) => `<span class="tk-${c}">${esc(s)}</span>`;

const TS_KEYWORDS = new Set(["import", "from", "const", "new", "await", "if", "else", "export", "default", "return", "async", "function"]);

function tokenize(src, rules) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    let matched = false;
    for (const [re, cls] of rules) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (m && m.index === i && m[0].length) {
        out += cls ? span(cls, m[0]) : esc(m[0]);
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) { out += esc(src[i]); i++; }
  }
  return out;
}

const ts = [
  [/\/\/[^\n]*/y, "c"],
  [/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/y, "s"],
  [/\b\d+(?:\.\d+)?\b/y, "n"],
  [/\b[A-Za-z_$][\w$]*(?=\s*\()/y, "f"],
  [/\b[A-Za-z_$][\w$]*\b/y, null],
];
const json = [
  [/"(?:[^"\\\n]|\\.)*"(?=\s*:)/y, "k"],
  [/"(?:[^"\\\n]|\\.)*"/y, "s"],
  [/\b\d+(?:\.\d+)?\b/y, "n"],
];
const bash = [
  [/#[^\n]*/y, "c"],
  [/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/y, "s"],
  [/(?<=^|\s)-{1,2}[A-Za-z][\w-]*/y, "k"],
];

export function highlight(src, lang) {
  if (lang === "ts") {
    // keywords handled after tokenization of identifiers
    const html = tokenize(src, ts);
    return html.replace(/(^|[^\w>-])(import|from|const|new|await|if|else|export|default|return|async|function)(?![\w-])(?![^<]*<\/span>)/g, (m, a, k) => `${a}<span class="tk-k">${k}</span>`);
  }
  if (lang === "json") return tokenize(src, json);
  if (lang === "bash") return tokenize(src, bash);
  return esc(src);
}
