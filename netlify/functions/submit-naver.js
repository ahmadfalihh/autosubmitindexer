// netlify/functions/submit-naver.js
exports.handler = async function (event, context) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    try {
        const { urls } = JSON.parse(event.body);

        const clientId = process.env.NAVER_CLIENT_ID;
        const clientSecret = process.env.NAVER_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            return {
                statusCode: 500,
                body: JSON.stringify({
                    platform: "naver",
                    status: "failed",
                    message: "Missing NAVER_CLIENT_ID or NAVER_CLIENT_SECRET."
                })
            };
        }

        console.log(`[Naver] Submitting ${urls.length} URLs using Client ID: ${clientId.substring(0, 4)}...`);

        // Mock delay for Naver (API access assumed restricted)
        await new Promise(r => setTimeout(r, 400));

        return {
            statusCode: 200,
            body: JSON.stringify({
                platform: "naver",
                status: "success",
                message: "Simulated submission to Naver (API link required)",
                count: urls.length
            })
        };

    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ platform: "naver", status: "error", message: err.message }) };
    }
};
