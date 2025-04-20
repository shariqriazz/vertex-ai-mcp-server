#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { Content } from "@google-cloud/vertexai";

import { getVertexAIConfig } from './config.js';
// import { functionCallingTool } from './server_functions.js'; // Removed as function calling is no longer used
import { callVertexAIWithOptionalFunctionCalling } from './vertex_ai_client.js';
import { allTools, toolMap } from './tools/index.js';
import { buildInitialContent, getToolsForApi } from './tools/tool_definition.js';

// --- MCP Server Setup ---
const server = new Server(
  { name: "vertex-ai-mcp-server", version: "0.5.0" }, // Incremented version for modularization
  { capabilities: { tools: {} } }
);

// --- Tool Definitions Handler ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Return the list of tools imported from the tools directory
  return {
      tools: allTools.map(t => ({
          name: t.name,
          description: t.description.replace("${modelId}", getVertexAIConfig().modelId), // Inject model ID dynamically
          inputSchema: t.inputSchema
      }))
  };
});

// --- Tool Call Handler ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments ?? {};

  const toolDefinition = toolMap.get(toolName);
  if (!toolDefinition) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
  }

  // Get configuration for this specific call
  const config = getVertexAIConfig();

  try {
    // Build the prompt using the tool's specific logic
    const { systemInstructionText, userQueryText, useWebSearch, enableFunctionCalling } = toolDefinition.buildPrompt(args, config.modelId);

    // Construct the initial history/prompt
    const initialContents: Content[] = buildInitialContent(systemInstructionText, userQueryText);

    // Determine tools for API: Web search or none
    const toolsForApi = getToolsForApi(enableFunctionCalling, useWebSearch); // Removed functionCallingTool argument

    // Call the Vertex AI client
    const responseText = await callVertexAIWithOptionalFunctionCalling(
        initialContents,
        toolsForApi,
        config.modelId,
        config.temperature,
        config.useStreaming,
        config.maxOutputTokens,
        config.maxRetries,
        config.retryDelayMs
    );

    // Return the successful response
    return {
      content: [{ type: "text", text: responseText }],
    };

  } catch (error) {
    if (error instanceof McpError) {
      // Re-throw known MCP errors
      throw error;
    } else {
      // Wrap unexpected errors
      console.error(`[${new Date().toISOString()}] Unexpected error in tool handler (${toolName}):`, error);
      throw new McpError(ErrorCode.InternalError, `Unexpected server error: ${(error as Error).message || "Unknown"}`);
    }
  }
});

// --- Server Start ---
async function main() {
  const transport = new StdioServerTransport();
  console.error(`[${new Date().toISOString()}] vertex-ai-mcp-server connecting via stdio...`);
  await server.connect(transport);
  console.error(`[${new Date().toISOString()}] vertex-ai-mcp-server connected.`);
}

main().catch((error) => {
  console.error(`[${new Date().toISOString()}] Server failed to start:`, error);
  process.exit(1);
});

// --- Graceful Shutdown ---
const shutdown = async (signal: string) => {
    console.error(`[${new Date().toISOString()}] Received ${signal}. Shutting down server...`);
    try {
      await server.close();
      console.error(`[${new Date().toISOString()}] Server shut down gracefully.`);
      process.exit(0);
    } catch (shutdownError) {
      console.error(`[${new Date().toISOString()}] Error during server shutdown:`, shutdownError);
      process.exit(1);
    }
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
