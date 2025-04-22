import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition (adapted from example.ts) - Exported
export const WriteFileArgsSchema = z.object({
  path: z.string().describe("The path of the file to write (relative to the workspace directory)."),
  content: z.string().describe("The full content to write to the file."),
});

// Convert Zod schema to JSON schema
const WriteFileJsonSchema = zodToJsonSchema(WriteFileArgsSchema);

export const writeFileTool: ToolDefinition = {
    name: "write_file_content", // Renamed slightly
    description:
      "Create a new file or completely overwrite an existing file in the workspace filesystem with new content. " +
      "Use with caution as it will overwrite existing files without warning. " +
      "Handles text content with proper encoding.",
    inputSchema: WriteFileJsonSchema as any, // Cast as any if needed

    // Minimal buildPrompt as execution logic is separate
    buildPrompt: (args: any, modelId: string) => {
        const parsed = WriteFileArgsSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for write_file_content: ${parsed.error}`);
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