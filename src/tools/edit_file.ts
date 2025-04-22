import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definitions (adapted from example.ts) - Exported
export const EditOperationSchema = z.object({
  oldText: z.string().describe('Text to search for - attempts exact match first, then line-by-line whitespace-insensitive match.'),
  newText: z.string().describe('Text to replace with, preserving indentation where possible.')
});

export const EditFileArgsSchema = z.object({
  path: z.string().describe("The path of the file to edit (relative to the workspace directory)."),
  edits: z.array(EditOperationSchema).describe("An array of edit operations to apply sequentially."),
  dryRun: z.boolean().optional().default(false).describe('If true, preview changes using git-style diff format without saving.')
});

// Convert Zod schema to JSON schema
const EditFileJsonSchema = zodToJsonSchema(EditFileArgsSchema);

export const editFileTool: ToolDefinition = {
    name: "edit_file_content", // Renamed slightly
    description:
      "Make line-based edits to a text file in the workspace filesystem. Each edit attempts to replace " +
      "an exact match of 'oldText' with 'newText'. If no exact match is found, it attempts a " +
      "line-by-line match ignoring leading/trailing whitespace. Indentation of the first line " +
      "is preserved, and relative indentation of subsequent lines is attempted. " +
      "Returns a git-style diff showing the changes made (or previewed if dryRun is true).",
    inputSchema: EditFileJsonSchema as any, // Cast as any if needed

    // Minimal buildPrompt as execution logic is separate
    buildPrompt: (args: any, modelId: string) => {
        const parsed = EditFileArgsSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for edit_file_content: ${parsed.error}`);
        }
        // Add a check for empty edits array
        if (parsed.data.edits.length === 0) {
             throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for edit_file_content: 'edits' array cannot be empty.`);
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