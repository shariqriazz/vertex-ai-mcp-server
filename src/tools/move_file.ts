import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition (adapted from example.ts) - Exported
export const MoveFileArgsSchema = z.object({
  source: z.string().describe("The current path of the file or directory to move (relative to the workspace directory)."),
  destination: z.string().describe("The new path for the file or directory (relative to the workspace directory)."),
});

// Convert Zod schema to JSON schema
const MoveFileJsonSchema = zodToJsonSchema(MoveFileArgsSchema);

export const moveFileTool: ToolDefinition = {
    name: "move_file_or_directory", // Renamed slightly
    description:
      "Move or rename files and directories within the workspace filesystem. " +
      "Can move items between directories and rename them in a single operation. " +
      "If the destination path already exists, the operation will likely fail (OS-dependent).",
    inputSchema: MoveFileJsonSchema as any, // Cast as any if needed

    // Minimal buildPrompt as execution logic is separate
    buildPrompt: (args: any, modelId: string) => {
        const parsed = MoveFileArgsSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for move_file_or_directory: ${parsed.error}`);
        }
        // Add check: source and destination cannot be the same
        if (parsed.data.source === parsed.data.destination) {
             throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for move_file_or_directory: source and destination paths cannot be the same.`);
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