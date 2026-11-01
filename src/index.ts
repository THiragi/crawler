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

export interface Env {
  OGP_CACHE: KVNamespace;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		const targetUrl = url.searchParams.get("url");
		const headers = {
			"Content-Type": "application/json; charset=utf-8",
			"Access-Control-Allow-Origin": "*"
		};

		if (!targetUrl) {
			return new Response(JSON.stringify({ error: "URL is required" }), { status: 400, headers });
		}
		try {
			const cachedData = await env.OGP_CACHE.get(targetUrl);
			if (cachedData) {
				return new Response(cachedData, {
				status: 200,
				headers: {
					...headers,
					"X-Cache": "HIT", // デバッグ用ヘッダー
				},
				});
			}
			const res = await fetch(targetUrl, {
				headers: {
					"User-Agent": "Mozilla/5.0 (compatible; LinkCardBot/1.0)",
				}
			});

			if (!res.ok) {
				throw new Error(`Failed to fetch target URL: ${res.status}`);
			}
			// 抽出したデータを格納する変数
			let title = "";
			let ogTitle = "";
			let ogDescription = "";
			let ogImage = "";

			// HTMLRewriterで各要素を安全にフックする
			const rewriter = new HTMLRewriter()
				.on("title", {
				text(text) {
					title += text.text;
				},
				})
				.on('meta[property="og:title"]', {
				element(element) {
					const content = element.getAttribute("content");
					if (content) ogTitle = content;
				},
				})
				.on('meta[property="og:description"]', {
				element(element) {
					const content = element.getAttribute("content");
					if (content) ogDescription = content;
				},
				})
				.on('meta[property="og:image"]', {
				element(element) {
					const content = element.getAttribute("content");
					if (content) ogImage = content;
				},
				});

			// レスポンスのストリームをHTMLRewriterに通して解析（.text()で消費し切る）
			await rewriter.transform(res).text();

			const metadata = {
				title: ogTitle || title.trim(),
				description: ogDescription.trim(),
				image: ogImage.trim(),
				url: targetUrl,
			};
			const jsonString = JSON.stringify(metadata);

			// 3. 取得したデータをKVに保存 (有効期限を例えば7日間に設定)
			// expirationTtl の単位は秒 (7日 = 604800秒)
			await env.OGP_CACHE.put(targetUrl, jsonString, { expirationTtl: 604800 });

			return new Response(jsonString, {
				status: 200,
				headers: {
				...headers,
				"X-Cache": "MISS",
				},
			});
		} catch (e: any) {
			return new Response(JSON.stringify({ error: e.message }), {
				status: 500,
				headers,
			});
		} 		
	},
} satisfies ExportedHandler<Env>;
