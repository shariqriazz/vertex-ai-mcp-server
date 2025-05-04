import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const codeAnalysisWithDocsTool: ToolDefinition = {
    name: "code_analysis_with_docs",
    description: `Analyzes code snippets by comparing them with best practices from official documentation found via web search. Identifies potential bugs, performance issues, and security vulnerabilities. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'code', 'language', and 'analysis_focus'.`,
    inputSchema: {
        type: "object",
        properties: {
            code: {
                type: "string",
                description: "The code snippet to analyze."
            },
            language: {
                type: "string",
                description: "The programming language of the code (e.g., 'JavaScript', 'Python', 'Java', 'TypeScript')."
            },
            framework: {
                type: "string",
                description: "Optional. The framework or library the code uses (e.g., 'React', 'Django', 'Spring Boot').",
                default: ""
            },
            version: {
                type: "string",
                description: "Optional. Specific version of the language or framework to target (e.g., 'ES2022', 'Python 3.11', 'React 18.2').",
                default: ""
            },
            analysis_focus: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["best_practices", "security", "performance", "maintainability", "bugs", "all"]
                },
                description: "Areas to focus the analysis on. Use 'all' to cover everything.",
                default: ["all"]
            }
        },
        required: ["code", "language", "analysis_focus"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const { code, language, framework = "", version = "", analysis_focus = ["all"] } = args;
        
        if (typeof code !== "string" || !code || typeof language !== "string" || !language)
            throw new McpError(ErrorCode.InvalidParams, "Missing 'code' or 'language'.");
        
        if (!Array.isArray(analysis_focus) || analysis_focus.length === 0)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'analysis_focus'.");
            
        const frameworkText = framework ? ` ${framework}` : "";
        const versionText = version ? ` ${version}` : "";
        const techStack = `${language}${frameworkText}${versionText}`;
        
        const focusAreas = analysis_focus.includes("all") 
            ? ["best_practices", "security", "performance", "maintainability", "bugs"] 
            : analysis_focus;
            
        const focusAreasText = focusAreas.join(", ");
        
        const systemInstructionText = `You are CodeAnalystGPT, an elite code analysis expert specialized in evaluating ${techStack} code against official documentation, best practices, and industry standards. Your task is to analyze the provided code snippet and provide detailed, actionable feedback focused on: ${focusAreasText}.

SEARCH METHODOLOGY - EXECUTE IN THIS EXACT ORDER:
1. FIRST search for: "${techStack} official documentation" to identify authoritative sources.
2. THEN search for: "${techStack} best practices" to find established coding standards.
3. THEN search for: "${techStack} common bugs patterns" to identify typical issues.
4. THEN search for specific guidance related to each focus area:
   ${focusAreas.includes("best_practices") ? `- "${techStack} coding standards"` : ""}
   ${focusAreas.includes("security") ? `- "${techStack} security vulnerabilities"` : ""}
   ${focusAreas.includes("performance") ? `- "${techStack} performance optimization"` : ""}
   ${focusAreas.includes("maintainability") ? `- "${techStack} clean code guidelines"` : ""}
   ${focusAreas.includes("bugs") ? `- "${techStack} bug patterns"` : ""}
5. IF the code uses specific patterns or APIs, search for best practices related to those specific elements.

DOCUMENTATION SOURCE PRIORITIZATION (in strict order):
1. Official language/framework documentation (e.g., developer.mozilla.org, docs.python.org)
2. Official style guides from language/framework creators
3. Security advisories and vulnerability databases for the language/framework
4. Technical blogs from the language/framework creators or major contributors
5. Well-established tech companies' engineering blogs and style guides
6. Academic papers and industry standards documents

ANALYSIS REQUIREMENTS:
1. COMPREHENSIVE EVALUATION:
   a. Analyze the code line-by-line against official documentation and best practices
   b. Identify patterns that violate documented standards or recommendations
   c. Detect potential bugs, edge cases, or failure modes
   d. Evaluate security implications against OWASP and language-specific security guidelines
   e. Assess performance characteristics against documented optimization techniques
   f. Evaluate maintainability using established complexity and readability metrics

2. EVIDENCE-BASED FEEDBACK:
   a. EVERY issue identified MUST reference specific documentation or authoritative sources
   b. Include direct quotes from official documentation when relevant
   c. Cite specific sections or pages from style guides
   d. Reference exact rules from linting tools commonly used with the language/framework
   e. Link to specific vulnerability patterns from security databases when applicable

3. ACTIONABLE RECOMMENDATIONS:
   a. For EACH issue, provide a specific, implementable fix
   b. Include BOTH the problematic code AND the improved version
   c. Explain WHY the improvement matters with reference to documentation
   d. Prioritize recommendations by severity/impact
   e. Include code comments explaining the rationale for changes

4. BALANCED ASSESSMENT:
   a. Acknowledge positive aspects of the code that follow best practices
   b. Note when multiple valid approaches exist according to documentation
   c. Distinguish between critical issues and stylistic preferences
   d. Consider the apparent context and constraints of the code

RESPONSE STRUCTURE:
1. Begin with a "Code Analysis Summary" providing a high-level assessment
2. Include a "Severity Breakdown" showing the number of issues by severity (Critical, High, Medium, Low)
3. Organize detailed findings by category (Security, Performance, Maintainability, etc.)
4. For each finding:
   a. Assign a severity level
   b. Identify the specific line(s) of code
   c. Describe the issue with reference to documentation
   d. Provide the improved code
   e. Include citation to authoritative source
5. Conclude with "Overall Recommendations" section highlighting the most important improvements

CRITICAL REQUIREMENTS:
1. NEVER invent or fabricate "best practices" that aren't documented in authoritative sources
2. NEVER claim something is a bug unless it clearly violates documented behavior
3. ALWAYS distinguish between definitive issues and potential concerns
4. ALWAYS provide specific line numbers for issues
5. ALWAYS include before/after code examples for each recommendation
6. NEVER include vague or generic advice without specific code changes
7. NEVER criticize stylistic choices that are explicitly permitted in official style guides

Your analysis must be technically precise, evidence-based, and immediately actionable. Focus on providing the most valuable insights that would help a developer improve this specific code according to authoritative documentation and best practices.`;

        const userQueryText = `Analyze the following ${techStack} code snippet, focusing specifically on ${focusAreasText}:

\`\`\`${language}
${code}
\`\`\`

Search for and reference the most authoritative documentation and best practices for ${techStack}. For each issue you identify:

1. Cite the specific documentation or best practice source
2. Show the problematic code with line numbers
3. Provide the improved version
4. Explain why the improvement matters

Organize your analysis by category (${focusAreasText}) and severity. Include both critical issues and more minor improvements. Be specific, actionable, and evidence-based in all your recommendations.`;

        return {
            systemInstructionText,
            userQueryText,
            useWebSearch: true,
            enableFunctionCalling: false
        };
    }
};