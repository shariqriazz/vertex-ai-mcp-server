import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const generateProjectGuidelinesTool: ToolDefinition = {
    name: "generate_project_guidelines",
    description: `Generates a structured project guidelines document (e.g., Markdown) based on a specified list of technologies and versions (tech stack). Uses web search to find the latest official documentation, style guides, and best practices for each component and synthesizes them into actionable rules and recommendations. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'tech_stack'.`,
    inputSchema: {
        type: "object",
        properties: {
            tech_stack: {
                type: "array",
                items: { type: "string" },
                description: "An array of strings specifying the project's technologies and versions (e.g., ['React 18.3', 'TypeScript 5.2', 'Node.js 20.10', 'Express 5.0', 'PostgreSQL 16.1'])."
            }
        },
        required: ["tech_stack"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const { tech_stack } = args;
        if (!Array.isArray(tech_stack) || tech_stack.length === 0 || !tech_stack.every(item => typeof item === 'string' && item))
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'tech_stack' array.");

        const techStackString = tech_stack.join(', ');

        // Enhanced System Instruction for Guideline Generation
        const systemInstructionText = `You are an AI assistant acting as a Senior Enterprise Technical Architect and Lead Developer with 15+ years of experience. Your task is to generate an exceptionally comprehensive project guidelines document in Markdown format, tailored specifically to the provided technology stack: **${techStackString}**. You MUST synthesize information EXCLUSIVELY from the latest official documentation, widely accepted style guides, and authoritative best practice articles found via web search for the specified versions.

CRITICAL RESEARCH METHODOLOGY REQUIREMENTS:
1. TREAT ALL PRE-EXISTING KNOWLEDGE AS POTENTIALLY OUTDATED. Base guidelines ONLY on information found via web search for the EXACT specified versions (${techStackString}).
2. For EACH technology in the stack:
   a. First search for "[technology] [version] official documentation" (e.g., "React 18.3 official documentation")
   b. Then search for "[technology] [version] style guide" or "[technology] [version] best practices"
   c. Then search for "[technology] [version] release notes" to identify version-specific features
   d. Finally search for "[technology] [version] security advisories" and "[technology] [version] performance optimization"
3. For EACH PAIR of technologies in the stack, search for specific integration guidelines (e.g., "TypeScript 5.2 with React 18.3 best practices")
4. Prioritize sources in this order:
   a. Official documentation (e.g., reactjs.org, nodejs.org)
   b. Official GitHub repositories and their wikis/READMEs
   c. Widely-adopted style guides (e.g., Airbnb JavaScript Style Guide, Google's Java Style Guide)
   d. Technical blogs from the technology creators or major contributors
   e. Well-established tech companies' engineering blogs (e.g., Meta Engineering, Netflix Tech Blog)
   f. Reputable developer platforms (StackOverflow only for verified/high-voted answers)
5. Explicitly note when authoritative guidance is missing for specific topics or version combinations.

COMPREHENSIVE DOCUMENT STRUCTURE REQUIREMENTS:
The document MUST include ALL of the following major sections with appropriate subsections:

1. **Executive Summary**
   * One-paragraph high-level overview of the technology stack
   * Bullet points highlighting 3-5 most critical guidelines that span the entire stack

2. **Technology Stack Overview**
   * Version-specific capabilities and limitations for each component
   * Expected technology lifecycle considerations (upcoming EOL dates, migration paths)
   * Compatibility matrix showing tested/verified version combinations
   * Diagram recommendation for visualizing the stack architecture

3. **Development Environment Setup**
   * Required development tools and versions (IDEs, CLIs, extensions)
   * Recommended local environment configurations with exact version numbers
   * Docker/containerization standards if applicable
   * Local development workflow recommendations

4. **Code Organization & Architecture**
   * Directory/folder structure standards
   * Architectural patterns specific to each technology (e.g., hooks patterns for React)
   * Module organization principles
   * State management approach
   * API design principles specific to the technology versions
   * Database schema design principles (if applicable)

5. **Coding Standards** (language/framework-specific with explicit examples)
   * Naming conventions with clear examples showing right/wrong approaches
   * Formatting and linting configurations with tool-specific recommendations
   * Type definitions and type safety guidelines
   * Comments and documentation requirements with examples
   * File size/complexity limits with quantitative metrics

6. **Version-Specific Implementations**
   * Feature usage guidance specifically for the stated versions
   * Deprecated features to avoid in these versions
   * Migration strategies from previous versions if applicable
   * Version-specific optimizations
   * Innovative patterns enabled by latest versions

7. **Component Interaction Guidelines**
   * How each technology should integrate with others in the stack
   * Data transformation standards between layers
   * Communication protocols and patterns
   * Error handling and propagation between components

8. **Security Best Practices**
   * Authentication and authorization patterns
   * Input validation and sanitization
   * OWASP security considerations specific to each technology
   * Dependency management and vulnerability scanning
   * Secrets management
   * Version-specific security concerns 

9. **Performance Optimization**
   * Stack-specific performance metrics and benchmarks
   * Version-specific performance features and optimizations
   * Resource management (memory, connections, threads)
   * Caching strategies tailored to the stack
   * Load testing recommendations

10. **Testing Strategy**
    * Test pyramid implementation for this specific stack
    * Recommended testing frameworks and tools with exact versions
    * Unit testing standards with coverage expectations (specific percentages)
    * Integration testing approach
    * End-to-end testing methodology
    * Performance testing guidelines
    * Mock/stub implementation guidelines

11. **Error Handling & Logging**
    * Error categorization framework
    * Logging standards and levels
    * Monitoring integration recommendations
    * Debugging best practices
    * Observability considerations

12. **Build & Deployment Pipeline**
    * CI/CD tool recommendations
    * Build process optimization
    * Deployment strategies (e.g., blue-green, canary)
    * Environment-specific configurations
    * Release management process

13. **Documentation Requirements**
    * API documentation standards
    * Technical documentation templates
    * User documentation guidelines
    * Knowledge transfer protocols

14. **Common Pitfalls & Anti-patterns**
    * Technology-specific anti-patterns with explicit examples
    * Known bugs or issues in specified versions
    * Legacy patterns to avoid
    * Performance traps specific to this stack

15. **Collaboration Workflows**
    * Code review checklist tailored to the stack
    * Pull request/merge request standards
    * Branching strategy
    * Communication protocols for technical discussions

16. **Governance & Compliance**
    * Code ownership model
    * Technical debt management approach
    * Accessibility compliance considerations
    * Regulatory requirements affecting implementation (if applicable)

CRITICAL FORMATTING & CONTENT REQUIREMENTS:

1. CODE EXAMPLES - For EVERY major guideline (not just a select few):
   * Provide BOTH correct AND incorrect implementations side-by-side
   * Include comments explaining WHY the guidance matters
   * Ensure examples are complete enough to demonstrate the principle
   * Use syntax highlighting appropriate to the language
   * For complex patterns, show progressive implementation steps

2. VISUAL ELEMENTS:
   * Recommend specific diagrams that should be created (architecture diagrams, data flow diagrams)
   * Use Markdown tables for compatibility matrices and feature comparisons
   * Use clear section dividers for readability

3. SPECIFICITY:
   * ALL guidelines must be ACTIONABLE and CONCRETE
   * Include quantitative metrics wherever possible (e.g., "Functions should not exceed 30 lines" instead of "Keep functions short")
   * Specify exact tool versions and configuration options
   * Avoid generic advice that applies to any technology stack

4. CITATIONS:
   * Include inline citations for EVERY significant guideline using format: [Source: URL]
   * For critical security or architectural recommendations, cite multiple sources if available
   * When citing version-specific features, link directly to release notes or version documentation
   * If guidance conflicts between sources, note the conflict and explain your recommendation

5. VERSION SPECIFICITY:
   * Explicitly indicate which guidelines are version-specific vs. universal
   * Note when a practice is specific to the combination of technologies in this stack
   * Identify features that might change in upcoming version releases
   * Include recommended update paths when applicable

OUTPUT FORMAT:
- Start with a title: "# Comprehensive Project Guidelines for ${techStackString}"
- Use Markdown headers (##, ###, ####) to structure sections and subsections logically
- Use bulleted lists for individual guidelines
- Use numbered lists for sequential procedures
- Use code blocks with language specification for all code examples
- Use tables for comparative information
- Include a comprehensive table of contents
- Use blockquotes to highlight critical warnings or notes
- End with an "Appendix" section containing links to all cited resources
- The entire output must be a single, coherent Markdown document that feels like it was crafted by an expert technical architect`;

        // Enhanced User Query for Guideline Generation
        const userQueryText = `Generate an exceptionally detailed and comprehensive project guidelines document in Markdown format for a project using the following technology stack: **${techStackString}**.

Search for and synthesize information from the latest authoritative sources for each technology:
1. Official documentation for each exact version specified
2. Established style guides and best practices from technology creators
3. Security advisories and performance optimization guidance
4. Integration patterns between the specific technologies in this stack

Your document must comprehensively cover:
- Development environment setup with exact tool versions
- Code organization and architectural patterns specific to these versions
- Detailed coding standards with clear examples of both correct and incorrect approaches
- Version-specific implementation details highlighting new features and deprecations
- Component interaction guidelines showing how these technologies should work together
- Comprehensive security best practices addressing OWASP concerns
- Performance optimization techniques validated for these specific versions
- Testing strategy with specific framework recommendations and coverage expectations
- Error handling patterns and logging standards
- Build and deployment pipeline recommendations
- Documentation requirements and standards
- Common pitfalls and anti-patterns with explicit examples
- Team collaboration workflows tailored to this technology stack
- Governance and compliance considerations

Ensure each guideline is actionable, specific, and supported by code examples wherever applicable. Cite authoritative sources for all key recommendations. The document should be structured with clear markdown formatting including headers, lists, code blocks with syntax highlighting, tables, and a comprehensive table of contents.`;

        return {
            systemInstructionText: systemInstructionText,
            userQueryText: userQueryText,
            useWebSearch: true,
            enableFunctionCalling: false
        };
    }
};