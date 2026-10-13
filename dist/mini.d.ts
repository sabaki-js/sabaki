export interface MiniModel {
    run: (state: string, question: string) => Promise<{
        decision: string;
        confidence: number;
    }>;
}
/**
 * Charge un modèle `mini` depuis un dossier préparé par {@link ensureMiniModel}
 * (`model.json` + `.onnx` + `tokenizer.json`). ~10–25 ms/req sur CPU desktop.
 *
 * @param {string} modelDir - Le dossier modèle.
 * @returns {Promise<MiniModel>} Le modèle (`run(state, question)`).
 * @throws {Error} Si `onnxruntime-node` n'est pas installé.
 * @example
 * ```ts
 * const mini = await loadMini(await ensureMiniModel("customer_service"));
 * await mini.run("facture double, remboursement urgent", "category");
 * // { decision: "billing", confidence: 0.93 }
 * ```
 */
export declare function loadMini(modelDir: string): Promise<MiniModel>;
//# sourceMappingURL=mini.d.ts.map