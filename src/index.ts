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
import fs from "fs/promises";
import path from "path";
import { z } from "zod"; // Needed for schema parsing within handler
import { diffLines, createTwoFilesPatch } from 'diff';
import { minimatch } from 'minimatch';

import { getVertexAIConfig } from './config.js';
import { callVertexAIWithOptionalFunctionCalling } from './vertex_ai_client.js';
import { allTools, toolMap } from './tools/index.js';
import { buildInitialContent, getToolsForApi } from './tools/tool_definition.js';

// Import Zod schemas from tool files for validation within the handler
import { ReadFileArgsSchema } from './tools/read_file.js';
import { ReadMultipleFilesArgsSchema } from './tools/read_multiple_files.js';
import { WriteFileArgsSchema } from './tools/write_file.js';
import { EditFileArgsSchema, EditOperationSchema } from './tools/edit_file.js'; // Import EditOperationSchema too
import { CreateDirectoryArgsSchema } from './tools/create_directory.js';
import { ListDirectoryArgsSchema } from './tools/list_directory.js';
import { DirectoryTreeArgsSchema } from './tools/directory_tree.js';
import { MoveFileArgsSchema } from './tools/move_file.js';
import { SearchFilesArgsSchema } from './tools/search_files.js';
import { GetFileInfoArgsSchema } from './tools/get_file_info.js';
// Import schemas for the new combined tools
import { SaveGenerateProjectGuidelinesArgsSchema } from './tools/save_generate_project_guidelines.js';
import { SaveDocSnippetArgsSchema } from './tools/save_doc_snippet.js';
import { SaveTopicExplanationArgsSchema } from './tools/save_topic_explanation.js';
// Removed old schema, added new specific ones
import { SaveAnswerQueryDirectArgsSchema } from './tools/save_answer_query_direct.js';
import { SaveAnswerQueryWebsearchArgsSchema } from './tools/save_answer_query_websearch.js';


// --- Filesystem Helper Functions (Adapted from example.ts) ---

// Basic security check - ensure path stays within workspace
// IMPORTANT: Relies on the execution environment (e.g., Docker, VM) for robust sandboxing.
function validateWorkspacePath(requestedPath: string): string {
    const absolutePath = path.resolve(process.cwd(), requestedPath);
    if (!absolutePath.startsWith(process.cwd())) {
        throw new Error(`Path traversal attempt detected: ${requestedPath}`);
    }
    // In a real scenario, you might add more checks (symlinks, allowed patterns, etc.)
    // but for this integration, we rely on the workspace boundary.
    return absolutePath;
}

interface FileInfo {
  size: number;
  created: Date;
  modified: Date;
  accessed: Date;
  isDirectory: boolean;
  isFile: boolean;
  permissions: string;
}

async function getFileStats(filePath: string): Promise<FileInfo> {
  const stats = await fs.stat(filePath);
  return {
    size: stats.size,
    created: stats.birthtime,
    modified: stats.mtime,
    accessed: stats.atime,
    isDirectory: stats.isDirectory(),
    isFile: stats.isFile(),
    permissions: stats.mode.toString(8).slice(-3), // POSIX permissions
  };
}

async function searchFilesRecursive(
  rootPath: string, // Assumed to be validated absolute path
  currentPath: string, // Current absolute path being searched
  pattern: string,
  excludePatterns: string[],
  results: string[]
): Promise<void> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath); // Relative to initial search root

    // Check exclude patterns first
    const shouldExclude = excludePatterns.some(p => minimatch(relativePath, p, { dot: true, matchBase: true }));
    if (shouldExclude) {
      continue;
    }

    // Check if name matches pattern (case-insensitive)
    if (entry.name.toLowerCase().includes(pattern.toLowerCase())) {
      results.push(path.relative(process.cwd(), fullPath)); // Return path relative to workspace
    }

    // Recurse into directories
    if (entry.isDirectory()) {
      // Basic check to prevent infinite loops with symlinks, though validateWorkspacePath should handle main security
      try {
          const realPath = await fs.realpath(fullPath);
          if (realPath.startsWith(rootPath)) { // Ensure recursion stays within root
             await searchFilesRecursive(rootPath, fullPath, pattern, excludePatterns, results);
          }
      } catch (e) {
          // Ignore errors reading directories (e.g. permission denied) during search
          console.error(`Skipping search in ${fullPath}: ${(e as Error).message}`);
      }
    }
  }
}

// file editing and diffing utilities (from example.ts)
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

