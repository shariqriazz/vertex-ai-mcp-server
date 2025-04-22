import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema for websearch query answer + output path
export const SaveAnswerQueryWebsearchArgsSchema = z.object({
    query: z.string().describe("The natural language question to answer using web search."),
    output_path: z.string().describe("The relative path where the generated answer should be saved.")
});

// Convert Zod schema to JSON schema
const SaveAnswerQueryWebsearchJsonSchema = zodToJsonSchema(SaveAnswerQueryWebsearchArgsSchema);

export const saveAnswerQueryWebsearchTool: ToolDefinition = {
    name: "save_answer_query_websearch",
    description: `Answers a natural language query using Google Search results and saves the answer to a file. Uses the configured Vertex AI model (${modelIdPlaceholder}). Requires 'query' and 'output_path'.`,
    inputSchema: SaveAnswerQueryWebsearchJsonSchema as any,
    buildPrompt: (args: any, modelId: string) => {
        const parsed = SaveAnswerQueryWebsearchArgsSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for save_answer_query_websearch: ${parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        }
        const { query } = parsed.data; // output_path used in handler

        // --- Use Prompt Logic from answer_query_websearch.ts ---
        const base = `You are an AI assistant designed to answer questions accurately using provided search results. You are an EXPERT at synthesizing information from diverse sources into comprehensive, well-structured responses.`;

        const ground = ` Base your answer *only* on Google Search results relevant to "${query}". Synthesize information from search results into a coherent, comprehensive response that directly addresses the query. If search results are insufficient or irrelevant, explicitly state which aspects you cannot answer based on available information. Never add information not present in search results. When search results conflict, acknowledge the contradictions and explain different perspectives.`;

        const structure = ` Structure your response with clear organization:
1. Begin with a concise executive summary of 2-3 sentences that directly answers the main question.
2. For complex topics, use appropriate headings and subheadings to organize different aspects of the answer.
3. Present information from newest to oldest when dealing with evolving topics or current events.
4. Where appropriate, use numbered or bulleted lists to present steps, features, or comparative points.
5. For controversial topics, present multiple perspectives fairly with supporting evidence from search results.
6. Include a "Sources and Limitations" section at the end that notes the reliability of sources and any information gaps.`;

        const citation = ` Citation requirements:
1. Cite specific sources within your answer using [Source X] format.
2. Prioritize information from reliable, authoritative sources over random websites or forums.
3. For statistics, quotes, or specific claims, attribute the specific source.
4. Evaluate source credibility and recency - prefer official, recent sources for time-sensitive topics.
5. When search results indicate information might be outdated, explicitly note this limitation.`;

        const format = ` Format your answer in clean, readable Markdown:
1. Use proper headings (##, ###) for major sections.
2. Use **bold** for emphasis of key points.
3. Use \`code formatting\` for technical terms, commands, or code snippets when relevant.
4. Create tables for comparing multiple items or options.
5. Use blockquotes (>) for direct quotations from sources.`;

        const systemInstructionText = base + ground + structure + citation + format;
        const userQueryText = `I need a comprehensive answer to this question: "${query}"

In your answer:
1. Thoroughly search for and evaluate ALL relevant information from search results
2. Synthesize information from multiple sources into a coherent, well-structured response
3. Present differing viewpoints fairly when sources disagree
4. Include appropriate citations to specific sources
5. Note any limitations in the available information
6. Organize your response logically with clear headings and sections
7. Use appropriate formatting to enhance readability

Please provide your COMPLETE response addressing all aspects of my question.`;

        return {
            systemInstructionText: systemInstructionText,
            userQueryText: userQueryText,
            useWebSearch: true, // Always true for this tool
            enableFunctionCalling: false
        };
    }
};