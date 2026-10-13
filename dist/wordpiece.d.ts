export interface MiniVocab {
    vocab: Map<string, number>;
    unk: string;
}
export declare function loadVocab(tokenizerJson: unknown): MiniVocab;
export declare function encode(text: string, v: MiniVocab, maxLen?: number): {
    ids: number[];
    mask: number[];
};
//# sourceMappingURL=wordpiece.d.ts.map