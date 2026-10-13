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
/**
 * Vectorizes `state`: sublinear TF (`1 + ln(c)`), IDF, L2 norm.
 *
 * @param {string} state - The text to vectorize.
 * @param {ModelWeights} w - The weights (vocabulary + IDF).
 * @returns {number[]} The sparse vector (dense here, `vocab.length` dims).
 */
export declare function featurize(state: string, w: ModelWeights): number[];
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
export declare function predict(state: string, w: ModelWeights, question: string): {
    decision: string;
    confidence: number;
};
//# sourceMappingURL=logreg.d.ts.map