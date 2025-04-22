import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition (adapted from example.ts) - Exported
export const ListDirectoryArgsSchema = z.object({
  path: z.string().describe("The path of the directory to list (relative to the workspace directory)."),
});

// Convert Zod schema to JSON schema
const ListDirectoryJsonSchema = zodToJsonSchema(ListDirectoryArgsSchema);

export const listDirectoryTool: ToolDefinition = {
    name: "list_directory_contents", // Renamed slightly
    description:
      "Get a detailed listing of all files and directories directly within a specified path in the workspace filesystem. " +
      "Results clearly distinguish between files and directories with [FILE] and [DIR] " +
      "prefixes. This tool is essential for understanding directory structure and " +
      "finding specific files within a directory. Does not list recursively.",
    inputSchema: ListDirectoryJsonSchema as any, // Cast as any if needed

    // Minimal buildPrompt as execution logic is separate
    buildPrompt: (args: any, modelId: string) => {
        const parsed = ListDirectoryArgsSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for list_directory_contents: ${parsed.error}`);
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