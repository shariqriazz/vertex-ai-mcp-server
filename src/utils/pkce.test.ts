import { describe, it, expect } from 'vitest';
import { generateCodeVerifier, generateCodeChallenge, isValidCodeVerifier } from './pkce.js';

describe('PKCE utilities', () => {
    describe('generateCodeVerifier', () => {
        it('should generate a string of correct length', () => {
            const verifier = generateCodeVerifier();
            // 32 bytes encoded as base64url = 43 characters
            expect(verifier.length).toBe(43);
        });

        it('should generate valid code verifier characters', () => {
            const verifier = generateCodeVerifier();
            expect(isValidCodeVerifier(verifier)).toBe(true);
        });

        it('should generate unique values', () => {
            const verifier1 = generateCodeVerifier();
            const verifier2 = generateCodeVerifier();
            expect(verifier1).not.toBe(verifier2);
        });

        it('should only contain base64url characters', () => {
            const verifier = generateCodeVerifier();
            // base64url uses A-Z, a-z, 0-9, -, _
            const validPattern = /^[A-Za-z0-9_-]+$/;
            expect(validPattern.test(verifier)).toBe(true);
        });
    });

    describe('generateCodeChallenge', () => {
        it('should generate a SHA256 hash of the code verifier', () => {
            const verifier = 'test-code-verifier-12345678901234567890';
            const challenge = generateCodeChallenge(verifier);

            // SHA256 hash encoded as base64url = 43 characters
            expect(challenge.length).toBe(43);
        });

        it('should produce consistent results for same input', () => {
            const verifier = 'consistent-test-verifier-123456789012';
            const challenge1 = generateCodeChallenge(verifier);
            const challenge2 = generateCodeChallenge(verifier);
            expect(challenge1).toBe(challenge2);
        });

        it('should produce different results for different inputs', () => {
            const challenge1 = generateCodeChallenge('verifier-one-1234567890123456789012');
            const challenge2 = generateCodeChallenge('verifier-two-1234567890123456789012');
            expect(challenge1).not.toBe(challenge2);
        });

        it('should only contain base64url characters', () => {
            const verifier = generateCodeVerifier();
            const challenge = generateCodeChallenge(verifier);
            // base64url uses A-Z, a-z, 0-9, -, _
            const validPattern = /^[A-Za-z0-9_-]+$/;
            expect(validPattern.test(challenge)).toBe(true);
        });

        // Test vector from RFC 7636 Appendix B
        it('should match RFC 7636 test vector', () => {
            // The RFC uses plain base64, but we use base64url
            // code_verifier: dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk
            // S256 code_challenge: E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
            const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
            const challenge = generateCodeChallenge(verifier);
            // base64url version of the challenge
            expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
        });
    });

    describe('isValidCodeVerifier', () => {
        it('should accept valid code verifiers', () => {
            expect(isValidCodeVerifier('a'.repeat(43))).toBe(true);
            expect(isValidCodeVerifier('a'.repeat(128))).toBe(true);
            expect(isValidCodeVerifier('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopq')).toBe(true);
        });

        it('should reject verifiers that are too short', () => {
            expect(isValidCodeVerifier('a'.repeat(42))).toBe(false);
            expect(isValidCodeVerifier('')).toBe(false);
        });

        it('should reject verifiers that are too long', () => {
            expect(isValidCodeVerifier('a'.repeat(129))).toBe(false);
        });

        it('should accept unreserved characters', () => {
            // Test all unreserved characters per RFC 7636
            const unreserved = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklm0123456789-._~';
            expect(isValidCodeVerifier(unreserved)).toBe(true);
        });

        it('should reject reserved characters', () => {
            // These characters are NOT allowed in code verifiers
            expect(isValidCodeVerifier('a'.repeat(42) + '!')).toBe(false);
            expect(isValidCodeVerifier('a'.repeat(42) + '@')).toBe(false);
            expect(isValidCodeVerifier('a'.repeat(42) + '#')).toBe(false);
            expect(isValidCodeVerifier('a'.repeat(42) + ' ')).toBe(false);
        });
    });
});
