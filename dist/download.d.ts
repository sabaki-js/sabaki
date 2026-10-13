/**
 * Prepares a workflow's `mini` model directory, ready for {@link loadMini}.
 *
 * @param {string} workflow - The workflow (e.g. `"customer_service"`).
 * @param {string} version - The release tag (default `"v0.2.0"`).
 * @param {"int8" | "fp32"} variant - Quantized (default, ~22 MB) or full precision (~90 MB).
 * @returns {Promise<string>} The directory path (`model.json` + ONNX + tokenizer).
 * @throws {Error} On network failure or invalid SHA256.
 * @example
 * ```ts
 * const dir = await ensureMiniModel("customer_service");
 * const mini = await loadMini(dir);
 * ```
 */
export declare function ensureMiniModel(workflow: string, version?: string, variant?: "int8" | "fp32"): Promise<string>;
//# sourceMappingURL=download.d.ts.map