// netlify/functions/submit-bing.js
exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const { urls } = JSON.parse(event.body);
    const apiKey = process.env.BING_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          platform: "bing",
          status: "failed",
          message: "Environment variable BING_API_KEY is missing."
        })
      };
    }
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No URLs provided" }) };
    }
    let host;
    try {
      const u = new URL(urls[0]);
      host = u.hostname;
    } catch (e) {
      return { statusCode: 400, body: JSON.stringify({ error: "Invalid URL format" }) };
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
    return {
      statusCode: 200,
      body: JSON.stringify({
        platform: "bing",
        status: isSuccess ? "success" : "failed",
        code: response.status,
        message: isSuccess ? "Submitted to IndexNow" : `Bing Error: ${body}`
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ platform: "bing", status: "error", message: err.message }) };
  }
};
//# sourceMappingURL=submit-bing.js.map
