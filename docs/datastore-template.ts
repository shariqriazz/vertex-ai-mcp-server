/**
 * Template for creating a new Discovery Engine datastore search tool
 *
 * Steps to use this template:
 * 1. Copy this file to src/tools/search_{datastore_name}.ts
 * 2. Replace all {DATASTORE} placeholders with your datastore name
 * 3. Update the schema with datastore-specific parameters
 * 4. Adjust field extraction based on your datastore's structure
 * 5. Test with debug output first to see actual field structure
 * 6. Register in src/tools/index.ts
 */

import { z } from 'zod';
import { GoogleAuth } from 'google-auth-library';

// Define input schema with datastore-specific parameters
export const Search{DATASTORE}Schema = z.object({
    query: z.string().describe('The search query'),
    max_results: z.number().min(1).max(10).optional().describe('Maximum results (default: 5)'),
    // Add datastore-specific filters here
    // Example for Jira: project: z.string().optional()
    // Example for Gmail: from: z.string().optional()
});

export type Search{DATASTORE}Input = z.infer<typeof Search{DATASTORE}Schema>;

interface SearchResult {
    title: string;
    link?: string;
    snippets: string[];
    extractive_answers: string[];
    // Add datastore-specific fields here
    // Example: author?: string;
    // Example: created_date?: string;
}

/**
 * Format search results as markdown
 */
function formatSearchResults(results: SearchResult[]): string {
    if (results.length === 0) {
        return "No results found in {DATASTORE}.";
    }

    let output = `# {DATASTORE} Search Results\n\n`;
    output += `Found ${results.length} relevant items:\n\n`;

    results.forEach((result, idx) => {
        output += `## ${idx + 1}. ${result.title}\n\n`;

        if (result.link) {
            output += `**Link**: ${result.link}\n\n`;
        }

        if (result.extractive_answers.length > 0) {
            output += `**Key Information**:\n\n`;
            result.extractive_answers.forEach(answer => {
                output += `- ${answer}\n`;
            });
            output += '\n';
        }

        if (result.snippets.length > 0) {
            output += `**Relevant Snippets**:\n\n`;
            result.snippets.forEach(snippet => {
                output += `${snippet}\n\n`;
            });
        }

        output += '---\n\n';
    });

    return output;
}

/**
 * Search {DATASTORE} using Discovery Engine
 */
