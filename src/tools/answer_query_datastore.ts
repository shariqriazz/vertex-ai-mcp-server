import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const answerQueryDatastoreTool: ToolDefinition = {
    name: "answer_query_datastore",
    description: `Answers a natural language query using the configured Vertex AI model (${modelIdPlaceholder}) enhanced with Vertex AI Search grounding using a custom datastore. Requires a 'query' string and 'datastore_id' (format: projects/{project}/locations/{location}/collections/{collection}/dataStores/{dataStore}). Uses Application Default Credentials.`,
    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The natural language question to answer using data from the custom datastore."
            },
            datastore_id: {
                type: "string",
                description: "The Vertex AI Search datastore ID. Format: projects/{project}/locations/{location}/collections/{collection}/dataStores/{dataStore}. You can find this in the GCP Console under Vertex AI Search."
            }
        },
        required: ["query", "datastore_id"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const query = args.query;
        const datastoreId = args.datastore_id;

        if (typeof query !== "string" || !query) {
            throw new McpError(ErrorCode.InvalidParams, "Missing 'query'.");
        }

        if (typeof datastoreId !== "string" || !datastoreId) {
            throw new McpError(ErrorCode.InvalidParams, "Missing 'datastore_id'.");
        }

        // Validate datastore ID format
        if (!datastoreId.startsWith("projects/") || !datastoreId.includes("/dataStores/")) {
            throw new McpError(
                ErrorCode.InvalidParams,
                "Invalid datastore_id format. Expected: projects/{project}/locations/{location}/collections/{collection}/dataStores/{dataStore}"
            );
        }

        const base = `You are an AI assistant designed to answer questions accurately using information from a custom knowledge base. You are an EXPERT at synthesizing information from diverse data sources into comprehensive, well-structured responses.`;

        const ground = ` Base your answer *only* on information retrieved from the datastore relevant to "${query}". Synthesize information from multiple sources into a coherent, comprehensive response that directly addresses the query. If the datastore lacks sufficient information, explicitly state which aspects you cannot answer. Never add information not present in retrieval results. When sources conflict, acknowledge contradictions and explain different perspectives.`;

        const structure = ` Structure your response with clear organization:
1. Begin with a concise executive summary of 2-3 sentences that directly answers the main question.
2. For complex topics, use appropriate headings and subheadings to organize different aspects of the answer.
3. Present information from newest to oldest when dealing with evolving topics or time-sensitive data.
4. Where appropriate, use numbered or bulleted lists to present steps, features, or comparative points.
5. For information from multiple sources, present different perspectives fairly with supporting evidence.
6. Include a "Sources and Limitations" section at the end that notes any information gaps.`;

        const citation = ` Citation requirements:
1. Cite specific sources within your answer using [Source Name] format when available.
2. Reference document titles, URLs, or identifiers when provided in retrieval results.
3. When data appears outdated, explicitly note this limitation.
4. If source metadata is not available in retrieval results, still provide accurate information without fabricating citations.`;

        const format = ` Format your answer in clean, readable Markdown:
1. Use proper headings (##, ###) for major sections.
2. Use **bold** for emphasis of key points.
3. Use \`code formatting\` for technical terms, commands, or code snippets when relevant.
4. Create tables for comparing multiple items or structured data.
5. Use blockquotes (>) for direct quotations from sources.`;

        return {
            systemInstructionText: base + ground + structure + citation + format,
            userQueryText: `I need a comprehensive answer to this question based on the knowledge base: "${query}"

In your answer:
1. Thoroughly search for and evaluate ALL relevant information from the datastore
2. Synthesize information from multiple sources into a coherent, well-structured response
3. Present differing viewpoints fairly when sources disagree
4. Include appropriate citations to specific sources when available
5. Note any limitations in the available data
6. Organize your response logically with clear headings and sections
7. Use appropriate formatting to enhance readability

Please provide your COMPLETE response addressing all aspects of my question.`,
            useWebSearch: false,
            useWorkspaceSearch: true, // This flag enables datastore grounding
            customDatastoreId: datastoreId, // Pass the datastore ID
            enableFunctionCalling: false
        };
    }
};
