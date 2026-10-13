/**
 * WordPiece minimal pour les modèles `mini` (vocabulaire `tokenizer.json`
 * Hugging Face, modèles uncased type MiniLM). Parité d'IDs exacte avec
 * `transformers` : normalisation NFD + minuscules, ponctuation isolée,
 * plus-long-match glouton, `[CLS]`/`[SEP]`.
 */
export interface MiniVocab {
    vocab: Map<string, number>;
    unk: string;
}
/**
 * Charge un vocabulaire depuis un `tokenizer.json` Hugging Face.
 *
 * @param {unknown} tokenizerJson - Le contenu parsé de `tokenizer.json`.
 * @returns {MiniVocab} Le vocabulaire indexé.
 */
export declare function loadVocab(tokenizerJson: unknown): MiniVocab;
/**
 * Encode un texte en IDs + masque d'attention (tronqué à `maxLen`).
 *
 * @param {string} text - Le texte à encoder.
 * @param {MiniVocab} v - Le vocabulaire (voir `loadVocab`).
 * @param {number} maxLen - Longueur max, `[CLS]`/`[SEP]` inclus (défaut : 256).
 * @returns Les `ids` et le `mask` (que des 1 : pas de padding ici).
 */
export declare function encode(text: string, v: MiniVocab, maxLen?: number): {
    ids: number[];
    mask: number[];
};
//# sourceMappingURL=wordpiece.d.ts.map