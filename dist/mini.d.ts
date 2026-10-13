export interface MiniModel {
    run: (state: string, question: string) => Promise<{
        decision: string;
        confidence: number;
    }>;
}
export declare function loadMini(modelDir: string): Promise<MiniModel>;
//# sourceMappingURL=mini.d.ts.map