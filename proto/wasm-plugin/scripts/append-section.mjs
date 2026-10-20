/**
 * Ajoute la section custom `sabaki` au module compile.
 *
 * Le marqueur permet de valider un plugin SANS l'instancier :
 *   magic "SABK" (4 octets) + version u16 LE (1) + ABI u16 LE (1)
 */
import fs from "node:fs";

const path = process.argv[2];
if (!path) {
	console.error("usage: append-section.mjs <module.wasm>");
	process.exit(1);
}

function leb(n) {
	const out = [];
	do {
		let b = n & 0x7f;
		n >>>= 7;
		if (n !== 0) b |= 0x80;
		out.push(b);
	} while (n !== 0);
	return Buffer.from(out);
}

const name = "sabaki";
const data = Buffer.alloc(8);
Buffer.from("SABK", "ascii").copy(data, 0);
data.writeUInt16LE(1, 4); // version de spec
data.writeUInt16LE(1, 6); // version d'ABI

const payload = Buffer.concat([leb(name.length), Buffer.from(name, "ascii"), data]);
const section = Buffer.concat([Buffer.from([0]), leb(payload.length), payload]);

const wasm = fs.readFileSync(path);
fs.writeFileSync(path, Buffer.concat([wasm, section]));
console.log(`sabaki section ajoutee (${section.length} octets) -> ${path}`);
