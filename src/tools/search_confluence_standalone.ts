/**
 * Standalone Discovery Engine Search tool for querying Confluence documentation.
 *
 * This tool directly searches Confluence via Discovery Engine and returns results
 * without going through Gemini processing.
 */

import { z } from 'zod';
import { GoogleAuth } from 'google-auth-library';
import { McpAuthManager } from '../auth/McpAuthManager.js';

// Input schema
export const SearchConfluenceSchema = z.object({
    query: z.string().describe('The search query for finding relevant Confluence pages'),
    max_results: z.number().min(1).max(10).optional().describe('Maximum number of results to return (default: 5, max: 10)'),
    use_user_auth: z.boolean().optional().describe('Use OAuth user authentication to get personalized results (default: false). When true, only returns content the authenticated user has permission to access.')
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
 */
export async function searchConfluence(input: SearchConfluenceInput): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { query, max_results = 5, use_user_auth = false } = input;

    // Configuration from environment
    const projectId = process.env.DISCOVERY_ENGINE_PROJECT_NUMBER || '403334419176';
    const location = 'global';
    const collectionId = 'default_collection';
    const dataStoreId = process.env.DISCOVERY_ENGINE_ID || 'agentspace-1750425553806_1750425553806';
    const servingConfigId = 'default_search';

    let searchResults: any[];

    if (use_user_auth) {
        // Use OAuth user credentials via REST API
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
        searchResults = await searchWithOAuth(
            accessToken,
            projectId,
            location,
            collectionId,
            dataStoreId,
            servingConfigId,
            query,
            max_results
        );
    } else {
        // Use client library with Application Default Credentials
        const discoveryengine = await import('@google-cloud/discoveryengine');
        const { SearchServiceClient } = discoveryengine.v1beta;

        const apiEndpoint = location === 'global'
            ? 'discoveryengine.googleapis.com'
            : `${location}-discoveryengine.googleapis.com`;

        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });

        const client = new SearchServiceClient({
            auth: auth as any,
            apiEndpoint: apiEndpoint
        });

        const name = `projects/${projectId}/locations/${location}/collections/${collectionId}/engines/${dataStoreId}/servingConfigs/${servingConfigId}`;

        const request = {
            servingConfig: name,
            query: query,
            pageSize: Math.min(max_results, 10),
            spellCorrectionSpec: { mode: 'AUTO' as const },
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

        const response = await client.search(request as any, {
            autoPaginate: false,
        });

        const searchResponse = response[2] as any;
        searchResults = searchResponse?.results || [];
    }

    const results: SearchResult[] = [];

    // Process results - handle both REST API (plain JSON) and client library (protobuf) formats
    for (const result of searchResults) {
        const doc = result.document as any;
        if (!doc) continue;

        // REST API returns plain JSON, client library returns protobuf structure
        const derivedData = doc.derivedStructData;
        const structData = doc.structData;

        // Check if this is protobuf format (has .fields) or plain JSON
        const isProtobuf = derivedData?.fields !== undefined;

        let title: string;
        let resultUrl: string;
        const searchResult: SearchResult = {
            title: '',
            link: '',
            snippets: [],
            extractive_answers: []
        };

        if (isProtobuf) {
            // Protobuf format from client library
            const derivedFields = derivedData?.fields;
            const structFields = structData?.fields;

            title = derivedFields?.title?.stringValue
                || structFields?.title?.stringValue
                || 'Untitled';

            resultUrl = derivedFields?.url?.stringValue
                || structFields?.uri?.stringValue
                || structFields?.self?.stringValue
                || '';

            // Extract snippets
            const snippetsList = derivedFields?.snippets?.listValue?.values;
            if (snippetsList && Array.isArray(snippetsList)) {
                for (const snippetItem of snippetsList) {
                    const snippetText = snippetItem?.structValue?.fields?.snippet?.stringValue;
                    if (snippetText) {
                        searchResult.snippets.push(snippetText);
                    }
                }
            }

            // Extract extractive answers
            const answersList = derivedFields?.extractive_answers?.listValue?.values;
            if (answersList && Array.isArray(answersList)) {
                for (const answerItem of answersList) {
                    const answerText = answerItem?.structValue?.fields?.content?.stringValue;
                    if (answerText) {
                        searchResult.extractive_answers.push(answerText);
                    }
                }
            }

            // Extract extractive segments
            const segmentsList = derivedFields?.extractive_segments?.listValue?.values;
            if (segmentsList && Array.isArray(segmentsList)) {
                for (const segmentItem of segmentsList) {
                    const segmentText = segmentItem?.structValue?.fields?.content?.stringValue;
                    if (segmentText) {
                        searchResult.snippets.push(segmentText);
                    }
                }
            }
        } else {
            // Plain JSON format from REST API
            title = derivedData?.title || structData?.title || 'Untitled';
            resultUrl = derivedData?.url || structData?.uri || structData?.self || '';

            // Extract snippets (REST API format)
            const snippetsList = derivedData?.snippets;
            if (snippetsList && Array.isArray(snippetsList)) {
                for (const snippetItem of snippetsList) {
                    const snippetText = snippetItem?.snippet;
                    if (snippetText) {
                        searchResult.snippets.push(snippetText);
                    }
                }
            }

            // Extract extractive answers (REST API format)
            const answersList = derivedData?.extractive_answers;
            if (answersList && Array.isArray(answersList)) {
                for (const answerItem of answersList) {
                    const answerText = answerItem?.content;
                    if (answerText) {
                        searchResult.extractive_answers.push(answerText);
                    }
                }
            }

            // Extract extractive segments (REST API format)
            const segmentsList = derivedData?.extractive_segments;
            if (segmentsList && Array.isArray(segmentsList)) {
                for (const segmentItem of segmentsList) {
                    const segmentText = segmentItem?.content;
                    if (segmentText) {
                        searchResult.snippets.push(segmentText);
                    }
                }
            }
        }

        searchResult.title = title;
        searchResult.link = resultUrl;
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
