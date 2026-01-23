/**
 * OAuth2 Authentication Manager for the MCP Server.
 *
 * This is a standalone auth manager that uses the MCP server's own OAuth client
 * credentials, separate from the Gemini CLI auth infrastructure.
 *
 * SECURITY NOTE: This uses PKCE (Proof Key for Code Exchange) for security.
 * Per Google's documentation, desktop/installed applications "cannot keep secrets",
 * so we use PKCE instead of relying on client_secret for security.
 * The client_id is embedded in the code (it's not a secret - it's a public identifier).
 * See: https://developers.google.com/identity/protocols/oauth2/native-app
 */

import { OAuth2Client, Credentials, CodeChallengeMethod } from 'google-auth-library';
import crypto from 'node:crypto';
import * as http from 'node:http';
import * as net from 'node:net';
import * as url from 'node:url';
import { logToFile } from '../utils/logger.js';
import open from '../utils/open-wrapper.js';
import { shouldLaunchBrowser } from '../utils/secure-browser-launcher.js';

// OAuth Client ID for the Helix Vertex AI MCP Server
// This is a PUBLIC identifier, not a secret. It's safe to embed in code.
// The OAuth app is configured as "Internal" in GCP, so only Helix org users can authenticate.
// Security is provided by PKCE, not by keeping the client_id secret.
const DEFAULT_CLIENT_ID = '403334419176-95dvevmlhs9v6lnhbq98e790fevd6hl3.apps.googleusercontent.com';

// Token storage for MCP server (separate from Gemini CLI)
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

// In-memory token cache (persisted to file for simplicity)
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function getTokenFilePath(): string {
    const configDir = path.join(os.homedir(), '.config', 'vertex-ai-mcp');
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    }
    return path.join(configDir, 'oauth-tokens.json');
}

function loadTokens(): Credentials | null {
    try {
        const tokenFile = getTokenFilePath();
        if (fs.existsSync(tokenFile)) {
            const data = fs.readFileSync(tokenFile, 'utf-8');
            return JSON.parse(data);
        }
    } catch (error) {
        logToFile(`Error loading tokens: ${error}`);
    }
    return null;
}

function saveTokens(tokens: Credentials): void {
    try {
        const tokenFile = getTokenFilePath();
        fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2), { mode: 0o600 });
        logToFile(`Tokens saved to ${tokenFile}`);
    } catch (error) {
        logToFile(`Error saving tokens: ${error}`);
    }
}

function clearTokens(): void {
    try {
        const tokenFile = getTokenFilePath();
        if (fs.existsSync(tokenFile)) {
            fs.unlinkSync(tokenFile);
            logToFile('Tokens cleared');
        }
    } catch (error) {
        logToFile(`Error clearing tokens: ${error}`);
    }
}

/**
 * OAuth login result containing the auth URL and completion promise.
 */
interface OAuthLoginResult {
    authUrl: string;
    loginCompletePromise: Promise<void>;
}

export class McpAuthManager {
    private client: OAuth2Client | null = null;
    private scopes: string[];
    private clientId: string;
    private codeVerifier: string | null = null;

    constructor(scopes: string[]) {
        this.scopes = scopes;

        // Use embedded client ID by default, allow override via environment variable
        // The client_id is a public identifier, not a secret
        this.clientId = process.env.MCP_OAUTH_CLIENT_ID || DEFAULT_CLIENT_ID;
    }

    private isTokenExpiringSoon(credentials: Credentials): boolean {
        return !!(credentials.expiry_date &&
            credentials.expiry_date < Date.now() + TOKEN_EXPIRY_BUFFER_MS);
    }

    private async loadCachedCredentials(client: OAuth2Client): Promise<boolean> {
        const credentials = loadTokens();

        if (credentials) {
            // Check if saved token has required scopes
            const savedScopes = new Set(credentials.scope?.split(' ') ?? []);
            logToFile(`Cached token has scopes: ${[...savedScopes].join(', ')}`);
            logToFile(`Required scopes: ${this.scopes.join(', ')}`);

            const missingScopes = this.scopes.filter(scope => !savedScopes.has(scope));

            if (missingScopes.length > 0) {
                logToFile(`Token cache missing required scopes: ${missingScopes.join(', ')}`);
                logToFile('Removing cached token to force re-authentication...');
                clearTokens();
                return false;
            } else {
                client.setCredentials(credentials);
                return true;
            }
        }

        return false;
    }

