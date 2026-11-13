/**
 * Routing Cloudflare : sabaki.fox3000foxy.com
 * - /api/* -> Vercel (sabaki-pi.vercel.app), seuls appels qui consomment des crédits
 * - tout le reste -> GitHub Pages (site statique, gratuit)
 */
const API_ORIGIN = "https://sabaki-pi.vercel.app";

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (url.pathname.startsWith("/api/")) {
			// Reverse-proxy vers Vercel : rewrite host + path (/api/systemone -> /api/systemone).
			const target = new URL(url.pathname + url.search, API_ORIGIN);
			const headers = new Headers(request.headers);
			headers.set("Host", target.host);
			headers.set("x-forwarded-host", url.host);
			const init = {
				method: request.method,
				headers,
				body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
				redirect: "manual",
			};
			const res = await fetch(target.toString(), init);
			// CORS : le site Pages appelle sa même origine, mais on garde l'ouverture
			// pour les consommateurs directs.
			const out = new Headers(res.headers);
			out.set("access-control-allow-origin", "*");
			return new Response(res.body, { status: res.status, headers: out });
		}

		// Site statique : servi par GitHub Pages (pas de crédit Vercel/Workers).
		return Response.redirect("https://sabaki-js.github.io/sabaki" + url.pathname + url.search, 308);
	},
};
