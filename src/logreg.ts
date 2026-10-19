/**
 * Pure-TS TF-IDF LogReg inference, exact parity with sklearn
 * (`TfidfVectorizer` + `LogisticRegression`: `sublinear_tf`, smoothed idf,
 * L2 norm, `[a-z]{3,}` uni+bigrams, binary sigmoid / multi-class softmax).
 * Verified on 20 questions (see `gpu/train.py`).
 */
export interface QuestionWeights {
	/** Labels in `coef` row order (binary: 1 row = positive class). */
	classes: string[];
	/** Coefficients `[class][term]` (rounded to 1e-4, no measured loss). */
	coef: number[][];
	/** Per-class biases. */
	intercept: number[];
}

/** TF-IDF + LogReg weights of a domain (produced by `gpu/train.py`). */
export interface ModelWeights {
	/** Domain (e.g. `"customer_service"`). */
	workflow: string;
	/** Uni+bigram vocabulary (max 3000, `min_df` per training). */
	vocab: string[];
	/** sklearn smoothed IDF (`log((1+n)/(1+df)) + 1`). */
	idf: number[];
	/** Per-typed-question weights. */
	questions: Record<string, QuestionWeights>;
}

function tokens(s: string): string[] {
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
export function featurize(state: string, w: ModelWeights): number[] {
	const counts = new Map<string, number>();
	for (const t of tokens(state)) counts.set(t, (counts.get(t) ?? 0) + 1);
	const index = new Map<string, number>();
	for (let i = 0; i < w.vocab.length; i++) index.set(w.vocab[i]!, i);
	const x = new Array(w.vocab.length).fill(0);
	let norm = 0;
	// Touche seulement les termes presents (creux) au lieu de balayer 3000 dims.
	for (const [t, c] of counts) {
		const i = index.get(t);
		if (i === undefined) continue;
		const tf = 1 + Math.log(c);
		const val = tf * w.idf[i]!;
		x[i] = val;
		norm += val * val;
	}
	norm = Math.sqrt(norm);
	if (norm > 0) {
		for (const [t] of counts) {
			const i = index.get(t);
			if (i !== undefined && x[i] !== 0) x[i]! /= norm;
		}
	}
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
export function predict(
	state: string,
	w: ModelWeights,
	question: string,
): { decision: string; confidence: number } {
	const q = w.questions[question];
	if (!q) throw new Error(`question inconnue: ${question}`);
	const x = featurize(state, w);
	// sklearn binary case: a single coef row (positive class), sigmoid decision.
	if (q.classes.length === 2 && q.coef.length === 1) {
		const row = q.coef[0]!;
		let s = q.intercept[0]!;
		for (let j = 0; j < row.length; j++) if (x[j] !== 0) s += row[j]! * x[j]!;
		const pPos = 1 / (1 + Math.exp(-s));
		const positive = pPos >= 0.5;
		return {
			decision: positive ? q.classes[1]! : q.classes[0]!,
			confidence: Math.round((positive ? pPos : 1 - pPos) * 1000) / 1000,
		};
	}
	const scores = q.coef.map((row, i) => {
		let s = q.intercept[i]!;
		for (let j = 0; j < row.length; j++) if (x[j] !== 0) s += row[j]! * x[j]!;
		return s;
	});
	const max = Math.max(...scores);
	const exps = scores.map((s) => Math.exp(s - max));
	const sum = exps.reduce((a, b) => a + b, 0);
	let bi = 0;
	for (let i = 1; i < exps.length; i++) if (exps[i]! > exps[bi]!) bi = i;
	return {
		decision: q.classes[bi]!,
		confidence: Math.round((exps[bi]! / sum) * 1000) / 1000,
	};
}
