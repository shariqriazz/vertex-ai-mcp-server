/**
 * OAuth Cloud Function for Vertex AI MCP Server
 *
 * This cloud function handles OAuth token exchange and refresh for the MCP server.
 * The client_secret is stored securely in GCP Secret Manager and never distributed.
 *
 * Endpoints:
 * - GET /?code=...&state=... - OAuth callback, exchanges auth code for tokens
 * - POST /refreshToken - Refreshes access token using refresh_token
 */

const functions = require('@google-cloud/functions-framework');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const axios = require('axios');
const { URL } = require('node:url');

// --- Configuration loaded from Environment Variables ---
// These are set in the Google Cloud Function's configuration
const CLIENT_ID = process.env.CLIENT_ID;
const SECRET_NAME = process.env.SECRET_NAME;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Fail fast if required environment variables are missing
if (!CLIENT_ID || !SECRET_NAME || !REDIRECT_URI) {
  throw new Error(
    'Missing required environment variables: CLIENT_ID, SECRET_NAME, and REDIRECT_URI must be set.'
  );
}

// Initialize the Secret Manager client
const secretClient = new SecretManagerServiceClient();

/**
 * HTML-encode a string to prevent XSS attacks.
 * @param {string} str - The string to encode
 * @returns {string} The HTML-encoded string
 */
function htmlEncode(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Helper function to access a secret from Secret Manager.
 */
async function getClientSecret() {
  try {
    const [version] = await secretClient.accessSecretVersion({
      name: SECRET_NAME,
    });
    const payload = version.payload.data.toString('utf8');
    return payload;
  } catch (error) {
    console.error('Failed to access secret version:', error);
    throw new Error('Could not retrieve client secret.');
  }
}

/**
 * Handles the OAuth 2.0 callback.
 * Exchanges the authorization code for tokens.
 */
async function handleCallback(req, res) {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) {
    console.error('Missing authorization code in request query parameters.');
    return res.status(400).send('Error: Missing authorization code.');
  }

  try {
    const clientSecret = await getClientSecret();
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: CLIENT_ID,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    });

    const { access_token, refresh_token, expires_in, scope, token_type } = tokenResponse.data;

    // Calculate expiry_date (timestamp in milliseconds)
    const expiry_date = Date.now() + (expires_in * 1000);

    // If state is present, decode it and decide whether to redirect or show manual page.
    if (state) {
      try {
        // SECURITY: Enforce a reasonable size limit on the state parameter
        if (state.length > 4096) {
          throw new Error('State parameter exceeds size limit of 4KB.');
        }

        const payload = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));

        // If not in manual mode and a URI is present, perform the redirect.
        if (payload && payload.manual === false && payload.uri) {
          const redirectUrl = new URL(payload.uri);

          // SECURITY: Validate the redirect URI to prevent open redirect attacks.
          if (redirectUrl.hostname !== 'localhost' && redirectUrl.hostname !== '127.0.0.1') {
            throw new Error(`Invalid redirect hostname: ${redirectUrl.hostname}. Must be localhost or 127.0.0.1.`);
          }

          redirectUrl.searchParams.append('access_token', access_token);
          if (refresh_token) {
            redirectUrl.searchParams.append('refresh_token', refresh_token);
          }
          redirectUrl.searchParams.append('scope', scope);
          redirectUrl.searchParams.append('token_type', token_type);
          redirectUrl.searchParams.append('expiry_date', expiry_date.toString());

          // SECURITY: Pass the CSRF token back to the client for validation.
          if (payload.csrf) {
            redirectUrl.searchParams.append('state', payload.csrf);
          }

          return res.redirect(302, redirectUrl.toString());
        }
      } catch (e) {
        console.error('Error processing state or redirect. Falling back to manual page.', e);
      }
    }

    // --- Fallback to manual instructions ---
    // SECURITY: HTML-encode the JSON to prevent XSS
    const credentialsObj = {
      refresh_token: refresh_token,
      scope: scope,
      token_type: token_type,
      access_token: access_token,
      expiry_date: expiry_date
    };
    const credentialsJson = JSON.stringify(credentialsObj, null, 2);
    const safeCredentialsJson = htmlEncode(credentialsJson);

    res.set('Content-Type', 'text/html');
    res.status(200).send(getSuccessHtml(safeCredentialsJson));

  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error during token exchange:', error.response.data);
    } else {
      console.error('Error during token exchange:', error instanceof Error ? error.message : error);
    }
    res.status(500).send('An error occurred during the token exchange. Check function logs for details.');
  }
}

