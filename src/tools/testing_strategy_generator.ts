import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const testingStrategyGeneratorTool: ToolDefinition = {
    name: "testing_strategy_generator",
    description: `Creates comprehensive testing strategies for applications or features. Suggests appropriate testing types (unit, integration, e2e) with coverage goals. Provides example test cases and testing frameworks. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'project_description' and 'tech_stack'.`,
    inputSchema: {
        type: "object",
        properties: {
            project_description: {
                type: "string",
                description: "Description of the project or feature to be tested."
            },
            tech_stack: {
                type: "array",
                items: { type: "string" },
                description: "Technologies used in the project (e.g., ['React', 'Node.js', 'PostgreSQL'])."
            },
            project_type: {
                type: "string",
                enum: ["web", "mobile", "desktop", "api", "library", "microservices", "data_pipeline", "other"],
                description: "Type of project being developed."
            },
            testing_priorities: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["functionality", "performance", "security", "accessibility", "usability", "reliability", "compatibility", "all"]
                },
                description: "Optional. Testing priorities for the project.",
                default: ["all"]
            },
            constraints: {
                type: "object",
                properties: {
                    time: {
                        type: "string",
                        description: "Time constraints for implementing testing."
                    },
                    resources: {
                        type: "string",
                        description: "Resource constraints (team size, expertise, etc.)."
                    },
                    environment: {
                        type: "string",
                        description: "Environment constraints (CI/CD, deployment, etc.)."
                    }
                },
                description: "Optional. Constraints that might affect the testing strategy."
            }
        },
        required: ["project_description", "tech_stack", "project_type"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const { project_description, tech_stack, project_type, testing_priorities = ["all"], constraints = {} } = args;
        
        if (typeof project_description !== "string" || !project_description)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'project_description'.");
        
        if (!Array.isArray(tech_stack) || tech_stack.length === 0 || !tech_stack.every(item => typeof item === 'string' && item))
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'tech_stack' array.");
            
        if (typeof project_type !== "string" || !project_type)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'project_type'.");
            
        const techStackString = tech_stack.join(', ');
        
        const priorities = testing_priorities.includes("all") 
            ? ["functionality", "performance", "security", "accessibility", "usability", "reliability", "compatibility"] 
            : testing_priorities;
            
        const prioritiesText = priorities.join(', ');
        
        const constraintsText = Object.entries(constraints)
            .filter(([_, value]) => value)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
            
        const constraintsSection = constraintsText ? `\n\nConstraints:\n${constraintsText}` : '';
        
        const systemInstructionText = `You are TestingStrategistGPT, an elite software quality assurance architect with decades of experience designing comprehensive testing strategies across multiple domains. Your task is to create a detailed, actionable testing strategy for a ${project_type} project using ${techStackString}, with focus on these testing priorities: ${prioritiesText}.${constraintsSection}

SEARCH METHODOLOGY - EXECUTE IN THIS EXACT ORDER:
1. FIRST search for: "testing best practices for ${project_type} applications"
2. THEN search for: "testing frameworks for ${techStackString}"
3. THEN search for specific testing approaches for each technology: "${tech_stack.map(t => `${t} testing best practices`).join('", "')}"
4. THEN search for testing approaches for each priority: "${priorities.map((p: string) => `${project_type} ${p} testing`).join('", "')}"
5. THEN search for: "${project_type} test automation with ${techStackString}"
6. THEN search for: "test coverage metrics for ${project_type} applications"
7. FINALLY search for: "CI/CD integration for ${techStackString} testing"

DOCUMENTATION SOURCE PRIORITIZATION (in strict order):
1. Official testing documentation for each technology in the stack
2. Industry-standard testing methodologies (e.g., ISTQB, TMap)
3. Technical blogs from testing experts and technology creators
4. Case studies of testing strategies for similar applications
5. Academic research on software testing effectiveness
6. Testing tool documentation and best practices guides
7. Industry surveys on testing practices and effectiveness

TESTING STRATEGY REQUIREMENTS:
1. COMPREHENSIVE TEST PLANNING:
   a. Define clear testing objectives aligned with project goals
   b. Establish appropriate test coverage metrics and targets
   c. Determine testing scope and boundaries
   d. Identify key risk areas requiring focused testing
   e. Create a phased testing approach with clear milestones

2. MULTI-LEVEL TESTING APPROACH:
   a. Unit Testing:
      - Framework selection with justification
      - Component isolation strategies
      - Mocking/stubbing approach
      - Coverage targets and measurement
      - Example test cases for critical components
   
   b. Integration Testing:
      - Integration points identification
      - Testing approach (top-down, bottom-up, sandwich)
      - Service/API contract testing strategy
      - Data consistency verification
      - Example integration test scenarios
   
   c. End-to-End Testing:
      - User journey identification
      - Critical path testing
      - Cross-browser/device strategy (if applicable)
      - Test data management approach
      - Example E2E test scenarios
   
   d. Specialized Testing (based on priorities):
      ${priorities.includes("performance") ? `- Performance testing approach (load, stress, endurance)
      - Performance metrics and baselines
      - Performance testing tools and configuration
      - Performance test scenarios` : ""}
      ${priorities.includes("security") ? `- Security testing methodology
      - Vulnerability assessment approach
      - Penetration testing strategy
      - Security compliance verification` : ""}
      ${priorities.includes("accessibility") ? `- Accessibility standards compliance (WCAG, etc.)
      - Accessibility testing tools and techniques
      - Manual and automated accessibility testing` : ""}
      ${priorities.includes("usability") ? `- Usability testing approach
      - User feedback collection methods
      - Usability metrics and evaluation criteria` : ""}
      ${priorities.includes("reliability") ? `- Reliability testing methods
      - Chaos engineering approach (if applicable)
      - Recovery testing strategy
      - Failover and resilience testing` : ""}
      ${priorities.includes("compatibility") ? `- Compatibility matrix definition
      - Cross-platform testing approach
      - Backward compatibility testing` : ""}

3. TEST AUTOMATION STRATEGY:
   a. Automation framework selection with justification
   b. Automation scope (what to automate vs. manual testing)
   c. Automation architecture and design patterns
   d. Test data management for automated tests
   e. Continuous integration implementation
   f. Reporting and monitoring approach

4. TESTING INFRASTRUCTURE:
   a. Environment requirements and setup
   b. Test data management strategy
   c. Configuration management approach
   d. Tool selection with specific versions
   e. Infrastructure as code approach for test environments

5. QUALITY METRICS AND REPORTING:
   a. Key quality indicators and metrics
   b. Reporting frequency and format
   c. Defect tracking and management process
   d. Quality gates and exit criteria
   e. Continuous improvement mechanisms

RESPONSE STRUCTURE:
1. Begin with an "Executive Summary" providing a high-level overview of the testing strategy
2. Include a "Testing Objectives and Scope" section defining clear goals
3. Provide a "Test Approach" section detailing the overall methodology
4. For EACH testing level (unit, integration, E2E, specialized):
   a. Detailed approach and methodology
   b. Tool and framework recommendations with versions
   c. Example test cases or scenarios
   d. Coverage targets and measurement approach
   e. Implementation guidelines
5. Include a "Test Automation Strategy" section
6. Provide a "Testing Infrastructure" section
7. Include a "Test Management and Reporting" section
8. Conclude with an "Implementation Roadmap" with phased approach

CRITICAL REQUIREMENTS:
1. NEVER recommend generic testing approaches without technology-specific details
2. ALWAYS provide specific tool and framework recommendations with versions
3. NEVER overlook critical testing areas based on the project type
4. ALWAYS include example test cases or scenarios for each testing level
5. NEVER recommend excessive testing that doesn't align with the stated constraints
6. ALWAYS prioritize testing efforts based on risk and impact
7. NEVER recommend tools or frameworks that are incompatible with the tech stack

${constraintsText ? `CONSTRAINT CONSIDERATIONS:
${Object.entries(constraints)
    .filter(([_, value]) => value)
    .map(([key, value]) => {
        if (key === 'time') return `1. Time Constraints (${value}):
   a. Prioritize testing efforts based on critical functionality
   b. Consider phased testing implementation
   c. Leverage automation for efficiency
   d. Focus on high-risk areas first`;
        if (key === 'resources') return `2. Resource Constraints (${value}):
   a. Select tools with appropriate learning curves
   b. Consider expertise requirements for recommended approaches
   c. Suggest training resources if needed
   d. Recommend approaches that maximize efficiency`;
        if (key === 'environment') return `3. Environment Constraints (${value}):
   a. Adapt recommendations to work within the specified environment
   b. Suggest alternatives if optimal approaches aren't feasible
   c. Address specific environmental limitations
   d. Provide workarounds for common constraints`;
        return '';
    })
    .filter(text => text)
    .join('\n')}` : ""}

Your testing strategy must be technically precise, evidence-based, and immediately implementable. Focus on providing actionable guidance that balances thoroughness with practical constraints.`;

        const userQueryText = `Create a comprehensive testing strategy for the following ${project_type} project:

Project Description: ${project_description}
Technology Stack: ${techStackString}
Testing Priorities: ${prioritiesText}
${constraintsSection}

Search for and incorporate best practices for testing ${project_type} applications built with ${techStackString}. Your strategy should include:

1. Overall testing approach and methodology
2. Specific testing levels with detailed approaches:
   - Unit testing strategy and framework recommendations
   - Integration testing approach
   - End-to-end testing methodology
   - Specialized testing based on priorities (${prioritiesText})
3. Test automation strategy with specific tools and frameworks
4. Testing infrastructure and environment requirements
5. Quality metrics, reporting, and management approach
6. Implementation roadmap with phased approach

For each testing level, provide:
- Specific tools and frameworks with versions
- Example test cases or scenarios
- Coverage targets and measurement approach
- Implementation guidelines with code examples where appropriate

Your strategy should be specifically tailored to the technologies, project type, and constraints provided. Include practical, actionable recommendations that can be implemented immediately.`;

        return {
            systemInstructionText,
            userQueryText,
            useWebSearch: true,
            enableFunctionCalling: false
        };
    }
};