import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
// Note: We don't need fs, path here as execution logic is moved
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition (adapted from example.ts) - Exported
export const ReadFileArgsSchema = z.object({
  path: z.string().describe("The path of the file to read (relative to the workspace directory)."),
});

// Infer the input type for validation, though it's not strictly needed
// if validation happens only during execution in index.ts
type ReadFileInput = z.infer<typeof ReadFileArgsSchema>;

// Convert Zod schema to JSON schema for the tool definition
const ReadFileJsonSchema = zodToJsonSchema(ReadFileArgsSchema);

export const readFileTool: ToolDefinition = {
    name: "read_file_content", // Renamed slightly
    description:
      "Read the complete contents of a file from the workspace filesystem. " +
      "Handles various text encodings and provides detailed error messages " +
      "if the file cannot be read. Use this tool when you need to examine " +
      "the contents of a single file within the workspace.",
    // Use the converted JSON schema
    inputSchema: ReadFileJsonSchema as any, // Cast as any to fit ToolDefinition if needed, or adjust ToolDefinition type

    // This tool doesn't directly use the LLM, so buildPrompt is minimal/not used for execution
    buildPrompt: (args: any, modelId: string) => {
        // Basic validation can still happen here if desired, but execution is separate
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