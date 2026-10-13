/**
 * Minimal WordPiece for `mini` models (Hugging Face `tokenizer.json`
 * vocabulary, uncased models like MiniLM). Exact ID parity with
 * `transformers`: NFD + lowercase normalization, isolated punctuation,
 * greedy longest-match, `[CLS]`/`[SEP]`.
 */
export interface MiniVocab {
    vocab: Map<string, number>;
    unk: string;
}
/**
 * Loads a vocabulary from a Hugging Face `tokenizer.json`.
 *
 * @param {unknown} tokenizerJson - The parsed `tokenizer.json` content.
 * @returns {MiniVocab} The indexed vocabulary.
 */
export declare function loadVocab(tokenizerJson: unknown): MiniVocab;
/**
 * Encodes text into IDs + attention mask (truncated to `maxLen`).
 *
 * @param {string} text - The text to encode.
 * @param {MiniVocab} v - The vocabulary (see `loadVocab`).
 * @param {number} maxLen - Max length, `[CLS]`/`[SEP]` included (default: 256).
 * @returns The `ids` and the `mask` (all 1s: no padding here).
 */
export declare function encode(text: string, v: MiniVocab, maxLen?: number): {
    ids: number[];
    mask: number[];
};
//# sourceMappingURL=wordpiece.d.ts.map