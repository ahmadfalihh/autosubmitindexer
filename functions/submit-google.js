/**
 * Cloudflare Pages Function: submit-google.js
 * Handles Google Indexing API submission using Web Crypto API (Standard V8)
 */

// Helper to import private key
async function importPrivateKey(pem) {
    // Clean PEM string
    const pemContents = pem
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\s/g, "");

    // Base64 decode
    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    for (let i = 0; i < binaryDerString.length; i++) {
        binaryDer[i] = binaryDerString.charCodeAt(i);
    }

    return crypto.subtle.importKey(
        "pkcs8",
        binaryDer.buffer,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256",
        },
        false,
        ["sign"]
    );
}

// Create Signed JWT
async function createJWT(serviceAccountEmail, privateKeyPem) {
    const header = {
        alg: "RS256",
        typ: "JWT",
    };

    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: serviceAccountEmail,
        scope: "https://www.googleapis.com/auth/indexing",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
    };

    const encodedHeader = btoa(JSON.stringify(header))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const encodedClaim = btoa(JSON.stringify(claim))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const unsignedToken = `${encodedHeader}.${encodedClaim}`;

    const privateKey = await importPrivateKey(privateKeyPem);
    const signatureBuffer = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        privateKey,
        new TextEncoder().encode(unsignedToken)
    );

    const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    return `${unsignedToken}.${signature}`;
}

async function getAccessToken(serviceAccountEmail, privateKeyPem) {
    const jwt = await createJWT(serviceAccountEmail, privateKeyPem);

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        }),
    });

    const data = await response.json();
    if (data.error) throw new Error(`Token Error: ${data.error_description || data.error}`);
    return data.access_token;
}

export async function onRequestPost({ request, env }) {
    try {
        const { urls } = await request.json();

        // 1. Check Env Var
        const serviceAccountStr = env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (!serviceAccountStr) {
            return new Response(JSON.stringify({
                platform: "google",
                status: "failed",
                message: "Missing GOOGLE_SERVICE_ACCOUNT_JSON env var."
            }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 2. Parse Credentials
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(serviceAccountStr);
        } catch (e) {
            return new Response(JSON.stringify({
                platform: "google",
                status: "failed",
                message: "Invalid JSON in GOOGLE_SERVICE_ACCOUNT_JSON"
            }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }

        if (!urls || urls.length === 0) {
            return new Response(JSON.stringify({ error: "No URLs provided" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 3. Get Token and Submit
        let accessToken;
        try {
            accessToken = await getAccessToken(serviceAccount.client_email, serviceAccount.private_key);
        } catch (authErr) {
            return new Response(JSON.stringify({
                platform: "google",
                status: "failed",
                message: `Google Auth Failed: ${authErr.message}`
            }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
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
                    url: url,
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

        const hasFailure = results.some(r => r.status === 'failed');

        return new Response(JSON.stringify({
            platform: "google",
            status: hasFailure ? "partial-failure" : "success",
            results
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        return new Response(JSON.stringify({
            platform: "google",
            status: "error",
            message: err.message
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
