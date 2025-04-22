import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition (adapted from example.ts) - Exported
export const SearchFilesArgsSchema = z.object({
  path: z.string().describe("The starting directory path for the search (relative to the workspace directory)."),
  pattern: z.string().describe("The case-insensitive text pattern to search for in file/directory names."),
  excludePatterns: z.array(z.string()).optional().default([]).describe("An array of glob patterns (e.g., 'node_modules', '*.log') to exclude from the search.")
});

// Convert Zod schema to JSON schema
const SearchFilesJsonSchema = zodToJsonSchema(SearchFilesArgsSchema);

export const searchFilesTool: ToolDefinition = {
    name: "search_filesystem", // Renamed slightly
    description:
      "Recursively search for files and directories within the workspace filesystem matching a pattern in their name. " +
      "Searches through all subdirectories from the starting path. The search " +
      "is case-insensitive and matches partial names. Returns full paths (relative to workspace) to all " +
      "matching items. Supports excluding paths using glob patterns.",
    inputSchema: SearchFilesJsonSchema as any, // Cast as any if needed

    // Minimal buildPrompt as execution logic is separate
    buildPrompt: (args: any, modelId: string) => {
        const parsed = SearchFilesArgsSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for search_filesystem: ${parsed.error}`);
        }
        return {
            systemInstructionText: "",
            userQueryText: "",
            useWebSearch: false,
            enableFunctionCalling: false
        };
    },
    // No 'execute' function here
};