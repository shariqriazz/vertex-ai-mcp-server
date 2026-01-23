/**
 * Token storage utilities for OAuth credentials.
 *
 * Stores OAuth tokens in a file for persistence across sessions.
 * Tokens are stored in ~/.config/vertex-ai-mcp/oauth-tokens.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Credentials } from 'google-auth-library';

const CONFIG_DIR_NAME = 'vertex-ai-mcp';
const TOKEN_FILE_NAME = 'oauth-tokens.json';

/**
 * Get the path to the token file.
 * Creates the config directory if it doesn't exist.
 *
 * @param configDir - Optional override for config directory (useful for testing)
 * @returns The path to the token file
 */
export function getTokenFilePath(configDir?: string): string {
    const dir = configDir ?? path.join(os.homedir(), '.config', CONFIG_DIR_NAME);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    return path.join(dir, TOKEN_FILE_NAME);
}

/**
 * Load tokens from the token file.
 *
 * @param tokenFilePath - Optional path to token file (useful for testing)
 * @returns The credentials object, or null if not found or invalid
 */
export function loadTokens(tokenFilePath?: string): Credentials | null {
    try {
        const filePath = tokenFilePath ?? getTokenFilePath();
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        }
    } catch {
        // Ignore errors - return null if we can't load
    }
    return null;
}

/**
 * Save tokens to the token file.
 *
 * @param tokens - The credentials to save
 * @param tokenFilePath - Optional path to token file (useful for testing)
 */
export function saveTokens(tokens: Credentials, tokenFilePath?: string): void {
    const filePath = tokenFilePath ?? getTokenFilePath();
    fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

/**
 * Clear tokens by deleting the token file.
 *
 * @param tokenFilePath - Optional path to token file (useful for testing)
 */
export function clearTokens(tokenFilePath?: string): void {
    try {
        const filePath = tokenFilePath ?? getTokenFilePath();
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch {
        // Ignore errors during cleanup
    }
}

/**
 * Check if a token has the required scopes.
 *
 * @param credentials - The credentials to check
 * @param requiredScopes - The scopes that must be present
 * @returns Object with hasAllScopes boolean and missingScopes array
 */
export function checkTokenScopes(
    credentials: Credentials,
    requiredScopes: string[]
): { hasAllScopes: boolean; missingScopes: string[] } {
    const savedScopes = new Set(credentials.scope?.split(' ') ?? []);
    const missingScopes = requiredScopes.filter(scope => !savedScopes.has(scope));
    return {
        hasAllScopes: missingScopes.length === 0,
        missingScopes
    };
}

/**
 * Check if a token is expiring soon (within buffer time).
 *
 * @param credentials - The credentials to check
 * @param bufferMs - Buffer time in milliseconds (default: 5 minutes)
 * @returns true if token is expiring soon or already expired
 */
export function isTokenExpiringSoon(
    credentials: Credentials,
    bufferMs: number = 5 * 60 * 1000
): boolean {
    return !!(credentials.expiry_date &&
        credentials.expiry_date < Date.now() + bufferMs);
}
