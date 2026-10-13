function tokens(s) {
    const words = s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => /^[a-z]{3,}$/.test(w));
    const out = [...words];
    for (let i = 0; i < words.length - 1; i++)
        out.push(`${words[i]} ${words[i + 1]}`);
    return out;
}
/**
 * Vectorizes `state`: sublinear TF (`1 + ln(c)`), IDF, L2 norm.
 *
 * @param {string} state - The text to vectorize.
 * @param {ModelWeights} w - The weights (vocabulary + IDF).
 * @returns {number[]} The sparse vector (dense here, `vocab.length` dims).
 */
export function featurize(state, w) {
    const counts = new Map();
    for (const t of tokens(state))
        counts.set(t, (counts.get(t) ?? 0) + 1);
    const x = new Array(w.vocab.length).fill(0);
    let norm = 0;
    for (let i = 0; i < w.vocab.length; i++) {
        const v = w.vocab[i];
        const c = counts.get(v) ?? 0;
        if (c > 0) {
            const tf = 1 + Math.log(c);
            const val = tf * w.idf[i];
            x[i] = val;
            norm += val * val;
        }
    }
    norm = Math.sqrt(norm);
    if (norm > 0)
        for (let i = 0; i < x.length; i++)
            x[i] /= norm;
    return x;
}
/**
 * Decides a question: dot product + sigmoid (binary) or softmax.
 *
 * @param {string} state - The text to decide on.
 * @param {ModelWeights} w - The domain weights.
 * @param {string} question - The question (a `w.questions` key).
 * @returns The decision (winning class) and its confidence (max probability).
 * @throws {Error} When the question is unknown to the model.
 * @example
 * ```ts
 * predict("facture double, remboursement urgent", weights, "category");
 * // { decision: "billing", confidence: 0.93 }
 * ```
 */
export function predict(state, w, question) {
    const q = w.questions[question];
    if (!q)
        throw new Error(`question inconnue: ${question}`);
    const x = featurize(state, w);
    // sklearn binary case: a single coef row (positive class), sigmoid decision.
    if (q.classes.length === 2 && q.coef.length === 1) {
        const row = q.coef[0];
        let s = q.intercept[0];
        for (let j = 0; j < row.length; j++)
            if (x[j] !== 0)
                s += row[j] * x[j];
        const pPos = 1 / (1 + Math.exp(-s));
        const positive = pPos >= 0.5;
        return {
            decision: positive ? q.classes[1] : q.classes[0],
            confidence: Math.round((positive ? pPos : 1 - pPos) * 1000) / 1000,
        };
    }
    const scores = q.coef.map((row, i) => {
        let s = q.intercept[i];
        for (let j = 0; j < row.length; j++)
            if (x[j] !== 0)
                s += row[j] * x[j];
        return s;
    });
    const max = Math.max(...scores);
    const exps = scores.map((s) => Math.exp(s - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    let bi = 0;
    for (let i = 1; i < exps.length; i++)
        if (exps[i] > exps[bi])
            bi = i;
    return {
        decision: q.classes[bi],
        confidence: Math.round((exps[bi] / sum) * 1000) / 1000,
    };
}
