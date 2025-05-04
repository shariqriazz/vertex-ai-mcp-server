import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition } from "./tool_definition.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Schema definition
export const ExecuteTerminalCommandArgsSchema = z.object({
  command: z.string().describe("The command line instruction to execute."),
  cwd: z.string().optional().describe("Optional. The working directory to run the command in (relative to the workspace root). Defaults to the workspace root if not specified."),
  timeout: z.number().int().positive().optional().describe("Optional. Maximum execution time in seconds. If the command exceeds this time, it will be terminated."),
});

// Convert Zod schema to JSON schema
const ExecuteTerminalCommandJsonSchema = zodToJsonSchema(ExecuteTerminalCommandArgsSchema);

export const executeTerminalCommandTool: ToolDefinition = {
    name: "execute_terminal_command", // Renamed
    description:
      "Execute a shell command on the server's operating system. " +
      "Allows specifying the command, an optional working directory (cwd), and an optional timeout in seconds. " +
      "Returns the combined stdout and stderr output of the command upon completion or termination.",
    inputSchema: ExecuteTerminalCommandJsonSchema as any,

    // Minimal buildPrompt as execution logic is separate
    buildPrompt: (args: any, modelId: string) => {
        const parsed = ExecuteTerminalCommandArgsSchema.safeParse(args);
        if (!parsed.success) {
            throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for execute_terminal_command: ${parsed.error}`);
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