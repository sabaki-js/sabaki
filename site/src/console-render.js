// Renders the result panel of the demo console. Used at build time (static HTML,
// so crawlers and no-JS visitors see a real result) and in the browser (live).
// `S` is the JSON-serializable string table (see i18n.mjs, section `console`).

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fmt = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k]);

/** Formats a number with the language's decimal mark. */
export const num = (S, v, digits) => {
  const x = typeof digits === "number" ? Number(v).toFixed(digits) : String(v);
  return S.decimal === "," ? x.replace(".", ",") : x;
};

/**
 * state = {
 *   route: { domain, plugin|null, confidence, threshold, scores: [{plugin:{domain}, score}] },
 *   answers: [{ question, primary, decision, confidence, probabilities }],
 *   ms: number | null,           // null in static mode
 *   modelId: string | null,
 * }
 */
export function renderResult(S, state) {
  const { route, answers, ms } = state;
  const scale = Math.max(1.2, ...route.scores.map((s) => s.score));
  const bars = route.scores
    .map((s) => {
      const picked = route.plugin && s.plugin.domain === route.plugin.domain;
      return `<li class="route-bar${picked ? " is-picked" : ""}">
        <span class="rb-name">${esc(s.plugin.domain)}</span>
        <span class="rb-track" aria-hidden="true"><span class="rb-fill" style="width:${Math.min(100, (s.score / scale) * 100).toFixed(1)}%"></span><span class="rb-thr" style="left:${((route.threshold / scale) * 100).toFixed(1)}%"></span></span>
        <span class="rb-score">${num(S, s.score, 2)}</span>
      </li>`;
    })
    .join("");

  const routeMsg = route.plugin
    ? fmt(S.routed, { name: esc(route.plugin.name), score: num(S, route.confidence, 2), thr: num(S, route.threshold, 2) })
    : fmt(S.unknown, { thr: num(S, route.threshold, 2) });

  let answersHtml = "";
  let jsonObj;
  if (route.plugin) {
    const rows = answers
      .map((a) => {
        const ok = a.confidence >= 0.8;
        return `<tr${a.primary ? ' class="is-primary"' : ""}>
          <th scope="row"><code>${esc(a.question)}</code>${a.primary ? `<span class="tag">${esc(S.primary)}</span>` : ""}</th>
          <td class="ans-value">${esc(a.decision)}</td>
          <td class="ans-conf"><span class="meter" aria-hidden="true"><span class="meter-fill" style="width:${(a.confidence * 100).toFixed(1)}%"></span></span><span class="ans-num">${num(S, a.confidence, 3)}</span><span class="ans-flag ${ok ? "is-ok" : "is-low"}">${esc(ok ? S.automate : S.review)}</span></td>
        </tr>`;
      })
      .join("");
    const primary = answers.find((a) => a.primary) ?? answers[0];
    const verdict = fmt(primary.confidence >= 0.8 ? S.verdictOk : S.verdictLow, { c: num(S, primary.confidence, 3) });
    answersHtml = `<div class="answers">
      <h3 class="mini-h">${esc(S.answersTitle)}</h3>
      <div class="table-wrap"><table class="ans-table">
        <thead><tr><th scope="col">${esc(S.colQuestion)}</th><th scope="col">${esc(S.colAnswer)}</th><th scope="col">${esc(S.colConfidence)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      <p class="verdict">${esc(verdict)}</p>
    </div>`;
    jsonObj = {
      model: state.modelId,
      answers: Object.fromEntries(
        answers.map((a) => [a.question, { type: "choice", choice: a.decision, confidence: a.confidence }]),
      ),
    };
  } else {
    jsonObj = { domain: "unknown", decision: null, confidence: 0, plugin: null };
  }

  const n = answers.length;
  const timing =
    ms === null
      ? fmt(n === 1 ? S.staticOne : S.staticMany, { n })
      : fmt(n === 1 ? S.timingOne : S.timingMany, { n, ms: num(S, ms < 10 ? ms.toFixed(2) : ms.toFixed(1)) });

  return `<div class="route">
      <h3 class="mini-h">${esc(S.routerTitle)}</h3>
      <ul class="route-bars" role="list">${bars}</ul>
      <p class="route-msg">${routeMsg}</p>
    </div>
    ${answersHtml}
    <p class="timing">${esc(route.plugin ? timing : "")}</p>
    <details class="json"><summary>${esc(S.json)}</summary><pre><code>${esc(JSON.stringify(jsonObj, null, 2))}</code></pre></details>`;
}
