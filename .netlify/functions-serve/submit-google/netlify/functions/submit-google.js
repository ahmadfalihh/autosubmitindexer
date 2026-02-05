// netlify/functions/submit-google.js
var { webcrypto } = require("crypto");
async function importPrivateKey(pem) {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  const pemContents = pem.trim().replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }
  return webcrypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );
}
async function createJWT(serviceAccountEmail, privateKeyPem) {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const now = Math.floor(Date.now() / 1e3);
  const claim = {
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/indexing",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedClaim = btoa(JSON.stringify(claim));
  const unsignedToken = `${encodedHeader}.${encodedClaim}`;
  const privateKey = await importPrivateKey(privateKeyPem);
  const signatureBuffer = await webcrypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${unsignedToken}.${signature}`;
}
async function getAccessToken(serviceAccountEmail, privateKeyPem) {
  const jwt = await createJWT(serviceAccountEmail, privateKeyPem);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(`Token Error: ${data.error_description || data.error}`);
  return data.access_token;
}
exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const { urls } = JSON.parse(event.body);
    const serviceAccountStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountStr) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          platform: "google",
          status: "failed",
          message: "Missing GOOGLE_SERVICE_ACCOUNT_JSON env var."
        })
      };
    }
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountStr);
    } catch (e) {
      return {
        statusCode: 500,
        body: JSON.stringify({ platform: "google", status: "failed", message: "Invalid JSON in GOOGLE_SERVICE_ACCOUNT_JSON" })
      };
    }
    if (!urls || urls.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "No URLs" }) };
    }
    let accessToken;
    try {
      accessToken = await getAccessToken(serviceAccount.client_email, serviceAccount.private_key);
    } catch (authErr) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          platform: "google",
          status: "failed",
          message: `Google Auth Failed: ${authErr.message}`
        })
      };
    }
    const results = [];
    for (const url of urls) {
      const response = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          url,
          type: "URL_UPDATED"
        })
      });
      const resJson = await response.json();
      results.push({
        url,
        status: response.ok ? "success" : "failed",
        apiResponse: resJson
      });
    }
    const hasFailure = results.some((r) => r.status === "failed");
    return {
      statusCode: 200,
      body: JSON.stringify({
        platform: "google",
        status: hasFailure ? "partial-failure" : "success",
        results
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ platform: "google", status: "error", message: err.message }) };
  }
};
//# sourceMappingURL=submit-google.js.map
