import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition (adapted from example.ts) - Exported
// Schema for a single file write operation
const SingleWriteOperationSchema = z.object({
  path: z.string().describe("The path of the file to write (relative to the workspace directory)."),
  content: z.string().describe("The full content to write to the file."),
});

// Schema for the arguments object, containing either a single write or an array of writes
export const WriteFileArgsSchema = z.object({
    writes: z.union([
        SingleWriteOperationSchema.describe("A single file write operation."),
        z.array(SingleWriteOperationSchema).min(1).describe("An array of file write operations.")
    ]).describe("A single write operation or an array of write operations.")
});


// Convert Zod schema to JSON schema
const WriteFileJsonSchema = zodToJsonSchema(WriteFileArgsSchema);

export const writeFileTool: ToolDefinition = {
    name: "write_file_content", // Keep name consistent
    description:
      "Create new files or completely overwrite existing files in the workspace filesystem. " +
      "The 'writes' argument should be either a single object with 'path' and 'content', or an array of such objects to write multiple files. " +
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