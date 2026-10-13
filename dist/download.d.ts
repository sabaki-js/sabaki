/**
 * Prepares a workflow's `mini` model directory, ready for {@link loadMini}.
 *
 * @param {string} workflow - The workflow (e.g. `"customer_service"`).
 * @param {string} version - The release tag (default `"v0.1.0"`).
 * @returns {Promise<string>} The directory path (`model.json` + ONNX + tokenizer).
 * @throws {Error} On network failure or invalid SHA256.
 * @example
 * ```ts
 * const dir = await ensureMiniModel("customer_service");
 * const mini = await loadMini(dir);
 * ```
 */
export declare function ensureMiniModel(workflow: string, version?: string): Promise<string>;
//# sourceMappingURL=download.d.ts.map