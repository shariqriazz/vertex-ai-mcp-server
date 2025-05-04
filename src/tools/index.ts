import { ToolDefinition } from "./tool_definition.js";
import { answerQueryWebsearchTool } from "./answer_query_websearch.js";
import { answerQueryDirectTool } from "./answer_query_direct.js";
import { explainTopicWithDocsTool } from "./explain_topic_with_docs.js";
import { getDocSnippetsTool } from "./get_doc_snippets.js";
import { generateProjectGuidelinesTool } from "./generate_project_guidelines.js";
// Filesystem Tools (Imported)
import { readFileTool } from "./read_file.js"; // Handles single and multiple files now
// import { readMultipleFilesTool } from "./read_multiple_files.js"; // Merged into readFileTool
import { writeFileTool } from "./write_file.js";
import { editFileTool } from "./edit_file.js";
// import { createDirectoryTool } from "./create_directory.js"; // Removed
import { listDirectoryTool } from "./list_directory.js";
import { directoryTreeTool } from "./directory_tree.js";
import { moveFileTool } from "./move_file.js";
import { searchFilesTool } from "./search_files.js";
import { getFileInfoTool } from "./get_file_info.js";
import { executeTerminalCommandTool } from "./execute_terminal_command.js"; // Renamed file and tool variable
// Import the new combined tools
import { saveGenerateProjectGuidelinesTool } from "./save_generate_project_guidelines.js";
import { saveDocSnippetTool } from "./save_doc_snippet.js";
import { saveTopicExplanationTool } from "./save_topic_explanation.js";
// Removed old save_query_answer, added new specific ones
import { saveAnswerQueryDirectTool } from "./save_answer_query_direct.js";
import { saveAnswerQueryWebsearchTool } from "./save_answer_query_websearch.js";

// Import new research-oriented tools
import { codeAnalysisWithDocsTool } from "./code_analysis_with_docs.js";
import { technicalComparisonTool } from "./technical_comparison.js";
import { architecturePatternRecommendationTool } from "./architecture_pattern_recommendation.js";
import { dependencyVulnerabilityScanTool } from "./dependency_vulnerability_scan.js";
import { databaseSchemaAnalyzerTool } from "./database_schema_analyzer.js";
import { securityBestPracticesAdvisorTool } from "./security_best_practices_advisor.js";
import { testingStrategyGeneratorTool } from "./testing_strategy_generator.js";
import { regulatoryComplianceAdvisorTool } from "./regulatory_compliance_advisor.js";
import { microserviceDesignAssistantTool } from "./microservice_design_assistant.js";
import { documentationGeneratorTool } from "./documentation_generator.js";


export const allTools: ToolDefinition[] = [
    // Query & Generation Tools
    answerQueryWebsearchTool,
    answerQueryDirectTool,
    explainTopicWithDocsTool,
    getDocSnippetsTool,
    generateProjectGuidelinesTool,
    // Filesystem Tools
    readFileTool, // Handles single and multiple files now
    // readMultipleFilesTool, // Merged into readFileTool
    writeFileTool,
    editFileTool,
    // createDirectoryTool, // Removed
    listDirectoryTool,
    directoryTreeTool,
    moveFileTool,
    searchFilesTool,
    getFileInfoTool,
    executeTerminalCommandTool, // Renamed
    // Add the new combined tools
    saveGenerateProjectGuidelinesTool,
    saveDocSnippetTool,
    saveTopicExplanationTool,
    // Removed old save_query_answer, added new specific ones
    saveAnswerQueryDirectTool,
    saveAnswerQueryWebsearchTool,
    
    // New research-oriented tools
    codeAnalysisWithDocsTool,
    technicalComparisonTool,
    architecturePatternRecommendationTool,
    dependencyVulnerabilityScanTool,
    databaseSchemaAnalyzerTool,
    securityBestPracticesAdvisorTool,
    testingStrategyGeneratorTool,
    regulatoryComplianceAdvisorTool,
    microserviceDesignAssistantTool,
    documentationGeneratorTool,
];

// Create a map for easy lookup
export const toolMap = new Map<string, ToolDefinition>(
    allTools.map(tool => [tool.name, tool])
);