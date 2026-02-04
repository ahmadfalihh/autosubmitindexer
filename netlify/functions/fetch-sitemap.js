// netlify/functions/fetch-sitemap.js
exports.handler = async function (event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { url } = JSON.parse(event.body);

        if (!url) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing 'url' parameter" }) };
        }

        // Fetch the sitemap from the server side
        const response = await fetch(url);
        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: `Failed to fetch sitemap: ${response.statusText}` })
            };
        }

        const xmlData = await response.text();

        return {
            statusCode: 200,
            body: JSON.stringify({ xmlData }),
            headers: { "Content-Type": "application/json" }
        };

    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
