/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { getOgp, isOgpData, isStringArray } from "./helpers";

export interface Env {
  OGP_CACHE: KVNamespace;
  API_SECRET: string;
}

export default {
	async fetch(request, env): Promise<Response> {
		
		const url = new URL(request.url);
		const targetUrl = url.searchParams.get("url");
		const headers = {
			"Content-Type": "application/json; charset=utf-8",
			"Access-Control-Allow-Origin": "*"
		};

		if (request.headers.get("X-Custom-Auth") !== env.API_SECRET) {
			return new Response(JSON.stringify({ error: "Unauthorized" }), {
				status: 401,
				headers,
			});
		}

		const body = await request.json<{urls: string[]}>();
		const urls: string[] = isStringArray(body.urls) ? body.urls : [];

		if (urls.length === 0) {
			return new Response(JSON.stringify({ error: "Urls is required" }), { status: 400, headers });
		}

		return await Promise.all(urls.map(async (url) => {
			const cache = await env.OGP_CACHE.get(url) || '';
			const ogp = JSON.parse(cache);
			if (isOgpData(ogp)) {
				return ogp
			} else {
				return getOgp(url)
			}
		})).then((result) => {
			return new Response(JSON.stringify({result}), {
				headers,
				status: 200
		})}).catch(() => {
			return new Response(JSON.stringify({ error: 'Unexpected error' }), {
				headers,
				status: 500
			});
		});
	}	
} satisfies ExportedHandler<Env>;
