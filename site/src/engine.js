// Browser/Node port of sabaki's nano engine (router + TF-IDF logistic regression).
// Mirrors sabaki/src/index.ts (Sabaki.route) and sabaki/src/logreg.ts (predict) 1:1,
// except that predict() also returns the full probability distribution.

const ROUTE_THRESHOLD = 0.15;

/** Router tokenization: lowercase, accents stripped, words of 4+ letters/digits. */
function routeTokens(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
}

/**
 * Scores every plugin with hits / sqrt(|keywords|) and picks the best one.
 * Below the plugin's threshold (default 0.15) the domain is "unknown".
 */
export function route(state, plugins) {
  const words = routeTokens(state);
  const scores = plugins.map((p) => {
    const kws = p.keywords.map((k) => k.toLowerCase());
    const hits = kws.filter((k) => words.some((w) => w.includes(k) || k.includes(w))).length;
    return { plugin: p, hits, score: hits / Math.sqrt(kws.length) };
  });
  let best = null;
  for (const s of scores) if (!best || s.score > best.score) best = s;
  const threshold = best ? best.plugin.threshold ?? ROUTE_THRESHOLD : ROUTE_THRESHOLD;
  const unknown = !best || best.score < threshold;
  return {
    domain: unknown ? "unknown" : best.plugin.domain,
    plugin: unknown ? null : best.plugin,
    confidence: unknown ? 0 : Math.round(best.score * 100) / 100,
    threshold,
    scores,
  };
}

/** Model tokenization: [a-z]{3,} words + bigrams (sklearn TfidfVectorizer parity). */
function modelTokens(s) {
  const words = s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => /^[a-z]{3,}$/.test(w));
  const out = [...words];
  for (let i = 0; i < words.length - 1; i++) out.push(`${words[i]} ${words[i + 1]}`);
  return out;
}

function featurize(state, w) {
  const counts = new Map();
  for (const t of modelTokens(state)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const x = new Float64Array(w.vocab.length);
  let norm = 0;
  for (let i = 0; i < w.vocab.length; i++) {
    const c = counts.get(w.vocab[i]) ?? 0;
    if (c > 0) {
      const val = (1 + Math.log(c)) * w.idf[i];
      x[i] = val;
      norm += val * val;
    }
  }
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < x.length; i++) x[i] /= norm;
  return x;
}

/** Decides one question. Returns { decision, confidence, probabilities: [{label, p}] } (sorted). */
export function predict(state, w, question) {
  const q = w.questions[question];
  if (!q) throw new Error(`unknown question: ${question}`);
  const x = featurize(state, w);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  let probs;
  if (q.classes.length === 2 && q.coef.length === 1) {
    const row = q.coef[0];
    let s = q.intercept[0];
    for (let j = 0; j < row.length; j++) if (x[j] !== 0) s += row[j] * x[j];
    const pPos = 1 / (1 + Math.exp(-s));
    probs = [1 - pPos, pPos];
  } else {
    const scores = q.coef.map((row, i) => {
      let s = q.intercept[i];
      for (let j = 0; j < row.length; j++) if (x[j] !== 0) s += row[j] * x[j];
      return s;
    });
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    probs = exps.map((e) => e / sum);
  }
  const ranked = q.classes
    .map((label, i) => ({ label, p: probs[i] }))
    .sort((a, b) => b.p - a.p);
  return {
    decision: ranked[0].label,
    confidence: r3(ranked[0].p),
    probabilities: ranked.map((r) => ({ label: r.label, p: r3(r.p) })),
  };
}
