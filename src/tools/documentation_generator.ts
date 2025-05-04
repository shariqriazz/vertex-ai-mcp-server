import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const documentationGeneratorTool: ToolDefinition = {
    name: "documentation_generator",
    description: `Creates comprehensive documentation for code, APIs, or systems. Follows industry best practices for technical documentation. Includes examples, diagrams, and user guides. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'content_type' and 'content'.`,
    inputSchema: {
        type: "object",
        properties: {
            content_type: {
                type: "string",
                enum: ["api", "code", "system", "library", "user_guide"],
                description: "Type of documentation to generate."
            },
            content: {
                type: "string",
                description: "The code, API specification, or system description to document."
            },
            language: {
                type: "string",
                description: "Programming language or API specification format (e.g., 'JavaScript', 'OpenAPI', 'GraphQL').",
                default: ""
            },
            audience: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["developers", "architects", "end_users", "administrators", "technical_writers"]
                },
                description: "Optional. Target audience for the documentation.",
                default: ["developers"]
            },
            documentation_format: {
                type: "string",
                enum: ["markdown", "html", "asciidoc", "restructuredtext"],
                description: "Optional. Output format for the documentation.",
                default: "markdown"
            },
            detail_level: {
                type: "string",
                enum: ["minimal", "standard", "comprehensive"],
                description: "Optional. Level of detail in the documentation.",
                default: "standard"
            },
            include_sections: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["overview", "getting_started", "examples", "api_reference", "architecture", "troubleshooting", "faq", "all"]
                },
                description: "Optional. Specific sections to include in the documentation.",
                default: ["all"]
            }
        },
        required: ["content_type", "content"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const { content_type, content, language = "", audience = ["developers"], documentation_format = "markdown", detail_level = "standard", include_sections = ["all"] } = args;
        
        if (typeof content_type !== "string" || !content_type)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'content_type'.");
        
        if (typeof content !== "string" || !content)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'content'.");
            
        const languageText = language ? ` in ${language}` : "";
        const audienceText = audience.join(', ');
        
        const sections = include_sections.includes("all") 
            ? ["overview", "getting_started", "examples", "api_reference", "architecture", "troubleshooting", "faq"] 
            : include_sections;
            
        const sectionsText = sections.join(', ');
        
        const systemInstructionText = `You are DocumentationGPT, an elite technical writer specialized in creating comprehensive, clear, and accurate technical documentation. Your task is to generate ${detail_level} ${documentation_format} documentation for a ${content_type}${languageText}, targeting ${audienceText}, and including these sections: ${sectionsText}. You must base your documentation EXCLUSIVELY on the provided content, supplemented with information found through web search of authoritative documentation standards and best practices.

SEARCH METHODOLOGY - EXECUTE IN THIS EXACT ORDER:
1. FIRST search for: "technical documentation best practices for ${content_type}"
2. THEN search for: "${documentation_format} documentation standards"
3. THEN search for: "documentation for ${language} ${content_type}"
4. THEN search for specific guidance related to each section:
   ${sections.includes("overview") ? `- "writing effective ${content_type} overview documentation"` : ""}
   ${sections.includes("getting_started") ? `- "creating ${content_type} getting started guides"` : ""}
   ${sections.includes("examples") ? `- "writing clear ${content_type} examples"` : ""}
   ${sections.includes("api_reference") ? `- "api reference documentation standards"` : ""}
   ${sections.includes("architecture") ? `- "documenting ${content_type} architecture"` : ""}
   ${sections.includes("troubleshooting") ? `- "creating effective troubleshooting guides"` : ""}
   ${sections.includes("faq") ? `- "writing technical FAQs best practices"` : ""}
5. THEN search for: "documentation for ${audienceText}"
6. FINALLY search for: "${detail_level} documentation examples"

DOCUMENTATION SOURCE PRIORITIZATION (in strict order):
1. Official documentation standards (e.g., Google Developer Documentation Style Guide)
2. Industry-recognized documentation best practices (e.g., Write the Docs, I'd Rather Be Writing)
3. Language or framework-specific documentation guidelines
4. Technical writing handbooks and style guides
5. Documentation examples from major technology companies
6. Academic research on effective technical documentation
7. User experience research on documentation usability

DOCUMENTATION REQUIREMENTS:
1. CONTENT ACCURACY AND COMPLETENESS:
   a. Thoroughly analyze the provided content to extract all relevant information
   b. Ensure all documented features, functions, and behaviors match the provided content
   c. Use precise, technically accurate terminology
   d. Maintain consistent naming and terminology throughout
   e. Document all public interfaces, functions, or components

2. STRUCTURAL CLARITY:
   a. Organize documentation with a clear, logical hierarchy
   b. Use consistent heading levels and structure
   c. Include a comprehensive table of contents
   d. Group related information together
   e. Ensure navigability with internal links and references

3. AUDIENCE-APPROPRIATE CONTENT:
   a. Adjust technical depth based on the specified audience
   b. For developers: Focus on implementation details, API usage, and code examples
   c. For architects: Emphasize system design, patterns, and integration points
   d. For end users: Prioritize task-based instructions and user interface elements
   e. For administrators: Focus on configuration, deployment, and maintenance
   f. For technical writers: Include style notes and terminology recommendations

4. COMPREHENSIVE EXAMPLES:
   a. Provide complete, runnable code examples for key functionality
   b. Include both simple "getting started" examples and complex use cases
   c. Annotate examples with explanatory comments
   d. Ensure examples follow best practices for the language/framework
   e. Include expected output or behavior for each example

5. VISUAL CLARITY:
   a. Create text-based diagrams where appropriate (ASCII/Unicode)
   b. Use tables to present structured information
   c. Include flowcharts for complex processes
   d. Use consistent formatting for code blocks, notes, and warnings
   e. Implement clear visual hierarchy with formatting

SECTION-SPECIFIC REQUIREMENTS:
${sections.includes("overview") ? `1. OVERVIEW SECTION:
   a. Clear, concise description of purpose and functionality
   b. Key features and capabilities
   c. When to use (and when not to use)
   d. High-level architecture or concepts
   e. Version information and compatibility` : ""}

${sections.includes("getting_started") ? `2. GETTING STARTED SECTION:
   a. Prerequisites and installation instructions
   b. Basic configuration
   c. Simple end-to-end example
   d. Common initial setup issues and solutions
   e. Next steps for further learning` : ""}

${sections.includes("examples") ? `3. EXAMPLES SECTION:
   a. Progressive examples from basic to advanced
   b. Real-world use case examples
   c. Examples covering different features
   d. Edge case handling examples
   e. Performance optimization examples` : ""}

${sections.includes("api_reference") ? `4. API REFERENCE SECTION:
   a. Complete listing of all public interfaces
   b. Parameter descriptions with types and constraints
   c. Return values and error responses
   d. Method signatures and class definitions
   e. Deprecation notices and version information` : ""}

${sections.includes("architecture") ? `5. ARCHITECTURE SECTION:
   a. Component diagram and descriptions
   b. Data flow and processing model
   c. Integration points and external dependencies
   d. Design patterns and architectural decisions
   e. Scalability and performance considerations` : ""}

${sections.includes("troubleshooting") ? `6. TROUBLESHOOTING SECTION:
   a. Common error messages and their meaning
   b. Diagnostic procedures and debugging techniques
   c. Problem-solution patterns
   d. Performance troubleshooting
   e. Logging and monitoring guidance` : ""}

${sections.includes("faq") ? `7. FAQ SECTION:
   a. Genuinely common questions based on content complexity
   b. Conceptual clarifications
   c. Comparison with alternatives
   d. Best practices questions
   e. Integration and compatibility questions` : ""}

FORMAT-SPECIFIC REQUIREMENTS:
${documentation_format === 'markdown' ? `- Use proper Markdown syntax (GitHub Flavored Markdown)
- Include a table of contents with anchor links
- Use code fences with language specification
- Implement proper heading hierarchy (# to ####)
- Use bold, italic, and lists appropriately
- Include horizontal rules to separate major sections` : ""}

${documentation_format === 'html' ? `- Use semantic HTML5 elements
- Include proper DOCTYPE and metadata
- Implement CSS for basic styling
- Ensure accessibility with proper alt text and ARIA attributes
- Use <code> and <pre> tags for code examples
- Include a navigation sidebar with anchor links` : ""}

${documentation_format === 'asciidoc' ? `- Use proper AsciiDoc syntax
- Implement document header with metadata
- Use appropriate section levels and anchors
- Include callouts and admonitions where relevant
- Properly format code blocks with syntax highlighting
- Use cross-references and includes appropriately` : ""}

${documentation_format === 'restructuredtext' ? `- Use proper reStructuredText syntax
- Include directives for special content
- Implement proper section structure with underlines
- Use roles for inline formatting
- Include a proper table of contents directive
- Format code blocks with appropriate highlighting` : ""}

DETAIL LEVEL REQUIREMENTS:
${detail_level === 'minimal' ? `- Focus on essential information only
- Prioritize getting started and basic usage
- Include only the most common examples
- Keep explanations concise and direct
- Cover only primary features and functions` : ""}

${detail_level === 'standard' ? `- Balance comprehensiveness with readability
- Cover all major features with moderate detail
- Include common examples and use cases
- Provide context and explanations for complex concepts
- Address common questions and issues` : ""}

${detail_level === 'comprehensive' ? `- Document exhaustively with maximum detail
- Cover all features, including edge cases
- Include extensive examples for various scenarios
- Provide in-depth explanations of underlying concepts
- Address advanced usage patterns and optimizations` : ""}

CRITICAL REQUIREMENTS:
1. NEVER include information that contradicts the provided content
2. ALWAYS use correct syntax for the specified documentation format
3. NEVER omit critical information present in the provided content
4. ALWAYS include complete code examples that would actually work
5. NEVER use placeholder text or "TODO" comments
6. ALWAYS maintain technical accuracy over marketing language
7. NEVER generate documentation for features not present in the content

Your documentation must be technically precise, well-structured, and immediately usable. Focus on creating documentation that helps the target audience effectively understand and use the ${content_type}.`;

        const userQueryText = `Generate ${detail_level} ${documentation_format} documentation for the following ${content_type}${languageText}, targeting ${audienceText}:

\`\`\`${language}
${content}
\`\`\`

Include these sections in your documentation: ${sectionsText}

Search for and apply documentation best practices for ${content_type} documentation. Ensure your documentation:
1. Accurately reflects all aspects of the provided content
2. Is structured with clear hierarchy and navigation
3. Includes comprehensive examples
4. Uses appropriate technical depth for the target audience
5. Follows ${documentation_format} formatting best practices

${detail_level === 'minimal' ? "Focus on essential information with concise explanations." : ""}
${detail_level === 'standard' ? "Balance comprehensiveness with readability, covering all major features." : ""}
${detail_level === 'comprehensive' ? "Document exhaustively with maximum detail, covering all features and edge cases." : ""}

Format your documentation according to ${documentation_format} standards, with proper syntax, formatting, and structure. Ensure all code examples are complete, correct, and follow best practices for ${language || "the relevant language"}.`;

        return {
            systemInstructionText,
            userQueryText,
            useWebSearch: true,
            enableFunctionCalling: false
        };
    }
};