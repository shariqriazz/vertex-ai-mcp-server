import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { Content, Tool } from "@google-cloud/vertexai";

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: any; // Consider defining a stricter type like JSONSchema7
    buildPrompt: (args: any, modelId: string) => {
        systemInstructionText: string;
        userQueryText: string;
        useWebSearch: boolean;
        enableFunctionCalling: boolean;
    };
}

export const modelIdPlaceholder = "${modelId}"; // Placeholder for dynamic model ID in descriptions

// Helper to build the initial content array
export function buildInitialContent(systemInstruction: string, userQuery: string): Content[] {
    return [{ role: "user", parts: [{ text: `${systemInstruction}\n\n${userQuery}` }] }];
}

// Helper to determine tools for API call
export function getToolsForApi(enableFunctionCalling: boolean, useWebSearch: boolean): Tool[] | undefined {
     // Function calling is no longer supported by the remaining tools
     return useWebSearch ? [{ googleSearch: {} } as any] : undefined; // Cast needed as SDK type might not include googleSearch directly
}