export async function search{DATASTORE}(input: Search{DATASTORE}Input): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { query, max_results = 5 } = input;

    // Configuration from environment
    const projectId = process.env.DISCOVERY_ENGINE_PROJECT_NUMBER || '403334419176';
    const location = 'global';
    const collectionId = 'default_collection';
    const engineId = process.env.DISCOVERY_ENGINE_ID || 'agentspace-1750425553806_1750425553806';
    const servingConfigId = 'default_search';

    // CRITICAL: Use v1beta API
    const discoveryengine = await import('@google-cloud/discoveryengine');
    const { SearchServiceClient } = discoveryengine.v1beta;

    // Set API endpoint
    const apiEndpoint = location === 'global'
        ? 'discoveryengine.googleapis.com'
        : `${location}-discoveryengine.googleapis.com`;

    // Create authenticated client
    const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = new SearchServiceClient({
        auth: auth as any,
        apiEndpoint: apiEndpoint
    });

    // Build serving config path (use 'engines' not 'dataStores')
    const name = `projects/${projectId}/locations/${location}/collections/${collectionId}/engines/${engineId}/servingConfigs/${servingConfigId}`;

    // Build filter for this datastore
    // Replace '{datastore_type}' with actual source type: "confluence", "jira", "gmail", etc.
    let filter = 'source_type:"{datastore_type}"';

    // Add datastore-specific filters
    // Example for Jira:
    // if (input.project) {
    //     filter += ` AND project:"${input.project}"`;
    // }

    // Build search request
    const request = {
        servingConfig: name,
        query: query,
        pageSize: Math.min(max_results, 10),
        filter: filter, // Apply datastore filter
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

    // Execute search (CRITICAL: disable autoPaginate)
    const response = await client.search(request as any, {
        autoPaginate: false,
    });

    // Extract results from response tuple [results, request, response]
    const searchResponse = response[2] as any;
    const searchResults = searchResponse?.results || [];

    // DEBUG: Uncomment to inspect response structure
    // if (searchResults.length > 0) {
    //     console.error('[DEBUG]', JSON.stringify(searchResults[0], null, 2));
    // }

    const results: SearchResult[] = [];

    // Process results - adjust field paths based on your datastore
    for (const result of searchResults) {
        const doc = result.document as any;
        if (!doc) continue;

        // Fields are in protobuf format with type wrappers
        const derivedFields = doc.derivedStructData?.fields;
        const structFields = doc.structData?.fields;

        // Extract title (check multiple locations)
        const title = derivedFields?.title?.stringValue
            || structFields?.title?.stringValue
            || structFields?.summary?.stringValue  // Alternative field name
            || 'Untitled';

        // Extract URL
        const url = derivedFields?.url?.stringValue
            || structFields?.uri?.stringValue
            || structFields?.self?.stringValue
            || '';

        const searchResult: SearchResult = {
            title: title,
            link: url,
            snippets: [],
            extractive_answers: []
        };

        // Extract snippets (protobuf list format)
        const snippetsList = derivedFields?.snippets?.listValue?.values;
        if (snippetsList && Array.isArray(snippetsList)) {
            for (const item of snippetsList) {
                const snippet = item?.structValue?.fields?.snippet?.stringValue;
                if (snippet) {
                    searchResult.snippets.push(snippet);
                }
            }
        }

        // Extract extractive answers
        const answersList = derivedFields?.extractive_answers?.listValue?.values;
        if (answersList && Array.isArray(answersList)) {
            for (const item of answersList) {
                const answer = item?.structValue?.fields?.content?.stringValue;
                if (answer) {
                    searchResult.extractive_answers.push(answer);
                }
            }
        }

        // Extract extractive segments as additional snippets
        const segmentsList = derivedFields?.extractive_segments?.listValue?.values;
        if (segmentsList && Array.isArray(segmentsList)) {
            for (const item of segmentsList) {
                const segment = item?.structValue?.fields?.content?.stringValue;
                if (segment) {
                    searchResult.snippets.push(segment);
                }
            }
        }

        // Extract datastore-specific fields
        // Example for Jira:
        // searchResult.author = structFields?.fields?.structValue?.fields?.creator?.structValue?.fields?.displayName?.stringValue;
        // searchResult.created_date = structFields?.fields?.structValue?.fields?.created?.stringValue;

        results.push(searchResult);
    }

    // Format and return results
    const formattedResults = formatSearchResults(results);

    return {
        content: [
            {
                type: 'text',
                text: formattedResults
            }
        ]
    };
}

/**
 * How to register this tool:
 *
 * 1. In src/tools/search_{datastore}.ts (this file):
 *    - Export the search function and schema
 *
 * 2. Create src/tools/{datastore}_tool.ts:
 *    ```typescript
 *    import { ToolDefinition } from "./tool_definition.js";
 *    import { zodToJsonSchema } from "zod-to-json-schema";
 *    import { Search{DATASTORE}Schema } from "./search_{datastore}.js";
 *
 *    export const search{DATASTORE}Tool: ToolDefinition = {
 *        name: "search_{datastore}",
 *        description: "Search {DATASTORE} for relevant information",
 *        inputSchema: zodToJsonSchema(Search{DATASTORE}Schema) as any,
 *        buildPrompt: (args: any, modelId: string) => {
 *            const parsed = Search{DATASTORE}Schema.safeParse(args);
 *            if (!parsed.success) {
 *                throw new Error(`Invalid arguments: ${parsed.error}`);
 *            }
 *            return {
 *                systemInstructionText: "",
 *                userQueryText: "",
 *                useWebSearch: false,
 *                enableFunctionCalling: false
 *            };
 *        }
 *    };
 *    ```
 *
 * 3. In src/tools/index.ts:
 *    ```typescript
 *    import { search{DATASTORE}Tool } from "./{datastore}_tool.js";
 *
 *    export const allTools: ToolDefinition[] = [
 *        // ... other tools
 *        search{DATASTORE}Tool,
 *    ];
 *    ```
 *
 * 4. In src/index.ts, add execution handler:
 *    ```typescript
 *    import { search{DATASTORE}, Search{DATASTORE}Schema } from './tools/search_{datastore}.js';
 *
 *    // In the tool call handler, add case:
 *    else if (toolName === "search_{datastore}") {
 *        const parsed = Search{DATASTORE}Schema.parse(args);
 *        const result = await search{DATASTORE}(parsed);
 *        return result;
 *    }
 *    ```
 */
