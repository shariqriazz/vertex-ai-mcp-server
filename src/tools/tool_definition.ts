import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { Content, Tool } from "@google/genai";

export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: any; // Consider defining a stricter type like JSONSchema7
    buildPrompt: (args: any, modelId: string) => {
        systemInstructionText: string;
        userQueryText: string;
        useWebSearch: boolean;
        useWorkspaceSearch?: boolean;
        enableFunctionCalling: boolean;
    };
}

export const modelIdPlaceholder = "${modelId}"; // Placeholder for dynamic model ID in descriptions

// Helper to build the initial content array
export function buildInitialContent(systemInstruction: string, userQuery: string): Content[] {
    return [{ role: "user", parts: [{ text: `${systemInstruction}\n\n${userQuery}` }] }];
}

// Helper to determine tools for API call
export function getToolsForApi(
    enableFunctionCalling: boolean,
    useWebSearch: boolean,
    useWorkspaceSearch: boolean = false,
    workspaceDatastoreId?: string
): Tool[] | undefined {
     const tools: Tool[] = [];

     if (useWebSearch) {
         tools.push({ googleSearch: {} } as any);
     }

     if (useWorkspaceSearch && workspaceDatastoreId) {
         tools.push({
             retrieval: {
                 vertexAiSearch: {
                     datastore: workspaceDatastoreId
                 }
             }
         } as any);
     }

     return tools.length > 0 ? tools : undefined;
}