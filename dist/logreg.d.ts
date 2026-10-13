export interface QuestionWeights {
    classes: string[];
    coef: number[][];
    intercept: number[];
}
export interface ModelWeights {
    workflow: string;
    vocab: string[];
    idf: number[];
    questions: Record<string, QuestionWeights>;
}
export declare function featurize(state: string, w: ModelWeights): number[];
export declare function predict(state: string, w: ModelWeights, question: string): {
    decision: string;
    confidence: number;
};
//# sourceMappingURL=logreg.d.ts.map