// netlify/functions/check-index-status.js
// Provides direct search URLs for manual index verification

exports.handler = async function (event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { urls } = JSON.parse(event.body);

        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: "No URLs provided" }) };
        }

        // Generate search query links for each platform
        const results = urls.map(url => {
            const encodedUrl = encodeURIComponent(url);

            return {
                url,
                checkLinks: {
                    google: `https://www.google.com/search?q=site:${encodedUrl}`,
                    bing: `https://www.bing.com/search?q=site:${encodedUrl}`,
                    naver: `https://search.naver.com/search.naver?query=site:${encodedUrl}`
                },
                // Note: Real index checking would require:
                // - Google Search Console API (needs domain verification)
                // - SerpAPI or similar (paid service)
                // - Web scraping (against ToS, unreliable)
                tip: "Click the links above to manually verify if your URL appears in search results."
            };
        });

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                status: "success",
                message: "Search verification links generated",
                count: urls.length,
                results
            })
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ status: "error", message: err.message })
        };
    }
};
