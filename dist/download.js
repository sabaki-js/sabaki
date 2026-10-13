/**
 * Téléchargement des poids `mini` depuis les Releases `sabaki-models`
 * (sans authentification), avec vérification SHA256 et cache local
 * (`~/.cache/sabaki/<version>/<workflow>/`). Les fichiers valides ne sont
 * jamais retéléchargés ; un fichier corrompu est supprimé et signalé.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
const RELEASE = "https://github.com/sabaki-js/sabaki-models/releases/download/v0.1.0";
const CACHE = path.join(os.homedir(), ".cache", "sabaki");
function sha256(file) {
    return new Promise((resolve, reject) => {
        const h = crypto.createHash("sha256");
        fs.createReadStream(file)
            .on("data", (d) => h.update(d))
            .on("end", () => resolve(h.digest("hex")))
            .on("error", reject);
    });
}
async function fetchFile(url, dest) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok || !res.body)
        throw new Error(`téléchargement ${url} : ${res.status}`);
    await new Promise((resolve, reject) => {
        const w = fs.createWriteStream(dest);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.body
            .pipeTo(new WritableStream({
            write: (c) => void w.write(c),
            close: () => (w.end(), resolve()),
        }))
            .catch(reject);
        w.on("error", reject);
    });
}
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
export async function ensureMiniModel(workflow, version = "v0.1.0") {
    const releaseBase = `https://github.com/sabaki-js/sabaki-models/releases/download/${version}`;
    const dir = path.join(CACHE, version, workflow);
    fs.mkdirSync(dir, { recursive: true });
    const sums = {};
    const sumsCached = path.join(CACHE, version, "SHA256SUMS");
    if (!fs.existsSync(sumsCached)) {
        await fetchFile(`${releaseBase}/SHA256SUMS`, sumsCached);
    }
    for (const line of fs.readFileSync(sumsCached, "utf8").split("\n")) {
        const m = line.match(/^([0-9a-f]{64})\s+(.+)$/);
        if (m)
            sums[m[2]] = m[1];
    }
    const files = [
        `minilaya-onnx/${workflow}.onnx`,
        `minilaya-onnx/${workflow}.onnx.data`,
        `minilaya-onnx/${workflow}.json`,
        "minilaya-onnx/tokenizer/tokenizer.json",
    ];
    for (const f of files) {
        const base = path.basename(f);
        const dest = path.join(dir, base);
        const sum = sums[f] ?? sums[base];
        const ok = fs.existsSync(dest) && sum && (await sha256(dest)) === sum;
        if (!ok) {
            await fetchFile(`${releaseBase}/${encodeURIComponent(base)}`, dest);
            if (sum && (await sha256(dest)) !== sum) {
                fs.unlinkSync(dest);
                throw new Error(`SHA256 invalide pour ${f}`);
            }
        }
    }
    fs.writeFileSync(path.join(dir, "model.json"), JSON.stringify({
        model: `${workflow}.onnx`,
        config: JSON.parse(fs.readFileSync(path.join(dir, `${workflow}.json`), "utf8")),
    }));
    return dir;
}
