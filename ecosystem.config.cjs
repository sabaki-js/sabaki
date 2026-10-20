// pm2 : API prod. La voie sémantique est opt-in et pointe vers l'int8 local.
module.exports = {
	apps: [
		{
			name: "sabaki-serve",
			script: "sabaki/examples/serve.mjs",
			// Port en argv (serve.mjs: argv[2], defaut 8000). La prod ecoute 8001.
			args: "8001",
			cwd: "/home/lsannier/sabaki-js",
			env: {
				// Mini v1.0 (A0, 22M). Sans ceci, le defaut pointe vers un
				// repertoire supprime et le serveur ne demarre pas.
				SABAKI_GENERALIST_DIR: "/home/lsannier/sabaki-js/weights-generalist/generalist-onnx-A0",
				// Voie semantique DESACTIVEE : mesuree a 12% de fausses reponses
				// sur des questions portant sur le meme message ("est-il bien
				// redige ?"). Decommenter uniquement apres reevaluation.
				// SABAKI_BIENCODER_DIR: "/mnt/donneesLucas/sabaki-biencoder",
				// SABAKI_BIENCODER_ONNX: "biencoder_int8.onnx",
			},
		},
	],
};
