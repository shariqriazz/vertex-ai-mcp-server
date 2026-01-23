/**
 * Standalone Discovery Engine Search tool for querying Confluence documentation.
 *
 * This tool directly searches Confluence via Discovery Engine and returns results
 * without going through Gemini processing.
 *
 * IMPORTANT: This tool always uses OAuth authentication to ensure users only see
 * content they have permission to access. Service account authentication is not
 * supported to prevent unauthorized access to sensitive documentation.
 */

import { z } from 'zod';
import { McpAuthManager } from '../auth/McpAuthManager.js';

// Input schema
export const SearchConfluenceSchema = z.object({
    query: z.string().describe('The search query for finding relevant Confluence pages'),
    max_results: z.number().min(1).max(10).optional().describe('Maximum number of results to return (default: 5, max: 10)')
});

export type SearchConfluenceInput = z.infer<typeof SearchConfluenceSchema>;

interface SearchResult {
    title: string;
    link?: string;
    snippets: string[];
    extractive_answers: string[];
}

/**
 * Clean HTML entities and tags from text.
 */
function cleanText(text: string): string {
    return text
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/<\/?b>/g, '**')  // Convert bold tags to markdown
        .replace(/<br\s*\/?>/gi, '\n')  // Convert breaks to newlines
        .replace(/<[^>]+>/g, '');  // Remove other HTML tags
}

/**
 * Format search results as structured markdown.
 */
function formatSearchResults(results: SearchResult[]): string {
    if (results.length === 0) {
        return "No results found in Confluence documentation.";
    }

    let output = `# Confluence Search Results\n\n`;
    output += `Found ${results.length} relevant pages:\n\n`;

    results.forEach((result, idx) => {
        output += `## ${idx + 1}. ${result.title}\n\n`;

        if (result.link) {
            output += `**Link**: ${result.link}\n\n`;
        }

        if (result.extractive_answers.length > 0) {
            output += `**Key Information**:\n\n`;
            result.extractive_answers.forEach(answer => {
                const cleaned = cleanText(answer);
                if (cleaned.trim()) {
                    output += `- ${cleaned}\n`;
                }
            });
            output += '\n';
        }

        if (result.snippets.length > 0) {
            output += `**Relevant Snippets**:\n\n`;
            result.snippets.forEach(snippet => {
                const cleaned = cleanText(snippet);
                if (cleaned.trim()) {
                    output += `${cleaned}\n\n`;
                }
            });
        }

        output += '---\n\n';
    });

    return output;
}

/**
 * Make a REST API call to Discovery Engine Search API with OAuth token.
 */
async function searchWithOAuth(
    accessToken: string,
    projectId: string,
    location: string,
    collectionId: string,
    dataStoreId: string,
    servingConfigId: string,
    query: string,
    maxResults: number
): Promise<any[]> {
    const apiEndpoint = location === 'global'
        ? 'discoveryengine.googleapis.com'
        : `${location}-discoveryengine.googleapis.com`;

    const url = `https://${apiEndpoint}/v1beta/projects/${projectId}/locations/${location}/collections/${collectionId}/engines/${dataStoreId}/servingConfigs/${servingConfigId}:search`;

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
 * Search Confluence using Discovery Engine Search API.
 * Always uses OAuth authentication to ensure proper access control.
 */
export async function searchConfluence(input: SearchConfluenceInput): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { query, max_results = 5 } = input;

    // Configuration from environment
    const projectId = process.env.DISCOVERY_ENGINE_PROJECT_NUMBER || '403334419176';
    const location = 'global';
    const collectionId = 'default_collection';
    const dataStoreId = process.env.DISCOVERY_ENGINE_ID || 'agentspace-1750425553806_1750425553806';
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
        dataStoreId,
        servingConfigId,
        query,
        max_results
    );

    const results: SearchResult[] = [];

    // Process results from REST API (plain JSON format)
    for (const result of searchResults) {
        const doc = result.document as any;
        if (!doc) continue;

        const derivedData = doc.derivedStructData;
        const structData = doc.structData;

        const searchResult: SearchResult = {
            title: derivedData?.title || structData?.title || 'Untitled',
            link: derivedData?.url || structData?.uri || structData?.self || '',
            snippets: [],
            extractive_answers: []
        };

        // Extract snippets
        const snippetsList = derivedData?.snippets;
        if (snippetsList && Array.isArray(snippetsList)) {
            for (const snippetItem of snippetsList) {
                const snippetText = snippetItem?.snippet;
                if (snippetText) {
                    searchResult.snippets.push(snippetText);
                }
            }
        }

        // Extract extractive answers
        const answersList = derivedData?.extractive_answers;
        if (answersList && Array.isArray(answersList)) {
            for (const answerItem of answersList) {
                const answerText = answerItem?.content;
                if (answerText) {
                    searchResult.extractive_answers.push(answerText);
                }
            }
        }

        // Extract extractive segments as additional snippets
        const segmentsList = derivedData?.extractive_segments;
        if (segmentsList && Array.isArray(segmentsList)) {
            for (const segmentItem of segmentsList) {
                const segmentText = segmentItem?.content;
                if (segmentText) {
                    searchResult.snippets.push(segmentText);
                }
            }
        }

        results.push(searchResult);
    }

    // Format the results
    const formattedResults = formatSearchResults(results);

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