    /**
     * Get an authenticated OAuth2Client.
     * This client is compatible with Google Cloud client libraries.
     */
    public async getAuthenticatedClient(): Promise<OAuth2Client> {
        logToFile('McpAuthManager.getAuthenticatedClient called');

        // Check if we have a cached client with valid credentials
        if (this.client && this.client.credentials && this.client.credentials.refresh_token) {
            logToFile('Returning existing cached client with valid credentials');

            const isExpired = this.isTokenExpiringSoon(this.client.credentials);
            logToFile(`Token expired: ${isExpired}`);

            // Proactively refresh if expired
            if (isExpired) {
                logToFile('Token is expired, refreshing proactively...');
                try {
                    await this.refreshToken();
                    logToFile('Token refreshed successfully');
                } catch (error) {
                    logToFile(`Failed to refresh token: ${error}`);
                    this.client = null;
                    clearTokens();
                }
            }

            if (this.client) {
                return this.client;
            }
        }

        // Create new OAuth2Client with just the client ID (no secret needed for desktop apps)
        // Security is provided by PKCE, not by client_secret
        const oAuth2Client = new OAuth2Client({
            clientId: this.clientId,
        });

        // Set up token refresh handler
        oAuth2Client.on('tokens', async (tokens) => {
            logToFile('Tokens refreshed event received');
            if (tokens.refresh_token) {
                logToFile('New refresh token received in event');
            }

            try {
                const current = loadTokens() || {};
                const merged = {
                    ...tokens,
                    refresh_token: tokens.refresh_token || current.refresh_token
                };
                saveTokens(merged);
                logToFile('Credentials saved after refresh');
            } catch (e) {
                logToFile(`Error saving refreshed credentials: ${e}`);
            }
        });

        logToFile('No valid cached client, checking for saved credentials...');
        if (await this.loadCachedCredentials(oAuth2Client)) {
            logToFile('Loaded saved credentials, caching and returning client');
            this.client = oAuth2Client;

            const isExpired = this.isTokenExpiringSoon(this.client.credentials);
            logToFile(`Token expired: ${isExpired}`);

            if (isExpired) {
                logToFile('Loaded token is expired, refreshing proactively...');
                try {
                    await this.refreshToken();
                    logToFile('Token refreshed successfully after loading from storage');
                } catch (error) {
                    logToFile(`Failed to refresh loaded token: ${error}`);
                    this.client = null;
                    clearTokens();
                }
            }

            if (this.client) {
                return this.client;
            }
        }

        // No valid cached credentials, start OAuth flow
        const webLogin = await this.startOAuthFlow(oAuth2Client);

        logToFile(`Opening browser for OAuth: ${webLogin.authUrl}`);
        await open(webLogin.authUrl);
        console.error('Opening browser for authentication...');

        // Wait for authentication with timeout
        const authTimeout = 5 * 60 * 1000; // 5 minutes
        let authTimeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
            authTimeoutId = setTimeout(() => {
                reject(new Error('Authentication timed out after 5 minutes.'));
            }, authTimeout);
        });

        try {
            await Promise.race([webLogin.loginCompletePromise, timeoutPromise]);
        } finally {
            clearTimeout(authTimeoutId!);
        }

        saveTokens(oAuth2Client.credentials);
        this.client = oAuth2Client;
        return this.client;
    }

    public async clearAuth(): Promise<void> {
        logToFile('Clearing authentication...');
        this.client = null;
        clearTokens();
        logToFile('Authentication cleared.');
    }

    public async refreshToken(): Promise<void> {
        logToFile('Manual token refresh triggered');
        if (!this.client) {
            throw new Error('Cannot refresh tokens: no authenticated client is available.');
        }

        try {
            const { credentials } = await this.client.refreshAccessToken();

            // Preserve refresh token
            const currentCredentials = this.client.credentials;
            const mergedCredentials = {
                ...credentials,
                refresh_token: credentials.refresh_token || currentCredentials.refresh_token
            };

            this.client.setCredentials(mergedCredentials);
            saveTokens(mergedCredentials);
            logToFile('Token refreshed and saved successfully');
        } catch (error) {
            logToFile(`Error during token refresh: ${error}`);
            throw error;
        }
    }

    private async getAvailablePort(): Promise<number> {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.listen(0, () => {
                const address = server.address() as net.AddressInfo;
                const port = address.port;
                server.close();
                server.unref();
                resolve(port);
            });
            server.on('error', (e) => reject(e));
        });
    }

    /**
     * Generate a cryptographically random code verifier for PKCE.
     * Must be 43-128 characters, using unreserved URI characters.
     */
    private generateCodeVerifier(): string {
        // Generate 32 random bytes and encode as base64url (results in 43 chars)
        return crypto.randomBytes(32).toString('base64url');
    }

    /**
     * Generate code challenge from code verifier using SHA256.
     */
    private generateCodeChallenge(codeVerifier: string): string {
        return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    }

    private async startOAuthFlow(client: OAuth2Client): Promise<OAuthLoginResult> {
        logToFile(`Requesting authentication with scopes: ${this.scopes.join(', ')}`);

        const port = await this.getAvailablePort();
        const host = 'localhost';
        const redirectUri = `http://${host}:${port}/oauth2callback`;

        // Generate CSRF token for state parameter
        const csrfToken = crypto.randomBytes(32).toString('hex');

        // Generate PKCE code verifier and challenge
        // This provides security for desktop apps without needing a client secret
        this.codeVerifier = this.generateCodeVerifier();
        const codeChallenge = this.generateCodeChallenge(this.codeVerifier);
        logToFile('Generated PKCE code verifier and challenge');

        const authUrl = client.generateAuthUrl({
            redirect_uri: redirectUri,
            access_type: 'offline',
            scope: this.scopes,
            state: csrfToken,
            prompt: 'consent', // Ensure we get a refresh token
            code_challenge: codeChallenge,
            code_challenge_method: CodeChallengeMethod.S256,
        });

        const loginCompletePromise = new Promise<void>((resolve, reject) => {
            const server = http.createServer(async (req, res) => {
                try {
                    if (!req.url || !req.url.startsWith('/oauth2callback')) {
                        res.writeHead(404);
                        res.end('Not found');
                        return;
                    }

                    const qs = new url.URL(req.url, `http://${host}:${port}`).searchParams;

                    // Validate CSRF token
                    const returnedState = qs.get('state');
                    if (returnedState !== csrfToken) {
                        res.writeHead(400);
                        res.end('State mismatch. Possible CSRF attack.');
                        reject(new Error('OAuth state mismatch. Possible CSRF attack.'));
                        return;
                    }

                    if (qs.get('error')) {
                        const errorCode = qs.get('error');
                        const errorDescription = qs.get('error_description') || 'No details';
                        res.writeHead(400);
                        res.end(`Authentication error: ${errorCode}`);
                        reject(new Error(`Google OAuth error: ${errorCode}. ${errorDescription}`));
                        return;
                    }

                    const code = qs.get('code');
                    if (!code) {
                        res.writeHead(400);
                        res.end('No authorization code received');
                        reject(new Error('No authorization code received'));
                        return;
                    }

                    // Exchange code for tokens using PKCE code verifier
                    logToFile('Exchanging authorization code for tokens with PKCE...');
                    const { tokens } = await client.getToken({
                        code: code,
                        redirect_uri: redirectUri,
                        codeVerifier: this.codeVerifier!,
                    });

                    client.setCredentials(tokens);
                    logToFile('Tokens received and set on client');

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                        <head><title>Authentication Successful</title></head>
                        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                            <h1>✓ Authentication Successful</h1>
                            <p>You can close this window and return to the terminal.</p>
                        </body>
                        </html>
                    `);
                    resolve();
                } catch (e) {
                    logToFile(`Error in OAuth callback: ${e}`);
                    res.writeHead(500);
                    res.end('Internal error during authentication');
                    reject(e);
                } finally {
                    server.close();
                }
            });

            server.listen(port, host, () => {
                logToFile(`OAuth callback server listening on ${host}:${port}`);
            });

            server.on('error', (err) => {
                reject(new Error(`OAuth callback server error: ${err}`));
            });
        });

        return {
            authUrl,
            loginCompletePromise,
        };
    }
}
