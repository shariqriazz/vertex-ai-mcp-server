import { ToolDefinition } from "./tool_definition.js";
import { answerQueryWebsearchTool } from "./answer_query_websearch.js";
import { answerQueryDirectTool } from "./answer_query_direct.js";
import { answerDocQueryTool } from "./answer_doc_query.js";
export const allTools: ToolDefinition[] = [
    // Query Tools
    answerQueryWebsearchTool,
    answerQueryDirectTool,
    answerDocQueryTool,
];

// Create a map for easy lookup
export const toolMap = new Map<string, ToolDefinition>(
    allTools.map(tool => [tool.name, tool])
);