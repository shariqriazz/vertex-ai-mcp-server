/**
 * OAuth2 Authentication Manager for the MCP Server.
 *
 * This auth manager uses a cloud function to handle OAuth token exchange.
 * The client_secret is stored securely in the cloud function (via Secret Manager)
 * and is never distributed to clients.
 *
 * Flow:
 * 1. Client generates auth URL pointing to Google OAuth with cloud function as redirect_uri
 * 2. User authenticates with Google
 * 3. Google redirects to cloud function with auth code
 * 4. Cloud function exchanges code for tokens (using secret from Secret Manager)
 * 5. Cloud function redirects to local callback with tokens
 * 6. Local callback receives tokens and stores them
 *
 * See: https://developers.google.com/identity/protocols/oauth2/native-app
 */

import { OAuth2Client, Credentials } from 'google-auth-library';
import crypto from 'node:crypto';
import * as http from 'node:http';
import * as net from 'node:net';
import * as url from 'node:url';
import { logToFile } from '../utils/logger.js';
import open from '../utils/open-wrapper.js';
import {
    loadTokens,
    saveTokens,
    clearTokens,
    checkTokenScopes,
    isTokenExpiringSoon
} from '../utils/token-storage.js';

// OAuth Client ID - This is a PUBLIC identifier, safe to distribute
// The client_secret is stored in the cloud function, never in the client
const DEFAULT_CLIENT_ID = '403334419176-opdsmqonf07ricj90ug3to6gtk9fc54j.apps.googleusercontent.com';

// Cloud function URL for OAuth token exchange
// This cloud function holds the client_secret securely
const DEFAULT_CLOUD_FUNCTION_URL = 'https://us-central1-agentspace-457313.cloudfunctions.net/vertex-ai-mcp-oauth';

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

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
    private cloudFunctionUrl: string;

    constructor(scopes: string[]) {
        this.scopes = scopes;

        // Client ID can be overridden via environment variable
        this.clientId = process.env.MCP_OAUTH_CLIENT_ID || DEFAULT_CLIENT_ID;

        // Cloud function URL can be overridden for testing/different deployments
        this.cloudFunctionUrl = process.env.MCP_OAUTH_CLOUD_FUNCTION_URL || DEFAULT_CLOUD_FUNCTION_URL;
    }

    private async loadCachedCredentials(client: OAuth2Client): Promise<boolean> {
        const credentials = loadTokens();

        if (credentials) {
            // Check if saved token has required scopes
            const { hasAllScopes, missingScopes } = checkTokenScopes(credentials, this.scopes);
            logToFile(`Cached token has scopes: ${credentials.scope ?? ''}`);
            logToFile(`Required scopes: ${this.scopes.join(', ')}`);

            if (!hasAllScopes) {
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

            const isExpired = isTokenExpiringSoon(this.client.credentials);
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

        // Create OAuth2Client with only client ID (no secret - it's in the cloud function)
        const oAuth2Client = new OAuth2Client({
            clientId: this.clientId,
        });

        logToFile('No valid cached client, checking for saved credentials...');
        if (await this.loadCachedCredentials(oAuth2Client)) {
            logToFile('Loaded saved credentials, caching and returning client');
            this.client = oAuth2Client;

            const isExpired = isTokenExpiringSoon(this.client.credentials);
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

    /**
     * Refresh the access token using the cloud function.
     * The cloud function has the client_secret needed for token refresh.
     */
    public async refreshToken(): Promise<void> {
        logToFile('Manual token refresh triggered');
        if (!this.client) {
            throw new Error('Cannot refresh tokens: no authenticated client is available.');
        }

        const currentCredentials = this.client.credentials;
        if (!currentCredentials.refresh_token) {
            throw new Error('No refresh token available');
        }

        try {
            logToFile('Calling cloud function to refresh token...');

            // Call the cloud function refresh endpoint
            const response = await fetch(`${this.cloudFunctionUrl}/refreshToken`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refresh_token: currentCredentials.refresh_token
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
            }

            const newTokens = await response.json();

            // Merge new tokens with existing credentials, preserving refresh_token
            // Note: Google does NOT return a new refresh_token on refresh
            const mergedCredentials: Credentials = {
                ...newTokens,
                refresh_token: currentCredentials.refresh_token // Always preserve original
            };

            this.client.setCredentials(mergedCredentials);
            saveTokens(mergedCredentials);
            logToFile('Token refreshed and saved successfully via cloud function');
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
     * Start the OAuth flow using the cloud function pattern.
     *
     * The flow:
     * 1. Generate local callback URL
     * 2. Create state payload with local callback URL and CSRF token
     * 3. Redirect user to Google OAuth with cloud function as redirect_uri
     * 4. Cloud function exchanges code for tokens and redirects back to local callback
     * 5. Local callback receives tokens directly (not auth code)
     */
    private async startOAuthFlow(client: OAuth2Client): Promise<OAuthLoginResult> {
        logToFile(`Requesting authentication with scopes: ${this.scopes.join(', ')}`);

        const port = await this.getAvailablePort();
        const host = 'localhost';
        const localRedirectUri = `http://${host}:${port}/oauth2callback`;

        // Generate CSRF token for state parameter
        const csrfToken = crypto.randomBytes(32).toString('hex');

        // The state contains a JSON payload with:
        // - uri: the local callback URL for the cloud function to redirect to
        // - manual: false to indicate automatic redirect mode
        // - csrf: CSRF token for validation
        const statePayload = {
            uri: localRedirectUri,
            manual: false,
            csrf: csrfToken,
        };
        const state = Buffer.from(JSON.stringify(statePayload)).toString('base64');

        // Generate auth URL pointing to Google, with cloud function as redirect_uri
        const authUrl = client.generateAuthUrl({
            redirect_uri: this.cloudFunctionUrl, // Cloud function handles the callback
            access_type: 'offline',
            scope: this.scopes,
            state: state,
            prompt: 'consent', // Ensure we get a refresh token
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

                    // Validate CSRF token (passed back by cloud function in 'state' param)
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

                    // Cloud function sends tokens directly in query params
                    const access_token = qs.get('access_token');
                    const refresh_token = qs.get('refresh_token');
                    const scope = qs.get('scope');
                    const token_type = qs.get('token_type');
                    const expiry_date_str = qs.get('expiry_date');

                    if (access_token && expiry_date_str) {
                        const tokens: Credentials = {
                            access_token: access_token,
                            refresh_token: refresh_token || undefined,
                            scope: scope || undefined,
                            token_type: token_type || undefined,
                            expiry_date: parseInt(expiry_date_str, 10),
                        };

                        client.setCredentials(tokens);
                        logToFile('Tokens received from cloud function and set on client');

                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`
                            <html>
                            <head><title>Authentication Successful</title></head>
                            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                                <h1>Authentication Successful</h1>
                                <p>You can close this window and return to the terminal.</p>
                            </body>
                            </html>
                        `);
                        resolve();
                    } else {
                        res.writeHead(400);
                        res.end('Authentication failed: Did not receive tokens from callback.');
                        reject(new Error('Authentication failed: Did not receive tokens from callback.'));
                    }
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
