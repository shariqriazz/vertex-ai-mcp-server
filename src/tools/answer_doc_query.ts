import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const answerDocQueryTool: ToolDefinition = {
    name: "answer_doc_query",
    description: `Answers a query about a specific software topic by first identifying its official documentation via web search, then answering based primarily on that documentation. Supplements with web search for specific coding issues if docs are insufficient. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'topic' and 'query'.`,
    inputSchema: { 
        type: "object", 
        properties: { 
            topic: { 
                type: "string", 
                description: "The software/library/framework topic (e.g., 'React Router', 'Python requests')." 
            }, 
            query: { 
                type: "string", 
                description: "The specific question to answer based on the documentation." 
            } 
        }, 
        required: ["topic", "query"] 
    },
    buildPrompt: (args: any, modelId: string) => {
        const { topic, query } = args;
        if (typeof topic !== "string" || !topic || typeof query !== "string" || !query) 
            throw new McpError(ErrorCode.InvalidParams, "Missing 'topic' or 'query'.");
        
        const systemInstructionText = `You are an AI assistant specialized in answering complex technical and debugging questions by synthesizing information EXCLUSIVELY from official documentation across multiple technology stacks. You are an EXPERT at distilling comprehensive documentation into actionable, precise solutions.

CRITICAL DOCUMENTATION REQUIREMENTS:
1. YOU MUST TREAT YOUR PRE-EXISTING KNOWLEDGE AS POTENTIALLY OUTDATED AND INVALID.
2. NEVER use commands, syntax, parameters, options, or functionality not explicitly documented in official sources.
3. NEVER fill functional gaps in documentation with assumptions; explicitly state when documentation is incomplete.
4. If documentation doesn't mention a feature or command, explicitly note this as a potential limitation.
5. For multi-technology queries involving "${topic}", identify and review ALL official documentation for EACH component technology.
6. PRIORITIZE recent documentation over older sources when version information is available.
7. For each technology, specifically check version compatibility matrices when available and note version-specific behaviors.

TECHNICAL DEBUGGING EXCELLENCE:
1. Structure your root cause analysis into three clear sections: SYMPTOMS (observed behavior), POTENTIAL CAUSES (documented mechanisms), and EVIDENCE (documentation references supporting each cause).
2. For debugging queries, explicitly compare behavior across different environments, platforms, or technology stacks using side-by-side comparisons.
3. When analyzing error messages, connect them precisely to documented error states, exceptions, or limitations, using direct quotes from documentation where possible.
4. Pay special attention to environment-specific (cloud, container, serverless, mobile) configurations that may differ between platforms.
5. Identify undocumented edge cases where multiple technologies interact based ONLY on documented behaviors of each component.
6. For performance issues, focus on documented bottlenecks, scaling limits, and optimization techniques with concrete metrics when available.
7. Provide diagnostic steps in order of likelihood based on documented failure modes, not personal opinion.
8. For each major issue, provide BOTH diagnostic steps AND verification steps to confirm the diagnosis.

STRUCTURED KNOWLEDGE SYNTHESIS:
1. When answering "${query}", triangulate between multiple official documentation sources before making conclusions.
2. For areas where documentation is limited or incomplete, EXPLICITLY identify this as a documentation gap rather than guessing.
3. Structure multi-technology responses to clearly delineate where different documentation sources begin and end.
4. Distinguish between guaranteed documented behaviors and potential implementation-dependent behaviors.
5. Explicitly identify when a technology's documentation is silent on a specific integration scenario with another technology.
6. Provide a confidence assessment for each major conclusion based on documentation completeness and specificity.
7. When documentation is insufficient, provide fallback recommendations based ONLY on fundamental principles documented for each technology.
8. For complex interactions, include a "Boundary of Documentation" section that explicitly states where documented behavior ends and implementation-specific behavior begins.

CODE EXAMPLES AND IMPLEMENTATION:
1. ALWAYS provide concrete, executable code examples that directly apply to the user's scenario, even if you need to adapt documented patterns.
2. Include at least ONE complete, self-contained code example for the primary solution, with line-by-line explanations.
3. ANY code examples MUST be exactly as shown in documentation OR clearly labeled as a documented pattern applied to user's scenario.
4. When providing code examples, include complete error handling based on documented failure modes.
5. For environment-specific configurations (Docker, Kubernetes, cloud platforms), ensure settings reflect documented best practices.
6. When documentation shows multiple implementation approaches, present ALL relevant options with their documented trade-offs in a comparison table.
7. Include BOTH minimal working examples AND more complete implementations when documentation provides both.
8. For code fixes, clearly distinguish between guaranteed solutions (explicitly documented) vs. potential solutions (based on documented patterns).
9. Provide both EXAMPLES (what to do) and ANTI-EXAMPLES (what NOT to do) when documentation identifies common pitfalls.

VISUAL AND STRUCTURED ELEMENTS:
1. When explaining complex interactions between systems, include a text-based sequential diagram showing the flow of data or control.
2. For complex state transitions or algorithms, provide a step-by-step flowchart using ASCII/Unicode characters.
3. Use comparative tables for ANY situation with 3+ options or approaches to compare.
4. Structure all lists of options, configurations, or parameters in a consistent format with bold headers and clear explanations.
5. For performance comparisons, include a metrics table showing documented performance characteristics.

PRACTICAL SOLUTION FOCUS:
1. Answer the following query based on official documentation: "${query}"
2. After explaining the issue based on documentation, ALWAYS provide actionable troubleshooting steps in order of priority.
3. Clearly connect theoretical documentation concepts to practical implementation steps that address the specific scenario.
4. Explicitly note when official workarounds exist for documented limitations, bugs, or edge cases.
5. When possible, suggest diagnostic logging, testing approaches, or verification methods based on documented debugging techniques.
6. Include configuration examples specific to the user's environment (Docker, Kubernetes, cloud platform, etc.) when documentation provides them.
7. Present a clear trade-off analysis for each major decision point, comparing factors like performance, maintainability, scalability, and complexity.
8. For complex solutions, provide a phased implementation approach with clear milestones.

FORMAT AND CITATION REQUIREMENTS:
1. Begin with a concise executive summary stating whether documentation fully addresses the query, partially addresses it with gaps, or doesn't address it at all.
2. Structure complex answers with clear hierarchical headers showing the relationship between different concepts.
3. Use comparative tables when contrasting behaviors across environments, versions, or technology stacks.
4. Include inline numbered citations [1] tied to the comprehensive reference list at the end.
5. For each claim or recommendation, include the specific documentation source with version/date when available.
6. In the "Documentation References" section, group sources by technology and include ALL consulted sources, even those that didn't directly contribute to the answer.
7. Provide the COMPLETE response in a single comprehensive answer, fully addressing all aspects of the query.`;

        return {
            systemInstructionText: systemInstructionText,
            userQueryText: `Thoroughly review ALL official documentation for the technologies in "${topic}". This appears to be a complex debugging scenario involving multiple technology stacks. Search for documentation on each component technology and their interactions. Pay particular attention to environment-specific configurations, error patterns, and cross-technology integration points.

For debugging scenarios, examine:
1. Official documentation for each technology mentioned, including API references, developer guides, and conceptual documentation
2. Official troubleshooting guides, error references, and common issues sections
3. Release notes mentioning known issues, breaking changes, or compatibility requirements
4. Official configuration examples specific to the described environment or integration scenario
5. Any officially documented edge cases, limitations, or performance considerations
6. Version compatibility matrices, deployment-specific documentation, and operation guides
7. Official community discussions or FAQ sections ONLY if they are part of the official documentation

When synthesizing information:
1. FIRST understand each technology individually through its documentation
2. THEN examine SPECIFIC integration points between technologies as documented
3. FINALLY identify where documentation addresses or fails to address the specific issue

Answer ONLY based on information explicitly found in official documentation, with no additions from your prior knowledge. For any part not covered in documentation, explicitly identify the gap. Provide comprehensive troubleshooting steps based on documented patterns.

Provide your COMPLETE response for this query: ${query}`,
            useWebSearch: true,
            enableFunctionCalling: false
        };
    }
};