/**
 * Generate the success HTML page with properly escaped credentials.
 * @param {string} safeCredentialsJson - HTML-encoded credentials JSON
 * @returns {string} The HTML page
 */
function getSuccessHtml(safeCredentialsJson) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Vertex AI MCP Server - OAuth Success</title>
  <style>
    body { font-family: sans-serif; display: grid; place-items: center; min-height: 90vh; background-color: #f4f7f6; padding: 1rem;}
    .container { background: #fff; border: 1px solid #ccc; border-radius: 8px; padding: 2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05); max-width: 90%; width: 600px; }
    h1 { color: #333; margin-top: 0;}
    textarea {
      width: 100%;
      min-height: 150px;
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-family: monospace;
      white-space: pre;
      word-break: break-all;
      box-sizing: border-box;
    }
    button {
      display: block;
      margin: 1rem auto 1rem 0;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      border-radius: 4px;
      border: none;
      background-color: #4285F4;
      color: white;
      cursor: pointer;
    }
    button:hover { background-color: #357ae8; }
    #copy-status { font-style: italic; color: green; margin-left: 10px; opacity: 0; transition: opacity 0.5s;}
    .instructions { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.9em; }
    code { background-color: #eee; padding: 0.2em 0.4em; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authentication Successful!</h1>
    <p>If you're not automatically redirected, copy this JSON and save it to your credentials file.</p>
    <textarea id="credentials-json" readonly>${safeCredentialsJson}</textarea>
    <button id="copy-btn">Copy JSON</button>
    <span id="copy-status">Copied!</span>
    <div class="instructions">
      <p>Save this to: <code>~/.config/vertex-ai-mcp/oauth-tokens.json</code></p>
    </div>
  </div>
  <script>
    document.getElementById('copy-btn').addEventListener('click', function() {
      var textArea = document.getElementById('credentials-json');
      var status = document.getElementById('copy-status');
      navigator.clipboard.writeText(textArea.value).then(function() {
        status.textContent = 'Copied!';
        status.style.opacity = 1;
        setTimeout(function() { status.style.opacity = 0; }, 2000);
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Handles token refresh.
 * Accepts a refresh_token and returns a new access_token.
 */
async function handleRefreshToken(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    console.error('Invalid method for refreshToken:', req.method);
    return res.status(405).send('Method Not Allowed');
  }

  const { refresh_token } = req.body;

  if (!refresh_token) {
    console.error('Missing refresh_token in request body');
    return res.status(400).send('Error: Missing refresh_token in request body.');
  }

  try {
    const clientSecret = await getClientSecret();

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: CLIENT_ID,
      client_secret: clientSecret,
      refresh_token: refresh_token,
      grant_type: 'refresh_token',
    });

    const { access_token, expires_in, scope, token_type } = tokenResponse.data;

    // Calculate expiry_date (timestamp in milliseconds)
    const expiry_date = Date.now() + (expires_in * 1000);

    // Return the new credentials
    // Note: Google does NOT return a new refresh_token on refresh
    // The client must preserve the original refresh_token
    res.status(200).json({
      access_token,
      expiry_date,
      token_type,
      scope,
    });

  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('Error during token refresh:', error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Error during token refresh:', error instanceof Error ? error.message : error);
      res.status(500).send('An error occurred during token refresh.');
    }
  }
}

/**
 * Main entry point for the Cloud Function.
 * Routes requests to either the callback handler or the refresh handler.
 */
functions.http('oauthHandler', async (req, res) => {
  // Set CORS headers for all responses
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // Route to refresh handler if path ends with /refresh or /refreshToken or it's a POST with refresh_token
  if (['/refresh', '/refreshToken'].includes(req.path) || (req.method === 'POST' && req.body?.refresh_token)) {
    return handleRefreshToken(req, res);
  }

  // Route to callback handler if path ends with /callback or /oauth2callback or has 'code' query param
  if (['/callback', '/oauth2callback'].includes(req.path) || req.query.code) {
    return handleCallback(req, res);
  }

  // Default/Error case
  res.status(400).send('Unknown request type. Expected OAuth callback or token refresh request.');
});
