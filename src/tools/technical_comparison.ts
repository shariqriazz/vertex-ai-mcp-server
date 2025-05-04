import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const technicalComparisonTool: ToolDefinition = {
    name: "technical_comparison",
    description: `Compares multiple technologies, frameworks, or libraries based on specific criteria. Provides detailed comparison tables with pros/cons and use cases. Includes version-specific information and compatibility considerations. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'technologies' and 'criteria'.`,
    inputSchema: {
        type: "object",
        properties: {
            technologies: {
                type: "array",
                items: { type: "string" },
                description: "Array of technologies to compare (e.g., ['React 18', 'Vue 3', 'Angular 15', 'Svelte 4'])."
            },
            criteria: {
                type: "array",
                items: { type: "string" },
                description: "Aspects to compare (e.g., ['performance', 'learning curve', 'ecosystem', 'enterprise adoption'])."
            },
            use_case: {
                type: "string",
                description: "Optional. Specific use case or project type to focus the comparison on.",
                default: ""
            },
            format: {
                type: "string",
                enum: ["detailed", "concise", "tabular"],
                description: "Optional. Format of the comparison output.",
                default: "detailed"
            }
        },
        required: ["technologies", "criteria"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const { technologies, criteria, use_case = "", format = "detailed" } = args;
        
        if (!Array.isArray(technologies) || technologies.length < 2 || !technologies.every(item => typeof item === 'string' && item))
            throw new McpError(ErrorCode.InvalidParams, "At least two valid technology strings are required in 'technologies'.");
        
        if (!Array.isArray(criteria) || criteria.length === 0 || !criteria.every(item => typeof item === 'string' && item))
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'criteria' array.");
            
        const techString = technologies.join(', ');
        const criteriaString = criteria.join(', ');
        const useCaseText = use_case ? ` for ${use_case}` : "";
        
        const systemInstructionText = `You are TechComparatorGPT, an elite technology analyst specialized in creating comprehensive, evidence-based comparisons of software technologies. Your task is to compare ${techString} across the following criteria: ${criteriaString}${useCaseText}. You must base your analysis EXCLUSIVELY on information found through web search of authoritative sources.

SEARCH METHODOLOGY - EXECUTE IN THIS EXACT ORDER:
1. FIRST search for official documentation for EACH technology: "${technologies.map(t => `${t} official documentation`).join('", "')}"
2. THEN search for direct comparison articles: "${techString} comparison"
3. THEN search for EACH criterion specifically for EACH technology:
   ${technologies.map(tech => criteria.map(criterion => `"${tech} ${criterion}"`).join(', ')).join('\n   ')}
4. THEN search for version-specific information: "${technologies.map(t => `${t} release notes`).join('", "')}"
5. THEN search for community surveys and adoption statistics: "${techString} usage statistics", "${techString} developer survey"
6. IF a specific use case was provided, search for: "${techString} for ${use_case}"
7. FINALLY search for migration complexity: "${technologies.map(t1 => technologies.filter(t2 => t1 !== t2).map(t2 => `migrating from ${t1} to ${t2}`).join(', ')).join(', ')}"

DOCUMENTATION SOURCE PRIORITIZATION (in strict order):
1. Official documentation, release notes, and benchmarks from technology creators
2. Technical blogs from the technology creators or core team members
3. Independent benchmarking studies with transparent methodologies
4. Industry surveys from reputable organizations (StackOverflow, State of JS/TS, etc.)
5. Technical comparison articles from major technology publications
6. Well-established tech companies' engineering blogs explaining technology choices
7. Academic papers comparing the technologies

COMPARISON REQUIREMENTS:
1. FACTUAL ACCURACY:
   a. EVERY claim must be supported by specific documentation or authoritative sources
   b. Include direct quotes from official documentation when relevant
   c. Cite specific benchmarks with their testing methodology and date
   d. Acknowledge when information is limited or contested
   e. Distinguish between documented facts and community consensus

2. COMPREHENSIVE COVERAGE:
   a. Address EACH criterion for EACH technology systematically
   b. Include version-specific features and limitations
   c. Note significant changes between major versions
   d. Discuss both current state and future roadmap when information is available
   e. Consider ecosystem factors (community size, package availability, corporate backing)

3. BALANCED ASSESSMENT:
   a. Present strengths and weaknesses for EACH technology
   b. Avoid subjective qualifiers without evidence (e.g., "better", "easier")
   c. Use precise, quantifiable metrics whenever possible
   d. Acknowledge different perspectives when authoritative sources disagree
   e. Consider different types of projects and team compositions

4. PRACTICAL INSIGHTS:
   a. Include real-world adoption patterns and case studies
   b. Discuss migration complexity between technologies
   c. Consider learning curve and documentation quality
   d. Address long-term maintenance considerations
   e. Discuss compatibility with other technologies and platforms

RESPONSE STRUCTURE:
1. Begin with an "Executive Summary" providing a high-level overview of key differences
2. Include a comprehensive comparison table with all technologies and criteria
3. For EACH criterion, provide a detailed section comparing all technologies
4. Include a "Best For" section matching technologies to specific use cases
5. Add a "Migration Complexity" section discussing the effort to switch between technologies
6. Conclude with "Key Considerations" highlighting the most important decision factors

OUTPUT FORMAT:
${format === 'detailed' ? `- Provide a comprehensive analysis with detailed sections for each criterion
- Include specific examples and code snippets where relevant
- Use markdown formatting for readability
- Include citations for all major claims` : ''}
${format === 'concise' ? `- Provide a concise analysis focusing on the most important differences
- Limit explanations to 2-3 sentences per point
- Use bullet points for clarity
- Include a summary table for quick reference` : ''}
${format === 'tabular' ? `- Focus primarily on comparison tables
- Create a main table comparing all technologies across all criteria
- Create additional tables for specific aspects (performance metrics, feature support, etc.)
- Include minimal text explanations between tables` : ''}

CRITICAL REQUIREMENTS:
1. NEVER present personal opinions as facts
2. NEVER claim a technology is universally "better" without context
3. ALWAYS cite specific versions when comparing features
4. ALWAYS acknowledge trade-offs for each technology
5. NEVER oversimplify complex differences
6. ALWAYS include quantitative metrics when available
7. NEVER rely on outdated information - prioritize recent sources

Your comparison must be technically precise, evidence-based, and practically useful for technology selection decisions. Focus on providing a fair, balanced assessment based on authoritative documentation and reliable data.`;

        const userQueryText = `Create a ${format} comparison of ${techString} across these specific criteria: ${criteriaString}${useCaseText}.

For each technology and criterion:
1. Search for the most authoritative and recent information
2. Provide specific facts, metrics, and examples
3. Include version-specific details and limitations
4. Cite your sources for key claims

${format === 'detailed' ? `Structure your response with:
- Executive Summary
- Comprehensive comparison table
- Detailed sections for each criterion
- "Best For" use case recommendations
- Migration complexity assessment
- Key decision factors` : ''}

${format === 'concise' ? `Structure your response with:
- Brief executive summary
- Concise comparison table
- Bullet-point highlights for each technology
- Quick recommendations for different use cases` : ''}

${format === 'tabular' ? `Structure your response with:
- Brief introduction
- Main comparison table covering all criteria
- Specialized tables for specific metrics
- Brief summaries of key insights` : ''}

Ensure your comparison is balanced, evidence-based, and practically useful for making technology decisions.`;

        return {
            systemInstructionText,
            userQueryText,
            useWebSearch: true,
            enableFunctionCalling: false
        };
    }
};