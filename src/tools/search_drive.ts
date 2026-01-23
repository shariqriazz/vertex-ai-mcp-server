import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition } from "./tool_definition.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { SearchDriveSchema } from "./search_drive_standalone.js";

// Convert Zod schema to JSON schema for the tool definition
const SearchDriveJsonSchema = zodToJsonSchema(SearchDriveSchema);

export const searchDriveTool: ToolDefinition = {
    name: "search_drive",
    description:
        "Search Google Drive files using Discovery Engine. " +
        "Returns relevant documents, spreadsheets, presentations, and other files with snippets and key information. " +
        "Supports both service account (default) and OAuth user authentication for personalized results. " +
        "When use_user_auth=true and OAuth is enabled, only returns content the authenticated user has permission to access.",
    inputSchema: SearchDriveJsonSchema as any,

    // This tool doesn't use the LLM, so buildPrompt is minimal
    buildPrompt: (args: any, modelId: string) => {
        // Validate arguments
        const parsed = SearchDriveSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(
                ErrorCode.InvalidParams,
                `Invalid arguments for search_drive: ${parsed.error}`
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
