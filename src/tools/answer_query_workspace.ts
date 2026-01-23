import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const answerQueryWorkspaceTool: ToolDefinition = {
    name: "answer_query_workspace",
    description: `Answers a natural language query using the configured Vertex AI model (${modelIdPlaceholder}) enhanced with Google Workspace grounding for accessing your Google Drive, Docs, Sheets, Slides, and Gmail data. Requires a 'query' string. Note: OAuth authentication with user credentials must be configured for this tool to work.`,
    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The natural language question to answer using Google Workspace data (Drive, Docs, Sheets, Slides, Gmail)."
            }
        },
        required: ["query"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const query = args.query;
        if (typeof query !== "string" || !query) {
            throw new McpError(ErrorCode.InvalidParams, "Missing 'query'.");
        }

        const base = `You are an AI assistant designed to answer questions accurately using information from the user's Google Workspace. You are an EXPERT at synthesizing information from diverse workspace sources (Drive files, Docs, Sheets, Slides, Gmail) into comprehensive, well-structured responses.`;

        const ground = ` Base your answer *only* on information retrieved from the user's Google Workspace relevant to "${query}". Synthesize information from workspace sources into a coherent, comprehensive response that directly addresses the query. If workspace data is insufficient or irrelevant, explicitly state which aspects you cannot answer based on available information. Never add information not present in workspace results. When workspace sources conflict, acknowledge the contradictions and explain different perspectives.`;

        const structure = ` Structure your response with clear organization:
1. Begin with a concise executive summary of 2-3 sentences that directly answers the main question.
2. For complex topics, use appropriate headings and subheadings to organize different aspects of the answer.
3. Present information from newest to oldest when dealing with evolving topics or time-sensitive data.
4. Where appropriate, use numbered or bulleted lists to present steps, features, or comparative points.
5. For information from multiple sources, present different perspectives fairly with supporting evidence.
6. Include a "Sources and Limitations" section at the end that notes which workspace files/emails were referenced and any information gaps.`;

        const citation = ` Citation requirements:
1. Cite specific workspace sources within your answer using [Document Name] or [Email Subject] format.
2. For information from Google Docs, Sheets, or Slides, reference the document title.
3. For information from Gmail, reference the email subject line and date if available.
4. For Drive files, include the file name and type (if identifiable).
5. When workspace data appears outdated, explicitly note this limitation and the file's last modified date if available.`;

        const format = ` Format your answer in clean, readable Markdown:
1. Use proper headings (##, ###) for major sections.
2. Use **bold** for emphasis of key points.
3. Use \`code formatting\` for technical terms, commands, or code snippets when relevant.
4. Create tables for comparing multiple items or data from spreadsheets.
5. Use blockquotes (>) for direct quotations from documents or emails.`;

        return {
            systemInstructionText: base + ground + structure + citation + format,
            userQueryText: `I need a comprehensive answer to this question based on my Google Workspace data: "${query}"

In your answer:
1. Thoroughly search for and evaluate ALL relevant information from my Workspace (Drive, Docs, Sheets, Slides, Gmail)
2. Synthesize information from multiple sources into a coherent, well-structured response
3. Present differing viewpoints fairly when sources disagree
4. Include appropriate citations to specific workspace files/emails
5. Note any limitations in the available workspace data
6. Organize your response logically with clear headings and sections
7. Use appropriate formatting to enhance readability

Please provide your COMPLETE response addressing all aspects of my question.`,
            useWebSearch: false,
            useWorkspaceSearch: true,
            enableFunctionCalling: false
        };
    }
};
