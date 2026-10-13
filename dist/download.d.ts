/**
 * Prépare le dossier modèle `mini` d'un workflow, prêt pour {@link loadMini}.
 *
 * @param {string} workflow - Le workflow (par exemple `"customer_service"`).
 * @param {string} version - Le tag de release (`"v0.1.0"` par défaut).
 * @returns {Promise<string>} Le chemin du dossier (`model.json` + ONNX + tokeniseur).
 * @throws {Error} En cas d'échec réseau ou de SHA256 invalide.
 * @example
 * ```ts
 * const dir = await ensureMiniModel("customer_service");
 * const mini = await loadMini(dir);
 * ```
 */
export declare function ensureMiniModel(workflow: string, version?: string): Promise<string>;
//# sourceMappingURL=download.d.ts.map