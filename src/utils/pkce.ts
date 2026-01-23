/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth2.
 *
 * PKCE is used to secure OAuth flows for public clients (like desktop apps)
 * that cannot securely store a client secret.
 *
 * See: https://datatracker.ietf.org/doc/html/rfc7636
 */

import crypto from 'node:crypto';

/**
 * Generate a cryptographically random code verifier for PKCE.
 * Must be 43-128 characters, using unreserved URI characters.
 *
 * @returns A base64url-encoded random string (43 characters)
 */
export function generateCodeVerifier(): string {
    // Generate 32 random bytes and encode as base64url (results in 43 chars)
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate code challenge from code verifier using SHA256.
 *
 * @param codeVerifier - The code verifier to hash
 * @returns A base64url-encoded SHA256 hash of the code verifier
 */
export function generateCodeChallenge(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

/**
 * Validate that a code verifier meets PKCE requirements.
 *
 * Per RFC 7636:
 * - Must be 43-128 characters long
 * - Must use only unreserved characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 *
 * @param codeVerifier - The code verifier to validate
 * @returns true if valid, false otherwise
 */
export function isValidCodeVerifier(codeVerifier: string): boolean {
    if (codeVerifier.length < 43 || codeVerifier.length > 128) {
        return false;
    }
    // Unreserved characters per RFC 7636
    const validPattern = /^[A-Za-z0-9\-._~]+$/;
    return validPattern.test(codeVerifier);
}
