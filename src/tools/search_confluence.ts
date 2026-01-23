import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition } from "./tool_definition.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SearchConfluenceSchema } from "./search_confluence_standalone.js";

// Convert Zod schema to JSON schema for the tool definition
const SearchConfluenceJsonSchema = zodToJsonSchema(SearchConfluenceSchema);

export const searchConfluenceTool: ToolDefinition = {
    name: "search_confluence",
    description:
        "Search Helix Confluence documentation using Discovery Engine. " +
        "Returns relevant pages, snippets, and key information from internal documentation. " +
        "Supports both service account (default) and OAuth user authentication for personalized results. " +
        "When use_user_auth=true and OAuth is enabled, only returns content the authenticated user has permission to access.",
    inputSchema: SearchConfluenceJsonSchema as any,

    // This tool doesn't use the LLM, so buildPrompt is minimal
    buildPrompt: (args: any, modelId: string) => {
        // Validate arguments
        const parsed = SearchConfluenceSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(
                ErrorCode.InvalidParams,
                `Invalid arguments for search_confluence: ${parsed.error}`
            );
        }
        // No prompt generation needed for direct execution logic
        return {
            systemInstructionText: "",
            userQueryText: "",
            useWebSearch: false,
            enableFunctionCalling: false
        };
    }
};