function createUnifiedDiff(originalContent: string, newContent: string, filepath: string = 'file'): string {
  const normalizedOriginal = normalizeLineEndings(originalContent);
  const normalizedNew = normalizeLineEndings(newContent);
  return createTwoFilesPatch(
    filepath, filepath, normalizedOriginal, normalizedNew, 'original', 'modified'
  );
}

async function applyFileEdits(
  filePath: string, // Assumed to be validated absolute path
  edits: z.infer<typeof EditOperationSchema>[],
  dryRun = false
): Promise<string> { // Returns the diff string
  const content = normalizeLineEndings(await fs.readFile(filePath, 'utf-8'));
  let modifiedContent = content;

  for (const edit of edits) {
    const normalizedOld = normalizeLineEndings(edit.oldText);
    const normalizedNew = normalizeLineEndings(edit.newText);

    if (modifiedContent.includes(normalizedOld)) {
      modifiedContent = modifiedContent.replace(normalizedOld, normalizedNew);
      continue;
    }

    const oldLines = normalizedOld.split('\n');
    const contentLines = modifiedContent.split('\n');
    let matchFound = false;

    for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
      const potentialMatch = contentLines.slice(i, i + oldLines.length);
      const isMatch = oldLines.every((oldLine, j) => oldLine.trim() === potentialMatch[j].trim());

      if (isMatch) {
        const originalIndent = contentLines[i].match(/^\s*/)?.[0] || '';
        const newLines = normalizedNew.split('\n').map((line, j) => {
          if (j === 0) return originalIndent + line.trimStart();
          const oldIndent = oldLines[j]?.match(/^\s*/)?.[0] || '';
          const newIndent = line.match(/^\s*/)?.[0] || '';
          if (oldIndent && newIndent) {
            const relativeIndent = newIndent.length - oldIndent.length;
            return originalIndent + ' '.repeat(Math.max(0, relativeIndent)) + line.trimStart();
          }
          return line; // Keep original indentation if old line had none or new line has none
        });

        contentLines.splice(i, oldLines.length, ...newLines);
        modifiedContent = contentLines.join('\n');
        matchFound = true;
        break;
      }
    }

    if (!matchFound) {
      throw new Error(`Could not find exact or whitespace-insensitive match for edit:\n${edit.oldText}`);
    }
  }

  const diff = createUnifiedDiff(content, modifiedContent, path.relative(process.cwd(), filePath));

  if (!dryRun) {
    await fs.writeFile(filePath, modifiedContent, 'utf-8');
  }

  // Format diff for display
  let numBackticks = 3;
  while (diff.includes('`'.repeat(numBackticks))) {
    numBackticks++;
  }
  return `${'`'.repeat(numBackticks)}diff\n${diff}\n${'`'.repeat(numBackticks)}`;
}


interface TreeEntry {
    name: string;
    type: 'file' | 'directory';
    children?: TreeEntry[];
}

async function buildDirectoryTree(currentPath: string): Promise<TreeEntry[]> { // Takes validated absolute path
    const entries = await fs.readdir(currentPath, {withFileTypes: true});
    const result: TreeEntry[] = [];

    for (const entry of entries) {
        const entryData: TreeEntry = {
            name: entry.name,
            type: entry.isDirectory() ? 'directory' : 'file'
        };

        if (entry.isDirectory()) {
            const subPath = path.join(currentPath, entry.name);
             // Basic check to prevent infinite loops with symlinks
            try {
                const realPath = await fs.realpath(subPath);
                if (realPath.startsWith(path.dirname(currentPath))) { // Ensure recursion stays within parent boundary
                    entryData.children = await buildDirectoryTree(subPath);
                } else {
                     entryData.children = []; // Avoid following symlinks outside tree
                }
            } catch (e) {
                 entryData.children = []; // Handle errors reading subdirs
                 console.error(`Skipping tree build in ${subPath}: ${(e as Error).message}`);
            }
        }
        result.push(entryData);
    }
    // Sort entries: directories first, then files, alphabetically
    result.sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.name.localeCompare(b.name);
    });
    return result;
}


