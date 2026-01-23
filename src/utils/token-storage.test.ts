import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
    getTokenFilePath,
    loadTokens,
    saveTokens,
    clearTokens,
    checkTokenScopes,
    isTokenExpiringSoon
} from './token-storage.js';

describe('Token storage utilities', () => {
    let testDir: string;
    let testTokenFile: string;

    beforeEach(() => {
        // Create a temporary test directory
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-storage-test-'));
        testTokenFile = path.join(testDir, 'oauth-tokens.json');
    });

    afterEach(() => {
        // Clean up test directory
        try {
            if (fs.existsSync(testDir)) {
                fs.rmSync(testDir, { recursive: true });
            }
        } catch {
            // Ignore cleanup errors
        }
    });

    describe('getTokenFilePath', () => {
        it('should return path in provided config directory', () => {
            const result = getTokenFilePath(testDir);
            expect(result).toBe(path.join(testDir, 'oauth-tokens.json'));
        });

        it('should create config directory if it does not exist', () => {
            const newDir = path.join(testDir, 'new-config');
            expect(fs.existsSync(newDir)).toBe(false);

            getTokenFilePath(newDir);

            expect(fs.existsSync(newDir)).toBe(true);
        });
    });

    describe('saveTokens and loadTokens', () => {
        it('should save and load tokens correctly', () => {
            const tokens = {
                access_token: 'test-access-token',
                refresh_token: 'test-refresh-token',
                scope: 'scope1 scope2',
                expiry_date: Date.now() + 3600000
            };

            saveTokens(tokens, testTokenFile);
            const loaded = loadTokens(testTokenFile);

            expect(loaded).toEqual(tokens);
        });

        it('should return null if token file does not exist', () => {
            const loaded = loadTokens(testTokenFile);
            expect(loaded).toBeNull();
        });

        it('should return null if token file contains invalid JSON', () => {
            fs.writeFileSync(testTokenFile, 'not valid json');
            const loaded = loadTokens(testTokenFile);
            expect(loaded).toBeNull();
        });

        it('should overwrite existing tokens', () => {
            const tokens1 = { access_token: 'token1' };
            const tokens2 = { access_token: 'token2' };

            saveTokens(tokens1, testTokenFile);
            saveTokens(tokens2, testTokenFile);

            const loaded = loadTokens(testTokenFile);
            expect(loaded).toEqual(tokens2);
        });
    });

    describe('clearTokens', () => {
        it('should delete the token file', () => {
            saveTokens({ access_token: 'test' }, testTokenFile);
            expect(fs.existsSync(testTokenFile)).toBe(true);

            clearTokens(testTokenFile);

            expect(fs.existsSync(testTokenFile)).toBe(false);
        });

        it('should not throw if token file does not exist', () => {
            expect(() => clearTokens(testTokenFile)).not.toThrow();
        });
    });

    describe('checkTokenScopes', () => {
        it('should return hasAllScopes true when all scopes present', () => {
            const credentials = {
                scope: 'scope1 scope2 scope3'
            };

            const result = checkTokenScopes(credentials, ['scope1', 'scope2']);

            expect(result.hasAllScopes).toBe(true);
            expect(result.missingScopes).toEqual([]);
        });

        it('should return hasAllScopes false when scopes missing', () => {
            const credentials = {
                scope: 'scope1'
            };

            const result = checkTokenScopes(credentials, ['scope1', 'scope2', 'scope3']);

            expect(result.hasAllScopes).toBe(false);
            expect(result.missingScopes).toEqual(['scope2', 'scope3']);
        });

        it('should handle empty scope string', () => {
            const credentials = {
                scope: ''
            };

            const result = checkTokenScopes(credentials, ['scope1']);

            expect(result.hasAllScopes).toBe(false);
            expect(result.missingScopes).toEqual(['scope1']);
        });

        it('should handle undefined scope', () => {
            const credentials = {};

            const result = checkTokenScopes(credentials, ['scope1']);

            expect(result.hasAllScopes).toBe(false);
            expect(result.missingScopes).toEqual(['scope1']);
        });

        it('should handle empty required scopes', () => {
            const credentials = {
                scope: 'scope1'
            };

            const result = checkTokenScopes(credentials, []);

            expect(result.hasAllScopes).toBe(true);
            expect(result.missingScopes).toEqual([]);
        });
    });

    describe('isTokenExpiringSoon', () => {
        it('should return true if token is already expired', () => {
            const credentials = {
                expiry_date: Date.now() - 1000 // 1 second ago
            };

            expect(isTokenExpiringSoon(credentials)).toBe(true);
        });

        it('should return true if token expires within buffer', () => {
            const credentials = {
                expiry_date: Date.now() + 2 * 60 * 1000 // 2 minutes from now
            };

            // Default buffer is 5 minutes
            expect(isTokenExpiringSoon(credentials)).toBe(true);
        });

        it('should return false if token expires after buffer', () => {
            const credentials = {
                expiry_date: Date.now() + 10 * 60 * 1000 // 10 minutes from now
            };

            // Default buffer is 5 minutes
            expect(isTokenExpiringSoon(credentials)).toBe(false);
        });

        it('should respect custom buffer time', () => {
            const credentials = {
                expiry_date: Date.now() + 5 * 60 * 1000 // 5 minutes from now
            };

            // Custom buffer of 10 minutes
            expect(isTokenExpiringSoon(credentials, 10 * 60 * 1000)).toBe(true);

            // Custom buffer of 1 minute
            expect(isTokenExpiringSoon(credentials, 1 * 60 * 1000)).toBe(false);
        });

        it('should return false if no expiry_date', () => {
            const credentials = {};

            expect(isTokenExpiringSoon(credentials)).toBe(false);
        });
    });
});
