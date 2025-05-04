import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const architecturePatternRecommendationTool: ToolDefinition = {
    name: "architecture_pattern_recommendation",
    description: `Suggests architecture patterns for specific use cases based on industry best practices. Provides implementation examples and considerations for the recommended patterns. Includes diagrams and explanations of pattern benefits and tradeoffs. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'requirements' and 'tech_stack'.`,
    inputSchema: {
        type: "object",
        properties: {
            requirements: {
                type: "object",
                properties: {
                    description: {
                        type: "string",
                        description: "Description of the system to be built."
                    },
                    scale: {
                        type: "string",
                        enum: ["small", "medium", "large", "enterprise"],
                        description: "Expected scale of the system."
                    },
                    key_concerns: {
                        type: "array",
                        items: { type: "string" },
                        description: "Key architectural concerns (e.g., ['scalability', 'security', 'performance', 'maintainability'])."
                    }
                },
                required: ["description", "scale", "key_concerns"],
                description: "Requirements and constraints for the system."
            },
            tech_stack: {
                type: "array",
                items: { type: "string" },
                description: "Technologies to be used (e.g., ['Node.js', 'React', 'PostgreSQL'])."
            },
            industry: {
                type: "string",
                description: "Optional. Industry or domain context (e.g., 'healthcare', 'finance', 'e-commerce').",
                default: ""
            },
            existing_architecture: {
                type: "string",
                description: "Optional. Description of existing architecture if this is an evolution of an existing system.",
                default: ""
            }
        },
        required: ["requirements", "tech_stack"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const { requirements, tech_stack, industry = "", existing_architecture = "" } = args;
        
        if (!requirements || typeof requirements !== 'object' || !requirements.description || !requirements.scale || !Array.isArray(requirements.key_concerns) || requirements.key_concerns.length === 0)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'requirements' object.");
        
        if (!Array.isArray(tech_stack) || tech_stack.length === 0 || !tech_stack.every(item => typeof item === 'string' && item))
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'tech_stack' array.");
            
        const { description, scale, key_concerns } = requirements;
        const techStackString = tech_stack.join(', ');
        const concernsString = key_concerns.join(', ');
        const industryText = industry ? ` in the ${industry} industry` : "";
        const existingArchText = existing_architecture ? `\n\nThe system currently uses the following architecture: ${existing_architecture}` : "";
        
        const systemInstructionText = `You are ArchitectureAdvisorGPT, an elite software architecture consultant with decades of experience designing systems across multiple domains. Your task is to recommend the most appropriate architecture pattern(s) for a ${scale}-scale system${industryText} with these key concerns: ${concernsString}. The system will be built using: ${techStackString}.${existingArchText}

SEARCH METHODOLOGY - EXECUTE IN THIS EXACT ORDER:
1. FIRST search for: "software architecture patterns for ${scale} systems"
2. THEN search for: "architecture patterns for ${concernsString}"
3. THEN search for: "best architecture patterns for ${techStackString}"
4. THEN search for: "${industry} software architecture patterns best practices"
5. THEN search for specific patterns that match the requirements: "microservices vs monolith for ${scale} systems", "event-driven architecture for ${concernsString}", etc.
6. THEN search for case studies: "architecture case study ${industry} ${scale} ${concernsString}"
7. FINALLY search for implementation details: "implementing [specific pattern] with ${techStackString}"

DOCUMENTATION SOURCE PRIORITIZATION (in strict order):
1. Architecture books and papers from recognized authorities (Martin Fowler, Gregor Hohpe, etc.)
2. Official architecture guidance from technology vendors (AWS, Microsoft, Google, etc.)
3. Architecture documentation from successful companies in similar domains
4. Technical blogs from recognized architects and engineering leaders
5. Industry standards organizations (ISO, IEEE, NIST) architecture recommendations
6. Academic research papers on software architecture
7. Case studies of similar systems published by reputable sources

RECOMMENDATION REQUIREMENTS:
1. COMPREHENSIVE PATTERN ANALYSIS:
   a. Identify 2-4 architecture patterns most suitable for the requirements
   b. For EACH pattern, provide:
      - Detailed description of the pattern and its key components
      - Specific benefits related to the stated requirements
      - Known limitations and challenges
      - Implementation considerations with the specified tech stack
      - Real-world examples of successful implementations
   c. Compare patterns across all key concerns
   d. Consider hybrid approaches when appropriate

2. EVIDENCE-BASED RECOMMENDATIONS:
   a. Cite specific architecture authorities and resources for each pattern
   b. Reference industry case studies or research papers
   c. Include quantitative benefits when available (e.g., scalability metrics)
   d. Acknowledge trade-offs with evidence-based reasoning
   e. Consider both immediate needs and long-term evolution

3. PRACTICAL IMPLEMENTATION GUIDANCE:
   a. Provide a high-level component diagram for the recommended architecture
   b. Include specific implementation guidance for the chosen tech stack
   c. Outline key interfaces and communication patterns
   d. Address deployment and operational considerations
   e. Suggest incremental implementation approach if applicable

4. QUALITY ATTRIBUTE ANALYSIS:
   a. Analyze how each pattern addresses each key concern
   b. Provide specific techniques to enhance key quality attributes
   c. Identify potential quality attribute trade-offs
   d. Suggest mitigation strategies for identified weaknesses
   e. Consider non-functional requirements beyond those explicitly stated

RESPONSE STRUCTURE:
1. Begin with an "Executive Summary" providing a high-level recommendation
2. Include a "Pattern Comparison" section with a detailed comparison table
3. For EACH recommended pattern:
   a. Detailed description and key components
   b. Benefits and limitations
   c. Implementation with the specified tech stack
   d. Real-world examples
4. Provide a "Recommended Architecture" section with:
   a. Text-based component diagram
   b. Key components and their responsibilities
   c. Communication patterns and interfaces
   d. Data management approach
5. Include an "Implementation Roadmap" with phased approach
6. Conclude with "Key Architectural Decisions" highlighting critical choices

CRITICAL REQUIREMENTS:
1. NEVER recommend a pattern without explaining how it addresses the specific requirements
2. ALWAYS consider the scale and complexity appropriate to the described system
3. NEVER present a one-size-fits-all solution without acknowledging trade-offs
4. ALWAYS explain how the recommended patterns work with the specified tech stack
5. NEVER recommend overly complex architectures for simple problems
6. ALWAYS consider operational complexity and team capabilities
7. NEVER rely solely on buzzwords or trends without substantive justification

Your recommendation must be technically precise, evidence-based, and practically implementable. Focus on providing actionable architecture guidance that balances immediate needs with long-term architectural qualities.`;

        const userQueryText = `Recommend the most appropriate architecture pattern(s) for the following system:

System Description: ${description}
Scale: ${scale}
Key Concerns: ${concernsString}
Technology Stack: ${techStackString}
${industry ? `Industry: ${industry}` : ""}
${existing_architecture ? `Existing Architecture: ${existing_architecture}` : ""}

Search for and analyze established architecture patterns that would best address these requirements. For each recommended pattern:

1. Explain why it's appropriate for this specific system
2. Describe its key components and interactions
3. Analyze how it addresses each key concern
4. Discuss implementation considerations with the specified tech stack
5. Provide real-world examples of similar systems using this pattern

Include a text-based component diagram of your recommended architecture, showing key components, interfaces, and data flows. Provide an implementation roadmap that outlines how to incrementally adopt this architecture.

Your recommendation should be evidence-based, citing authoritative sources on software architecture. Consider both the immediate requirements and long-term evolution of the system.`;

        return {
            systemInstructionText,
            userQueryText,
            useWebSearch: true,
            enableFunctionCalling: false
        };
    }
};