import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition (adapted from example.ts) - Exported
export const ReadMultipleFilesArgsSchema = z.object({
  paths: z.array(z.string()).describe("An array of file paths to read (relative to the workspace directory)."),
});

// Convert Zod schema to JSON schema
const ReadMultipleFilesJsonSchema = zodToJsonSchema(ReadMultipleFilesArgsSchema);

export const readMultipleFilesTool: ToolDefinition = {
    name: "read_multiple_files_content", // Renamed slightly
    description:
      "Read the contents of multiple files simultaneously from the workspace filesystem. " +
      "This is more efficient than reading files one by one when you need to analyze " +
      "or compare multiple files. Each file's content is returned with its " +
      "path as a reference. Failed reads for individual files won't stop " +
      "the entire operation.",
    inputSchema: ReadMultipleFilesJsonSchema as any, // Cast as any if needed

    // Minimal buildPrompt as execution logic is separate
    buildPrompt: (args: any, modelId: string) => {
        const parsed = ReadMultipleFilesArgsSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for read_multiple_files_content: ${parsed.error}`);
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