export interface MiniModel {
    run: (state: string, question: string) => Promise<{
        decision: string;
        confidence: number;
    }>;
}
/**
 * Loads a `mini` model from a directory prepared by {@link ensureMiniModel}
 * (`model.json` + `.onnx` + `tokenizer.json`). ~10–25 ms/req on desktop CPU.
 *
 * @param {string} modelDir - The model directory.
 * @returns {Promise<MiniModel>} The model (`run(state, question)`).
 * @throws {Error} When `onnxruntime-node` is not installed.
 * @example
 * ```ts
 * const mini = await loadMini(await ensureMiniModel("customer_service"));
 * await mini.run("facture double, remboursement urgent", "category");
 * // { decision: "billing", confidence: 0.93 }
 * ```
 */
export declare function loadMini(modelDir: string): Promise<MiniModel>;
//# sourceMappingURL=mini.d.ts.map