import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
// Note: We don't need fs, path here as execution logic is moved
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition (adapted from example.ts) - Exported
export const ReadFileArgsSchema = z.object({
  paths: z.union([
      z.string().describe("The path of the file to read (relative to the workspace directory)."),
      z.array(z.string()).min(1).describe("An array of file paths to read (relative to the workspace directory).")
  ]).describe("A single file path or an array of file paths to read."),
});

// Infer the input type for validation
type ReadFileInput = z.infer<typeof ReadFileArgsSchema>;

// Convert Zod schema to JSON schema for the tool definition
const ReadFileJsonSchema = zodToJsonSchema(ReadFileArgsSchema);

export const readFileTool: ToolDefinition = {
    name: "read_file_content", // Keep the name consistent
    description:
      "Read the complete contents of one or more files from the workspace filesystem. " +
      "Provide a single path string or an array of path strings. " +
      "Handles various text encodings and provides detailed error messages " +
      "if a file cannot be read. Failed reads for individual files in an array " +
      "won't stop the entire operation when multiple paths are provided.",
    // Use the converted JSON schema
    inputSchema: ReadFileJsonSchema as any, // Cast as any to fit ToolDefinition if needed

    // This tool doesn't directly use the LLM, so buildPrompt is minimal/not used for execution
    buildPrompt: (args: any, modelId: string) => {
        // Basic validation
        const parsed = ReadFileArgsSchema.safeParse(args);
        if (!parsed.success) {
            // Use InternalError or InvalidParams
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for read_file_content: ${parsed.error}`);
        }
        // No prompt generation needed for direct execution logic
        return {
            systemInstructionText: "", // Not applicable
            userQueryText: "", // Not applicable
            useWebSearch: false,
            enableFunctionCalling: false
        };
    },
    // Removed the 'execute' function - this logic will go into src/index.ts
};