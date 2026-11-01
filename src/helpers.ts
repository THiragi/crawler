

export function getDomainFromUrl(url: string): string {
    const { hostname } = new URL(url);
    return hostname.replace('www.', '');
}

export type Ogp = {
    url: string,
    description: string,
    image: string,
    domain: string
}

export function isOgpData(data: unknown): data is Ogp {
    return (
        typeof data === "object" && data !== null && 
        'url' in data && typeof data.url === "string" &&
        'description' in data && typeof data.description === "string" &&
        'image' in data && typeof data.image === "string" &&
        'domain' in data && typeof data.domain === "string"
    )
}

export function isStringArray(array: any): array is string[] {
  return (
    Array.isArray(array) && array.every((item) => typeof item === 'string')
  );
}

export async function getOgp(url: string) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LinkCardBot/1.0)",
        }
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch target URL: ${res.status}`);
    }

    // 抽出したデータを格納する変数
    let title = "";
    let description = "";
    let ogUrl = "";
    let ogTitle = "";
    let ogDescription = "";
    let ogImage = "";

    const rewriter = new HTMLRewriter()
        .on("title", {
        text(text) {
            title += text.text;
        },
        })
        .on('meta[name="description"]', {
        element(element) {
            const content = element.getAttribute("content");
            if (content) description = content;
        },
        })
        .on('meta[property="og:url"]', {
        element(element) {
            const content = element.getAttribute("content");
            if (content) ogUrl = content;
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

    return {
        title: ogTitle || title.trim(),
        description: description.trim() || ogDescription.trim(),
        image: ogImage.trim(),
        url: ogUrl.trim() || url,
        domain: getDomainFromUrl(ogUrl.trim() || url)
    };
}