// Set of filesystem tool names for easy checking
const filesystemToolNames = new Set([
    "read_file_content",
    "read_multiple_files_content",
    "write_file_content",
    "edit_file_content",
    "create_directory",
    "list_directory_contents",
    "get_directory_tree",
    "move_file_or_directory",
    "search_filesystem",
    "get_filesystem_info",
]);


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

  // Validate tool exists (applies to all tools)
  const toolDefinition = toolMap.get(toolName);
  if (!toolDefinition) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
  }

  try {
    // --- Special Handling for Combined Tool ---
    if (toolName === "save_generate_project_guidelines") {
        // 1. Parse combined args
        const parsedArgs = SaveGenerateProjectGuidelinesArgsSchema.parse(args);
        const { tech_stack, output_path } = parsedArgs;

        // 2. Build the prompt using the tool's logic
        const config = getVertexAIConfig(); // Get config needed for prompt building
        const { systemInstructionText, userQueryText, useWebSearch, enableFunctionCalling } = toolDefinition.buildPrompt(args, config.modelId);

        // 3. Call Vertex AI (similar to the 'else' block below, but using prompt components)
        const initialContents: Content[] = buildInitialContent(systemInstructionText, userQueryText);
        const toolsForApi = getToolsForApi(enableFunctionCalling, useWebSearch);

        const generatedContent = await callVertexAIWithOptionalFunctionCalling(
            initialContents,
            toolsForApi,
            config.modelId,
            config.temperature,
            config.useStreaming,
            config.maxOutputTokens,
            config.maxRetries,
            config.retryDelayMs
        );

        // 4. Validate output path
        const validOutputPath = validateWorkspacePath(output_path);

        // 5. Ensure parent directory exists
        await fs.mkdir(path.dirname(validOutputPath), { recursive: true });

        // 6. Write the generated content to the file
        await fs.writeFile(validOutputPath, generatedContent, "utf-8");

        // 7. Return success message
        return {
            content: [{ type: "text", text: `Successfully generated guidelines and saved to ${output_path}` }],
        };

    } else if (toolName === "save_doc_snippet") { // Added case for save_doc_snippet
        // 1. Parse combined args
        const parsedArgs = SaveDocSnippetArgsSchema.parse(args);
        const { output_path } = parsedArgs; // Other args used in buildPrompt

        // 2. Build the prompt using the tool's logic
        const config = getVertexAIConfig();
        const { systemInstructionText, userQueryText, useWebSearch, enableFunctionCalling } = toolDefinition.buildPrompt(args, config.modelId);

        // 3. Call Vertex AI
        const initialContents: Content[] = buildInitialContent(systemInstructionText, userQueryText);
        const toolsForApi = getToolsForApi(enableFunctionCalling, useWebSearch);

        const generatedContent = await callVertexAIWithOptionalFunctionCalling(
            initialContents,
            toolsForApi,
            config.modelId,
            config.temperature,
            config.useStreaming,
            config.maxOutputTokens,
            config.maxRetries,
            config.retryDelayMs
        );

        // 4. Validate output path
        const validOutputPath = validateWorkspacePath(output_path);

        // 5. Ensure parent directory exists
        await fs.mkdir(path.dirname(validOutputPath), { recursive: true });

        // 6. Write the generated content to the file
        await fs.writeFile(validOutputPath, generatedContent, "utf-8");

        // 7. Return success message
        return {
            content: [{ type: "text", text: `Successfully generated snippet and saved to ${output_path}` }],
        };

    } else if (toolName === "save_topic_explanation") { // Added case for save_topic_explanation
        // 1. Parse combined args
        const parsedArgs = SaveTopicExplanationArgsSchema.parse(args);
        const { output_path } = parsedArgs; // topic, query used in buildPrompt

        // 2. Build the prompt using the tool's logic
        const config = getVertexAIConfig();
        const { systemInstructionText, userQueryText, useWebSearch, enableFunctionCalling } = toolDefinition.buildPrompt(args, config.modelId);

        // 3. Call Vertex AI
        const initialContents: Content[] = buildInitialContent(systemInstructionText, userQueryText);
        const toolsForApi = getToolsForApi(enableFunctionCalling, useWebSearch);

        const generatedContent = await callVertexAIWithOptionalFunctionCalling(
            initialContents,
            toolsForApi,
            config.modelId,
            config.temperature,
            config.useStreaming,
            config.maxOutputTokens,
            config.maxRetries,
            config.retryDelayMs
        );

        // 4. Validate output path
        const validOutputPath = validateWorkspacePath(output_path);

        // 5. Ensure parent directory exists
        await fs.mkdir(path.dirname(validOutputPath), { recursive: true });

        // 6. Write the generated content to the file
        await fs.writeFile(validOutputPath, generatedContent, "utf-8");

        // 7. Return success message
        return {
            content: [{ type: "text", text: `Successfully generated explanation and saved to ${output_path}` }],
        };

    } else if (toolName === "save_answer_query_direct") { // Added case for save_answer_query_direct
        // 1. Parse args
        const parsedArgs = SaveAnswerQueryDirectArgsSchema.parse(args);
        const { output_path } = parsedArgs; // query used in buildPrompt

        // 2. Build the prompt using the tool's logic
        const config = getVertexAIConfig();
        const { systemInstructionText, userQueryText, useWebSearch, enableFunctionCalling } = toolDefinition.buildPrompt(args, config.modelId); // useWebSearch will be false

        // 3. Call Vertex AI
        const initialContents: Content[] = buildInitialContent(systemInstructionText, userQueryText);
        const toolsForApi = getToolsForApi(enableFunctionCalling, useWebSearch);

        const generatedContent = await callVertexAIWithOptionalFunctionCalling(
            initialContents,
            toolsForApi,
            config.modelId,
            config.temperature,
            config.useStreaming,
            config.maxOutputTokens,
            config.maxRetries,
            config.retryDelayMs
        );

        // 4. Validate output path
        const validOutputPath = validateWorkspacePath(output_path);

        // 5. Ensure parent directory exists
        await fs.mkdir(path.dirname(validOutputPath), { recursive: true });

        // 6. Write the generated content to the file
        await fs.writeFile(validOutputPath, generatedContent, "utf-8");

        // 7. Return success message
        return {
            content: [{ type: "text", text: `Successfully generated direct answer and saved to ${output_path}` }],
        };

    } else if (toolName === "save_answer_query_websearch") { // Added case for save_answer_query_websearch
        // 1. Parse args
        const parsedArgs = SaveAnswerQueryWebsearchArgsSchema.parse(args);
        const { output_path } = parsedArgs; // query used in buildPrompt

        // 2. Build the prompt using the tool's logic
        const config = getVertexAIConfig();
        const { systemInstructionText, userQueryText, useWebSearch, enableFunctionCalling } = toolDefinition.buildPrompt(args, config.modelId); // useWebSearch will be true

        // 3. Call Vertex AI
        const initialContents: Content[] = buildInitialContent(systemInstructionText, userQueryText);
        const toolsForApi = getToolsForApi(enableFunctionCalling, useWebSearch);

        const generatedContent = await callVertexAIWithOptionalFunctionCalling(
            initialContents,
            toolsForApi,
            config.modelId,
            config.temperature,
            config.useStreaming,
            config.maxOutputTokens,
            config.maxRetries,
            config.retryDelayMs
        );

        // 4. Validate output path
        const validOutputPath = validateWorkspacePath(output_path);

        // 5. Ensure parent directory exists
        await fs.mkdir(path.dirname(validOutputPath), { recursive: true });

        // 6. Write the generated content to the file
        await fs.writeFile(validOutputPath, generatedContent, "utf-8");

        // 7. Return success message
        return {
            content: [{ type: "text", text: `Successfully generated websearch answer and saved to ${output_path}` }],
        };

    } // --- Filesystem Tool Execution Logic ---
    else if (filesystemToolNames.has(toolName)) {
      let resultText = ""; // To store success messages or data

      switch (toolName) {
        case "read_file_content": {
          const parsed = ReadFileArgsSchema.parse(args); // Use parse, throws on error
          const validPath = validateWorkspacePath(parsed.path);
          const content = await fs.readFile(validPath, "utf-8");
          resultText = content;
          break;
        }
        case "read_multiple_files_content": {
          const parsed = ReadMultipleFilesArgsSchema.parse(args);
          const results = await Promise.all(
            parsed.paths.map(async (filePath: string) => {
              try {
                const validPath = validateWorkspacePath(filePath);
                const content = await fs.readFile(validPath, "utf-8");
                // Return relative path for clarity
                return `${path.relative(process.cwd(), validPath)}:\n${content}\n`;
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return `${filePath}: Error - ${errorMessage}`;
              }
            }),
          );
          resultText = results.join("\n---\n");
          break;
        }
        case "write_file_content": {
          const parsed = WriteFileArgsSchema.parse(args);
          const validPath = validateWorkspacePath(parsed.path);
          // Ensure parent directory exists before writing
          await fs.mkdir(path.dirname(validPath), { recursive: true });
          await fs.writeFile(validPath, parsed.content, "utf-8");
          resultText = `Successfully wrote to ${parsed.path}`;
          break;
        }
        case "edit_file_content": {
          const parsed = EditFileArgsSchema.parse(args);
          if (parsed.edits.length === 0) {
             throw new McpError(ErrorCode.InvalidParams, `'edits' array cannot be empty for ${toolName}.`);
          }
          const validPath = validateWorkspacePath(parsed.path);
          resultText = await applyFileEdits(validPath, parsed.edits, parsed.dryRun);
          break;
        }
        case "create_directory": {
          const parsed = CreateDirectoryArgsSchema.parse(args);
          const validPath = validateWorkspacePath(parsed.path);
          await fs.mkdir(validPath, { recursive: true });
          resultText = `Successfully created directory ${parsed.path}`;
          break;
        }
        case "list_directory_contents": {
          const parsed = ListDirectoryArgsSchema.parse(args);
          const validPath = validateWorkspacePath(parsed.path);
          const entries = await fs.readdir(validPath, { withFileTypes: true });
          resultText = entries
            .map((entry) => `${entry.isDirectory() ? "[DIR] " : "[FILE]"} ${entry.name}`)
            .sort() // Sort alphabetically
            .join("\n");
           if (!resultText) resultText = "(Directory is empty)";
          break;
        }
        case "get_directory_tree": {
            const parsed = DirectoryTreeArgsSchema.parse(args);
            const validPath = validateWorkspacePath(parsed.path);
            const treeData = await buildDirectoryTree(validPath);
            resultText = JSON.stringify(treeData, null, 2); // Pretty print JSON
            break;
        }
        case "move_file_or_directory": {
          const parsed = MoveFileArgsSchema.parse(args);
           if (parsed.source === parsed.destination) {
             throw new McpError(ErrorCode.InvalidParams, `Source and destination paths cannot be the same for ${toolName}.`);
           }
          const validSourcePath = validateWorkspacePath(parsed.source);
          const validDestPath = validateWorkspacePath(parsed.destination);
           // Ensure parent directory of destination exists
          await fs.mkdir(path.dirname(validDestPath), { recursive: true });
          await fs.rename(validSourcePath, validDestPath);
          resultText = `Successfully moved ${parsed.source} to ${parsed.destination}`;
          break;
        }
        case "search_filesystem": {
          const parsed = SearchFilesArgsSchema.parse(args);
          const validPath = validateWorkspacePath(parsed.path);
          const results: string[] = [];
          await searchFilesRecursive(validPath, validPath, parsed.pattern, parsed.excludePatterns, results);
          resultText = results.length > 0 ? results.join("\n") : "No matches found";
          break;
        }
        case "get_filesystem_info": {
          const parsed = GetFileInfoArgsSchema.parse(args);
          const validPath = validateWorkspacePath(parsed.path);
          const info = await getFileStats(validPath);
          // Format output for better readability
          resultText = `Path: ${parsed.path}\nType: ${info.isDirectory ? 'Directory' : 'File'}\nSize: ${info.size} bytes\nCreated: ${info.created.toISOString()}\nModified: ${info.modified.toISOString()}\nAccessed: ${info.accessed.toISOString()}\nPermissions: ${info.permissions}`;
          break;
        }
        default:
          // This case should technically not be reachable due to filesystemToolNames check
          throw new McpError(ErrorCode.MethodNotFound, `Filesystem tool handler not implemented: ${toolName}`);
      }

      // Return successful filesystem operation result
      return {
        content: [{ type: "text", text: resultText }],
      };

    } else {
      // --- Existing Vertex AI Tool Logic ---
      const config = getVertexAIConfig();
      const { systemInstructionText, userQueryText, useWebSearch, enableFunctionCalling } = toolDefinition.buildPrompt(args, config.modelId);
      const initialContents: Content[] = buildInitialContent(systemInstructionText, userQueryText);
      const toolsForApi = getToolsForApi(enableFunctionCalling, useWebSearch);

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

      return {
        content: [{ type: "text", text: responseText }],
      };
    }

  } catch (error) {
     // Centralized error handling
    if (error instanceof z.ZodError) {
        // Handle Zod validation errors specifically
        throw new McpError(ErrorCode.InvalidParams, `Invalid arguments for ${toolName}: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
    } else if (error instanceof McpError) {
      // Re-throw known MCP errors
      throw error;
    } else if (error instanceof Error && error.message.includes('ENOENT')) {
        // Handle file/dir not found errors more gracefully
         throw new McpError(ErrorCode.InvalidParams, `Path not found for tool ${toolName}: ${error.message}`);
    } else {
      // Wrap other unexpected errors
      console.error(`[${new Date().toISOString()}] Unexpected error in tool handler (${toolName}):`, error);
      throw new McpError(ErrorCode.InternalError, `Unexpected server error during ${toolName}: ${(error as Error).message || "Unknown"}`);
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
