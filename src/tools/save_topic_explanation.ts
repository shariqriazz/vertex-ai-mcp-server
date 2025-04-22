import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema combining explain_topic_with_docs args + output_path
export const SaveTopicExplanationArgsSchema = z.object({
    topic: z.string().describe("The software/library/framework topic (e.g., 'React Router', 'Python requests')."),
    query: z.string().describe("The specific question to answer based on the documentation."),
    output_path: z.string().describe("The relative path where the generated explanation should be saved (e.g., 'explanations/react-router-hooks.md').")
});

// Convert Zod schema to JSON schema
const SaveTopicExplanationJsonSchema = zodToJsonSchema(SaveTopicExplanationArgsSchema);

export const saveTopicExplanationTool: ToolDefinition = {
    name: "save_topic_explanation",
    description: `Provides a detailed explanation for a query about a specific software topic using official documentation found via web search and saves the result to a file. Uses the configured Vertex AI model (${modelIdPlaceholder}). Requires 'topic', 'query', and 'output_path'.`,
    inputSchema: SaveTopicExplanationJsonSchema as any,

    // Build prompt logic adapted from explain_topic_with_docs (Reverted to original working version)
    buildPrompt: (args: any, modelId: string) => {
        const parsed = SaveTopicExplanationArgsSchema.safeParse(args);
         if (!parsed.success) {
             throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for save_topic_explanation: ${parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
        }
        const { topic, query } = parsed.data; // output_path used in handler

        const systemInstructionText = `You are an expert technical writer and documentation specialist. Your task is to provide a comprehensive and accurate explanation for a specific query about a software topic ("${topic}"), synthesizing information primarily from official documentation found via web search.

SEARCH METHODOLOGY:
1.  Identify the official documentation source for "${topic}".
2.  Search the official documentation specifically for information related to "${query}".
3.  Prioritize explanations, concepts, and usage examples directly from the official docs.
4.  If official docs are sparse, supplement with highly reputable sources (e.g., official blogs, key contributor articles), but clearly distinguish this from official documentation content.

RESPONSE REQUIREMENTS:
1.  **Accuracy:** Ensure the explanation is technically correct and reflects the official documentation for "${topic}".
2.  **Comprehensiveness:** Provide sufficient detail to thoroughly answer the query, including relevant concepts, code examples (if applicable and found in docs), and context.
3.  **Clarity:** Structure the explanation logically with clear language, headings, bullet points, and code formatting where appropriate.
4.  **Citation:** Cite the official documentation source(s) used.
5.  **Focus:** Directly address the user's query ("${query}") without unnecessary introductory or concluding remarks. Start directly with the explanation.
6.  **Format:** Use Markdown for formatting.`; // Reverted: Removed the "CRITICAL: Do NOT start..." instruction

        const userQueryText = `Provide a comprehensive explanation for the query "${query}" regarding the software topic "${topic}". Base the explanation primarily on official documentation found via web search. Include relevant concepts, code examples (if available in docs), and cite sources.`; // Reverted: Removed the extra instruction about starting format

        return {
            systemInstructionText: systemInstructionText,
            userQueryText: userQueryText,
            useWebSearch: true, // Always use web search for explanations based on docs
            enableFunctionCalling: false
        };
    }
};