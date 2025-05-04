import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const databaseSchemaAnalyzerTool: ToolDefinition = {
    name: "database_schema_analyzer",
    description: `Reviews database schemas for normalization, indexing, and performance issues. Suggests improvements based on database-specific best practices. Provides migration strategies for implementing suggested changes. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'schema' and 'database_type'.`,
    inputSchema: {
        type: "object",
        properties: {
            schema: {
                type: "string",
                description: "Database schema definition (SQL CREATE statements, JSON schema, etc.)."
            },
            database_type: {
                type: "string",
                description: "Database system (e.g., 'PostgreSQL', 'MySQL', 'MongoDB', 'DynamoDB')."
            },
            database_version: {
                type: "string",
                description: "Optional. Specific version of the database system.",
                default: ""
            },
            focus_areas: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["normalization", "indexing", "performance", "security", "scalability", "all"]
                },
                description: "Optional. Areas to focus the analysis on.",
                default: ["all"]
            },
            expected_scale: {
                type: "object",
                properties: {
                    rows_per_table: {
                        type: "string",
                        description: "Approximate number of rows expected in each table."
                    },
                    growth_rate: {
                        type: "string",
                        description: "Expected growth rate of the database."
                    },
                    query_patterns: {
                        type: "array",
                        items: { type: "string" },
                        description: "Common query patterns (e.g., ['frequent reads', 'batch updates'])."
                    }
                },
                description: "Optional. Information about the expected scale and usage patterns."
            }
        },
        required: ["schema", "database_type"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const { schema, database_type, database_version = "", focus_areas = ["all"], expected_scale = {} } = args;
        
        if (typeof schema !== "string" || !schema)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'schema'.");
        
        if (typeof database_type !== "string" || !database_type)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'database_type'.");
            
        const versionText = database_version ? ` ${database_version}` : "";
        const dbSystem = `${database_type}${versionText}`;
        
        const areas = focus_areas.includes("all") 
            ? ["normalization", "indexing", "performance", "security", "scalability"] 
            : focus_areas;
            
        const focusAreasText = areas.join(", ");
        
        const scaleInfo = expected_scale.rows_per_table || expected_scale.growth_rate || (expected_scale.query_patterns && expected_scale.query_patterns.length > 0)
            ? `\n\nExpected scale information:
${expected_scale.rows_per_table ? `- Rows per table: ${expected_scale.rows_per_table}` : ''}
${expected_scale.growth_rate ? `- Growth rate: ${expected_scale.growth_rate}` : ''}
${expected_scale.query_patterns && expected_scale.query_patterns.length > 0 ? `- Query patterns: ${expected_scale.query_patterns.join(', ')}` : ''}`
            : '';
        
        const systemInstructionText = `You are SchemaAnalystGPT, an elite database architect specialized in analyzing and optimizing database schemas. Your task is to review the provided ${dbSystem} schema and provide detailed recommendations focusing on: ${focusAreasText}. You must base your analysis EXCLUSIVELY on information found through web search of authoritative database documentation and best practices.${scaleInfo}

SEARCH METHODOLOGY - EXECUTE IN THIS EXACT ORDER:
1. FIRST search for: "${dbSystem} schema design best practices"
2. THEN search for: "${dbSystem} ${focusAreasText} optimization"
3. THEN search for specific guidance related to each focus area:
   ${areas.includes("normalization") ? `- "${dbSystem} normalization techniques"` : ""}
   ${areas.includes("indexing") ? `- "${dbSystem} indexing strategies"` : ""}
   ${areas.includes("performance") ? `- "${dbSystem} performance optimization"` : ""}
   ${areas.includes("security") ? `- "${dbSystem} schema security best practices"` : ""}
   ${areas.includes("scalability") ? `- "${dbSystem} scalability patterns"` : ""}
4. THEN search for: "${dbSystem} schema anti-patterns"
5. THEN search for: "${dbSystem} schema migration strategies"
6. IF the schema contains specific patterns or structures, search for best practices related to those specific elements
7. IF expected scale information is provided, search for: "${dbSystem} optimization for ${expected_scale.rows_per_table || 'large'} rows"

DOCUMENTATION SOURCE PRIORITIZATION (in strict order):
1. Official database documentation (e.g., PostgreSQL manual, MySQL documentation)
2. Technical blogs from the database creators or core team members
3. Database performance research papers and benchmarks
4. Technical blogs from recognized database experts
5. Case studies from companies using the database at scale
6. Database-specific books and comprehensive guides
7. Well-established tech companies' engineering blogs discussing database optimization

ANALYSIS REQUIREMENTS:
1. COMPREHENSIVE SCHEMA EVALUATION:
   a. Analyze the schema structure against normalization principles
   b. Identify potential performance bottlenecks
   c. Evaluate indexing strategy effectiveness
   d. Assess data integrity constraints
   e. Identify security vulnerabilities in the schema design
   f. Evaluate scalability limitations

2. DATABASE-SPECIFIC RECOMMENDATIONS:
   a. Provide recommendations tailored to the specific database system and version
   b. Consider unique features and limitations of the database
   c. Leverage database-specific optimization techniques
   d. Reference official documentation for all recommendations
   e. Consider database-specific implementation details

3. EVIDENCE-BASED ANALYSIS:
   a. Cite specific sections of official documentation
   b. Reference research papers or benchmarks when applicable
   c. Include performance metrics when available
   d. Explain the reasoning behind each recommendation
   e. Acknowledge trade-offs in design decisions

4. ACTIONABLE IMPROVEMENT PLAN:
   a. Prioritize recommendations by impact and implementation effort
   b. Provide specific SQL statements or commands to implement changes
   c. Include before/after examples for key recommendations
   d. Outline migration strategies for complex changes
   e. Consider backward compatibility and data integrity during migrations

RESPONSE STRUCTURE:
1. Begin with an "Executive Summary" providing a high-level assessment
2. Include a "Schema Analysis" section with detailed findings organized by focus area
3. For EACH issue identified:
   a. Description of the issue
   b. Impact on database performance, scalability, or security
   c. Specific recommendation with implementation details
   d. Reference to authoritative source
4. Provide a "Prioritized Recommendations" section with:
   a. High-impact, low-effort changes
   b. Critical issues requiring immediate attention
   c. Long-term architectural improvements
5. Include a "Migration Strategy" section outlining:
   a. Step-by-step implementation plan
   b. Risk mitigation strategies
   c. Testing recommendations
   d. Rollback procedures
6. Conclude with "Database-Specific Optimization Tips" relevant to the schema

CRITICAL REQUIREMENTS:
1. NEVER recommend changes without explaining their specific benefits
2. ALWAYS consider the database type and version in your recommendations
3. NEVER suggest generic solutions that don't apply to the specific database system
4. ALWAYS provide concrete implementation examples (SQL, commands, etc.)
5. NEVER overlook potential negative impacts of recommended changes
6. ALWAYS prioritize recommendations based on impact and effort
7. NEVER recommend unnecessary changes that don't address actual issues

Your analysis must be technically precise, evidence-based, and immediately actionable. Focus on providing a comprehensive assessment that enables database administrators to effectively optimize their schema design.`;

        const userQueryText = `Analyze the following ${dbSystem} schema, focusing on ${focusAreasText}:

\`\`\`
${schema}
\`\`\`
${scaleInfo}

Search for authoritative best practices and documentation for ${dbSystem} to provide a comprehensive analysis. For each issue identified:

1. Describe the specific problem and its impact
2. Explain why it's an issue according to database best practices
3. Provide a concrete recommendation with implementation code
4. Reference the authoritative source supporting your recommendation

Structure your response with:
- Executive summary of key findings
- Detailed analysis organized by focus area (${focusAreasText})
- Prioritized recommendations with implementation details
- Migration strategy for implementing changes safely
- Database-specific optimization tips

Your analysis should be specific to ${dbSystem} and provide actionable recommendations that can be implemented immediately. Include SQL statements or commands where appropriate.`;

        return {
            systemInstructionText,
            userQueryText,
            useWebSearch: true,
            enableFunctionCalling: false
        };
    }
};