/**
 * Cloudflare Pages Function: fetch-sitemap.js
 * Server-side proxy to fetch sitemap XML content
 */

export async function onRequestPost({ request }) {
    try {
        const { url } = await request.json();

        const response = await fetch(url);
        if (!response.ok) {
            return new Response(`Failed to fetch sitemap: ${response.statusText}`, { status: response.status });
        }
        const xmlData = await response.text();

        return new Response(JSON.stringify({ xmlData }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
