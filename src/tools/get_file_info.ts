import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition (adapted from example.ts) - Exported
export const GetFileInfoArgsSchema = z.object({
  path: z.string().describe("The path of the file or directory to get info for (relative to the workspace directory)."),
});

// Convert Zod schema to JSON schema
const GetFileInfoJsonSchema = zodToJsonSchema(GetFileInfoArgsSchema);

export const getFileInfoTool: ToolDefinition = {
    name: "get_filesystem_info", // Renamed slightly
    description:
      "Retrieve detailed metadata about a file or directory within the workspace filesystem. " +
      "Returns comprehensive information including size (bytes), creation time, last modified time, " +
      "last accessed time, type (file/directory), and permissions (octal string). " +
      "This tool is perfect for understanding file characteristics without reading the actual content.",
    inputSchema: GetFileInfoJsonSchema as any, // Cast as any if needed

    // Minimal buildPrompt as execution logic is separate
    buildPrompt: (args: any, modelId: string) => {
        const parsed = GetFileInfoArgsSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for get_filesystem_info: ${parsed.error}`);
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