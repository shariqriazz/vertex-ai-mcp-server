import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition (adapted from example.ts) - Exported
export const DirectoryTreeArgsSchema = z.object({
  path: z.string().describe("The root path for the directory tree (relative to the workspace directory)."),
});

// Convert Zod schema to JSON schema
const DirectoryTreeJsonSchema = zodToJsonSchema(DirectoryTreeArgsSchema);

export const directoryTreeTool: ToolDefinition = {
    name: "get_directory_tree", // Renamed slightly
    description:
      "Get a recursive tree view of files and directories within the workspace filesystem as a JSON structure. " +
      "Each entry includes 'name', 'type' (file/directory), and 'children' (an array) for directories. " +
      "Files have no 'children' array. The output is formatted JSON text. " +
      "Useful for understanding the complete structure of a project directory.",
    inputSchema: DirectoryTreeJsonSchema as any, // Cast as any if needed

    // Minimal buildPrompt as execution logic is separate
    buildPrompt: (args: any, modelId: string) => {
        const parsed = DirectoryTreeArgsSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for get_directory_tree: ${parsed.error}`);
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