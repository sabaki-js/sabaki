/**
 * Inférence LogReg TF-IDF en pur TS, parité exacte avec sklearn
 * (`TfidfVectorizer` + `LogisticRegression` : `sublinear_tf`, idf lissée,
 * norme L2, uni+bigrammes `[a-z]{3,}`, sigmoid binaire / softmax multi-classes).
 * Vérifiée sur 20 questions (voir `gpu/train.py`).
 */
export interface QuestionWeights {
    /** Étiquettes dans l'ordre des lignes de `coef` (binaire : 1 ligne = classe positive). */
    classes: string[];
    /** Coefficients `[classe][terme]` (arrondis à 1e-4 sans perte mesurée). */
    coef: number[][];
    /** Biais par classe. */
    intercept: number[];
}
/** Poids TF-IDF + LogReg d'un domaine (produits par `gpu/train.py`). */
export interface ModelWeights {
    /** Domaine (par exemple `"customer_service"`). */
    workflow: string;
    /** Vocabulaire uni+bigrammes (max 3000, `min_df` selon l'entraînement). */
    vocab: string[];
    /** IDF lissée de sklearn (`log((1+n)/(1+df)) + 1`). */
    idf: number[];
    /** Poids par question typée. */
    questions: Record<string, QuestionWeights>;
}
/**
 * Vectorise `state` : TF sous-linéaire (`1 + ln(c)`), IDF, norme L2.
 *
 * @param {string} state - Le texte à vectoriser.
 * @param {ModelWeights} w - Les poids (vocabulaire + IDF).
 * @returns {number[]} Le vecteur creux (dense ici, `vocab.length` dims).
 */
export declare function featurize(state: string, w: ModelWeights): number[];
/**
 * Tranche une question : produit scalaire + sigmoid (binaire) ou softmax.
 *
 * @param {string} state - Le texte à trancher.
 * @param {ModelWeights} w - Les poids du domaine.
 * @param {string} question - La question (clé de `w.questions`).
 * @returns La décision (classe gagnante) et sa confiance (probabilité max).
 * @throws {Error} Si la question est inconnue du modèle.
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