/**
 * Standalone Discovery Engine Search tool for querying Google Drive.
 *
 * This tool directly searches Google Drive via Discovery Engine and returns results
 * without going through Gemini processing.
 *
 * IMPORTANT: This tool always uses OAuth authentication to ensure users only see
 * content they have permission to access. Service account authentication is not
 * supported to prevent unauthorized access to sensitive files.
 */

import { z } from 'zod';
import { McpAuthManager } from '../auth/McpAuthManager.js';
import { formatDriveResults, parseDriveResults, DriveSearchResult } from '../utils/drive-result-parser.js';

// Input schema
export const SearchDriveSchema = z.object({
    query: z.string().describe('The search query for finding relevant Google Drive files'),
    max_results: z.number().min(1).max(10).optional().describe('Maximum number of results to return (default: 5, max: 10)')
});

export type SearchDriveInput = z.infer<typeof SearchDriveSchema>;

/**
 * Make a REST API call to Discovery Engine Search API with OAuth token.
 */
async function searchWithOAuth(
    accessToken: string,
    projectId: string,
    location: string,
    collectionId: string,
    engineId: string,
    servingConfigId: string,
    query: string,
    maxResults: number
): Promise<any[]> {
    const apiEndpoint = location === 'global'
        ? 'discoveryengine.googleapis.com'
        : `${location}-discoveryengine.googleapis.com`;

    // Use v1alpha for access to all features including Drive search
    const url = `https://${apiEndpoint}/v1alpha/projects/${projectId}/locations/${location}/collections/${collectionId}/engines/${engineId}/servingConfigs/${servingConfigId}:search`;

    const requestBody = {
        query: query,
        pageSize: Math.min(maxResults, 10),
        spellCorrectionSpec: { mode: 'AUTO' },
        languageCode: 'en-US',
        contentSearchSpec: {
            snippetSpec: { returnSnippet: true },
            extractiveContentSpec: {
                maxExtractiveAnswerCount: 3,
                maxExtractiveSegmentCount: 2,
            }
        },
        naturalLanguageQueryUnderstandingSpec: {
            filterExtractionCondition: 'ENABLED'
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Discovery Engine API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.results || [];
}

/**
 * Search Google Drive using Discovery Engine Search API.
 * Always uses OAuth authentication to ensure proper access control.
 */
export async function searchDrive(input: SearchDriveInput): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { query, max_results = 5 } = input;

    // Configuration from environment
    const projectId = process.env.DRIVE_ENGINE_PROJECT_NUMBER;
    const engineId = process.env.DRIVE_ENGINE_ID;

    if (!projectId) {
        throw new Error('DRIVE_ENGINE_PROJECT_NUMBER environment variable is required for Google Drive search');
    }
    if (!engineId) {
        throw new Error('DRIVE_ENGINE_ID environment variable is required for Google Drive search');
    }

    const location = 'global';
    const collectionId = 'default_collection';
    const servingConfigId = 'default_search';

    // Always use OAuth user credentials to ensure proper access control
    // This prevents users from seeing content they don't have permission to access
    const scopes = ['https://www.googleapis.com/auth/cloud-platform'];
    const authManager = new McpAuthManager(scopes);
    const oauthClient = await authManager.getAuthenticatedClient();

    // Get the access token
    const tokenResponse = await oauthClient.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
        throw new Error('Failed to get access token from OAuth client');
    }

    // Use REST API with OAuth token
    const searchResults = await searchWithOAuth(
        accessToken,
        projectId,
        location,
        collectionId,
        engineId,
        servingConfigId,
        query,
        max_results
    );

    // Parse and format the results
    const results = parseDriveResults(searchResults);
    const formattedResults = formatDriveResults(results);

    // Return as MCP tool result
    return {
        content: [
            {
                type: 'text',
                text: formattedResults
            }
        ]
    };
}
