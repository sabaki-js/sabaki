// Generates the raster assets from public/assets/logo.svg:
// favicons, app icons, header logo, Open Graph images (EN + FR) and the
// mascot placeholders (drop your real illustrations over them, same file names).
//
//   npm run assets
import fs from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const A = path.join(ROOT, "public/assets");
const FONTS = [
  path.join(ROOT, "scripts/fonts/BricolageGrotesque-800.ttf"),
  path.join(ROOT, "scripts/fonts/BricolageGrotesque-700.ttf"),
];
const WASHI = "#fbf5ed";
const ORANGE = "#d4571c";
const SUMI = "#2a1b13";

const logoSvg = fs.readFileSync(path.join(A, "logo.svg"), "utf8");
const invertedLogoSvg = logoSvg
  .replaceAll(ORANGE, "@@A@@")
  .replaceAll(WASHI, ORANGE)
  .replaceAll("@@A@@", WASHI);

const render = (svg, width) =>
  new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: "Bricolage Grotesque" },
  })
    .render()
    .asPng();

const logoPng = (size, inverted = false) => render(inverted ? invertedLogoSvg : logoSvg, size);
const write = (name, buf) => {
  fs.writeFileSync(path.join(A, name), buf);
  console.log(name.padEnd(26), `${(buf.length / 1024).toFixed(1)} KB`);
};

// ---- Logo + icons -----------------------------------------------------------
write("logo-512.png", logoPng(512));
for (const [name, size] of [["logo-64.webp", 64], ["logo-128.webp", 128]]) {
  write(name, await sharp(logoPng(size)).webp({ quality: 92, alphaQuality: 100 }).toBuffer());
}
const iconOnWashi = async (size, pad) =>
  sharp({ create: { width: size, height: size, channels: 4, background: WASHI } })
    .composite([{ input: logoPng(Math.round(size * (1 - pad * 2))), gravity: "center" }])
    .png()
    .toBuffer();
write("apple-touch-icon.png", await iconOnWashi(180, 0.06));
write("icon-192.png", await iconOnWashi(192, 0.06));
write("icon-512.png", await iconOnWashi(512, 0.06));
const fav32 = logoPng(32);
const fav48 = logoPng(48);
write("favicon-32.png", fav32);
// ICO container embedding two PNG images (32 + 48).
{
  const imgs = [{ s: 32, b: fav32 }, { s: 48, b: fav48 }];
  const head = Buffer.alloc(6 + 16 * imgs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(imgs.length, 4);
  let offset = head.length;
  imgs.forEach((im, i) => {
    const o = 6 + i * 16;
    head.writeUInt8(im.s, o); head.writeUInt8(im.s, o + 1); head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(im.b.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += im.b.length;
  });
  write("favicon.ico", Buffer.concat([head, ...imgs.map((i) => i.b)]));
}

// ---- Open Graph images (1200x630) ---------------------------------------------
const logoDataUri = `data:image/png;base64,${logoPng(560).toString("base64")}`;
const og = (lines, tag, cta) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${WASHI}"/>
  <rect x="0" y="0" width="1200" height="14" fill="${ORANGE}"/>
  <circle cx="300" cy="330" r="268" fill="#f3e8d8"/>
  <image href="${logoDataUri}" x="40" y="70" width="520" height="520"/>
  <text x="620" y="150" font-family="Bricolage Grotesque" font-weight="800" font-size="46" fill="${ORANGE}">sabaki</text>
  ${lines
    .map(
      (l, i) =>
        `<text x="620" y="${236 + i * 78}" font-family="Bricolage Grotesque" font-weight="800" font-size="70" letter-spacing="-1.5" fill="${SUMI}">${l}</text>`,
    )
    .join("\n  ")}
  <text x="620" y="${236 + lines.length * 78 + 12}" font-family="Bricolage Grotesque" font-weight="700" font-size="30" fill="#6b5646">${tag}</text>
  <rect x="620" y="510" width="330" height="64" rx="14" fill="${SUMI}"/>
  <text x="650" y="552" font-family="Bricolage Grotesque" font-weight="700" font-size="30" fill="${WASHI}">${cta}</text>
</svg>`;
write("og-image.png", render(og(["Typed decisions", "on CPU, in", "milliseconds."], "Nano and mini models, plugin routing.", "npm i sabaki"), 1200));
write("og-image-fr.png", render(og(["Décisions typées", "sur CPU, en", "millisecondes."], "Modèles nano et mini, greffons routés.", "npm i sabaki"), 1200));

// ---- Mascot placeholders (replace with the real illustrations, same names) -----
const MASCOTS = [
  { name: "hero", w: 600, h: 600, bg: WASHI },
  { name: "router", w: 1200, h: 900, bg: WASHI },
  { name: "nano", w: 800, h: 800, bg: WASHI },
  { name: "mini", w: 800, h: 800, bg: WASHI },
  { name: "plugins", w: 1200, h: 900, bg: WASHI },
  { name: "unknown", w: 800, h: 800, bg: WASHI },
  { name: "cpu-sleep", w: 1200, h: 900, bg: ORANGE, inverted: true },
];
for (const m of MASCOTS) {
  const glyph = Math.round(Math.min(m.w, m.h) * 0.56);
  const buf = await sharp({ create: { width: m.w, height: m.h, channels: 4, background: m.bg } })
    .composite([{ input: logoPng(glyph, !!m.inverted), gravity: "center" }])
    .webp({ quality: 80 })
    .toBuffer();
  fs.writeFileSync(path.join(A, "mascot", `${m.name}.webp`), buf);
  console.log(`mascot/${m.name}.webp`.padEnd(26), `${(buf.length / 1024).toFixed(1)} KB`, `${m.w}x${m.h}`);
}
