import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition (adapted from example.ts) - Exported
export const CreateDirectoryArgsSchema = z.object({
  path: z.string().describe("The path of the directory to create (relative to the workspace directory). Can include nested paths."),
});

// Convert Zod schema to JSON schema
const CreateDirectoryJsonSchema = zodToJsonSchema(CreateDirectoryArgsSchema);

export const createDirectoryTool: ToolDefinition = {
    name: "create_directory", // Keeping original name
    description:
      "Create a new directory or ensure a directory exists in the workspace filesystem. " +
      "Can create multiple nested directories in one operation (like mkdir -p). " +
      "If the directory already exists, this operation will succeed silently. " +
      "Perfect for setting up directory structures for projects.",
    inputSchema: CreateDirectoryJsonSchema as any, // Cast as any if needed

    // Minimal buildPrompt as execution logic is separate
    buildPrompt: (args: any, modelId: string) => {
        const parsed = CreateDirectoryArgsSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for create_directory: ${parsed.error}`);
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