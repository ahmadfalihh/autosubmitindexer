/**
 * Cloudflare Pages Function: submit-bing.js
 * Handles Bing IndexNow API submission
 */

export async function onRequestPost({ request, env }) {
    try {
        const { urls } = await request.json();
        const apiKey = env.BING_API_KEY;

        if (!apiKey) {
            return new Response(JSON.stringify({
                platform: "bing",
                status: "failed",
                message: "Environment variable BING_API_KEY is missing."
            }), { status: 500, headers: { "Content-Type": "application/json" } });
        }

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return new Response(JSON.stringify({ error: "No URLs provided" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        let host;
        try {
            const u = new URL(urls[0]);
            host = u.hostname;
        } catch (e) {
            return new Response(JSON.stringify({ error: "Invalid URL format" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const payload = {
            host,
            key: apiKey,
            urlList: urls
        };

        const response = await fetch("https://api.indexnow.org/indexnow", {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify(payload)
        });

        const body = await response.text();
        const isSuccess = response.status === 200 || response.status === 202;

        return new Response(JSON.stringify({
            platform: "bing",
            status: isSuccess ? "success" : "failed",
            code: response.status,
            message: isSuccess ? "Submitted to IndexNow" : `Bing Error: ${body}`
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        return new Response(JSON.stringify({
            platform: "bing",
            status: "error",
            message: err.message
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
