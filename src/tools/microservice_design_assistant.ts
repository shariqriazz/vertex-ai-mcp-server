import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const microserviceDesignAssistantTool: ToolDefinition = {
    name: "microservice_design_assistant",
    description: `Helps design microservice architectures for specific domains. Provides service boundary recommendations and communication patterns. Includes deployment and orchestration considerations. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'domain_description' and 'requirements'.`,
    inputSchema: {
        type: "object",
        properties: {
            domain_description: {
                type: "string",
                description: "Description of the business domain for the microservice architecture."
            },
            requirements: {
                type: "object",
                properties: {
                    functional: {
                        type: "array",
                        items: { type: "string" },
                        description: "Key functional requirements for the system."
                    },
                    non_functional: {
                        type: "array",
                        items: { type: "string" },
                        description: "Non-functional requirements (scalability, availability, etc.)."
                    },
                    constraints: {
                        type: "array",
                        items: { type: "string" },
                        description: "Technical or organizational constraints."
                    }
                },
                required: ["functional", "non_functional"],
                description: "System requirements and constraints."
            },
            tech_stack: {
                type: "object",
                properties: {
                    preferred_languages: {
                        type: "array",
                        items: { type: "string" },
                        description: "Preferred programming languages."
                    },
                    preferred_databases: {
                        type: "array",
                        items: { type: "string" },
                        description: "Preferred database technologies."
                    },
                    deployment_platform: {
                        type: "string",
                        description: "Target deployment platform (e.g., 'Kubernetes', 'AWS', 'Azure')."
                    }
                },
                description: "Optional. Technology preferences for implementation."
            },
            existing_systems: {
                type: "array",
                items: { type: "string" },
                description: "Optional. Description of existing systems that need to be integrated.",
                default: []
            },
            team_structure: {
                type: "string",
                description: "Optional. Description of the development team structure.",
                default: ""
            },
            design_focus: {
                type: "array",
                items: {
                    type: "string",
                    enum: ["service_boundaries", "data_management", "communication_patterns", "deployment", "security", "scalability", "all"]
                },
                description: "Optional. Specific aspects to focus on in the design.",
                default: ["all"]
            }
        },
        required: ["domain_description", "requirements"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const { domain_description, requirements, tech_stack = {}, existing_systems = [], team_structure = "", design_focus = ["all"] } = args;
        
        if (typeof domain_description !== "string" || !domain_description)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'domain_description'.");
        
        if (!requirements || typeof requirements !== 'object' || !Array.isArray(requirements.functional) || !Array.isArray(requirements.non_functional))
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'requirements' object.");
            
        const { functional, non_functional, constraints = [] } = requirements;
        const { preferred_languages = [], preferred_databases = [], deployment_platform = "" } = tech_stack;
        
        const functionalReqs = functional.join(', ');
        const nonFunctionalReqs = non_functional.join(', ');
        const constraintsText = constraints.length > 0 ? constraints.join(', ') : "none specified";
        
        const languagesText = preferred_languages.length > 0 ? preferred_languages.join(', ') : "any appropriate languages";
        const databasesText = preferred_databases.length > 0 ? preferred_databases.join(', ') : "any appropriate databases";
        const platformText = deployment_platform ? deployment_platform : "any appropriate platform";
        
        const existingSystemsText = existing_systems.length > 0 ? existing_systems.join(', ') : "none specified";
        const teamStructureText = team_structure ? team_structure : "not specified";
        
        const areas = design_focus.includes("all") 
            ? ["service_boundaries", "data_management", "communication_patterns", "deployment", "security", "scalability"] 
            : design_focus;
            
        const focusAreasText = areas.join(', ');
        
        const systemInstructionText = `You are MicroserviceArchitectGPT, an elite software architect specialized in designing optimal microservice architectures for complex domains. Your task is to create a comprehensive microservice architecture design for the ${domain_description} domain, focusing on ${focusAreasText}. You must base your design EXCLUSIVELY on information found through web search of authoritative microservice design patterns, domain-driven design principles, and best practices.

SEARCH METHODOLOGY - EXECUTE IN THIS EXACT ORDER:
1. FIRST search for: "domain-driven design ${domain_description}"
2. THEN search for: "microservice architecture patterns best practices"
3. THEN search for: "microservice boundaries identification techniques"
4. THEN search for specific guidance related to each focus area:
   ${areas.includes("service_boundaries") ? `- "microservice service boundary design patterns"` : ""}
   ${areas.includes("data_management") ? `- "microservice data management patterns"` : ""}
   ${areas.includes("communication_patterns") ? `- "microservice communication patterns"` : ""}
   ${areas.includes("deployment") ? `- "microservice deployment orchestration ${platformText}"` : ""}
   ${areas.includes("security") ? `- "microservice security patterns"` : ""}
   ${areas.includes("scalability") ? `- "microservice scalability patterns"` : ""}
5. THEN search for: "microservice architecture with ${languagesText} ${databasesText}"
6. THEN search for: "microservice design for ${functionalReqs}"
7. THEN search for: "microservice architecture for ${nonFunctionalReqs}"
8. FINALLY search for: "microservice team organization Conway's Law"

DOCUMENTATION SOURCE PRIORITIZATION (in strict order):
1. Domain-Driven Design literature (Eric Evans, Vaughn Vernon)
2. Microservice architecture books and papers (Sam Newman, Chris Richardson)
3. Technical blogs from recognized microservice architecture experts
4. Case studies of successful microservice implementations in similar domains
5. Technical documentation from cloud providers on microservice best practices
6. Industry conference presentations on microservice architecture
7. Academic research on microservice design and implementation

MICROSERVICE DESIGN REQUIREMENTS:
1. DOMAIN-DRIVEN SERVICE IDENTIFICATION:
   a. Apply Domain-Driven Design principles to identify bounded contexts
   b. Analyze the domain model to identify aggregate roots
   c. Define clear service boundaries based on business capabilities
   d. Ensure services have high cohesion and loose coupling
   e. Consider domain events and event storming results

2. COMPREHENSIVE SERVICE SPECIFICATION:
   a. For EACH identified microservice:
      - Clear responsibility and business capability
      - API definition with key endpoints
      - Data ownership and entity boundaries
      - Internal domain model
      - Dependencies on other services
      - Sizing and complexity assessment
   b. Justify each service boundary decision
   c. Address potential boundary issues and mitigations
   d. Consider future evolution of the domain

3. DATA MANAGEMENT STRATEGY:
   a. Data ownership and sovereignty principles
   b. Database technology selection for each service
   c. Data consistency patterns (eventual consistency, SAGA, etc.)
   d. Query patterns across service boundaries
   e. Data duplication and synchronization approach
   f. Handling of distributed transactions

4. COMMUNICATION ARCHITECTURE:
   a. Synchronous vs. asynchronous communication patterns
   b. API gateway and composition strategy
   c. Event-driven communication approach
   d. Command vs. event patterns
   e. Service discovery mechanism
   f. Resilience patterns (circuit breaker, bulkhead, etc.)

5. DEPLOYMENT AND OPERATIONAL MODEL:
   a. Containerization and orchestration approach
   b. CI/CD pipeline recommendations
   c. Monitoring and observability strategy
   d. Scaling patterns for each service
   e. Stateful vs. stateless considerations
   f. Infrastructure as Code approach

6. SECURITY ARCHITECTURE:
   a. Authentication and authorization strategy
   b. API security patterns
   c. Service-to-service security
   d. Secrets management
   e. Data protection and privacy
   f. Security monitoring and threat detection

7. IMPLEMENTATION ROADMAP:
   a. Phased implementation approach
   b. Migration strategy from existing systems
   c. Incremental delivery plan
   d. Risk mitigation strategies
   e. Proof of concept recommendations

RESPONSE STRUCTURE:
1. Begin with an "Executive Summary" providing a high-level architecture overview
2. Include a "Domain Analysis" section outlining the domain model and bounded contexts
3. Provide a "Microservice Architecture" section with:
   a. Architecture diagram (text-based)
   b. Service inventory with responsibilities
   c. Key design decisions and patterns
4. For EACH microservice:
   a. Service name and business capability
   b. API and interface design
   c. Data model and ownership
   d. Technology recommendations
   e. Scaling considerations
5. Include a "Cross-Cutting Concerns" section addressing:
   a. Data consistency strategy
   b. Communication patterns
   c. Security architecture
   d. Monitoring and observability
6. Provide a "Deployment Architecture" section
7. Include an "Implementation Roadmap" with phased approach
8. Conclude with "Key Architecture Decisions" highlighting critical choices

CRITICAL REQUIREMENTS:
1. NEVER design generic microservices without clear business capabilities
2. ALWAYS consider the specific domain context in service boundary decisions
3. NEVER create unnecessary services that increase system complexity
4. ALWAYS address data consistency challenges across service boundaries
5. NEVER ignore communication overhead in microservice architectures
6. ALWAYS consider operational complexity in the design
7. NEVER recommend a microservice architecture when a monolith would be more appropriate

SPECIFIC CONTEXT CONSIDERATIONS:
1. Functional Requirements: ${functionalReqs}
2. Non-Functional Requirements: ${nonFunctionalReqs}
3. Constraints: ${constraintsText}
4. Technology Preferences:
   - Languages: ${languagesText}
   - Databases: ${databasesText}
   - Deployment Platform: ${platformText}
5. Existing Systems: ${existingSystemsText}
6. Team Structure: ${teamStructureText}

Your design must be technically precise, evidence-based, and practically implementable. Focus on creating a microservice architecture that balances business alignment, technical excellence, and operational feasibility.`;

        const userQueryText = `Design a comprehensive microservice architecture for the following domain and requirements:

Domain Description: ${domain_description}

Functional Requirements: ${functionalReqs}
Non-Functional Requirements: ${nonFunctionalReqs}
Constraints: ${constraintsText}

Technology Preferences:
- Languages: ${languagesText}
- Databases: ${databasesText}
- Deployment Platform: ${platformText}

${existing_systems.length > 0 ? `Existing Systems to Integrate: ${existingSystemsText}` : ""}
${team_structure ? `Team Structure: ${teamStructureText}` : ""}

Focus Areas: ${focusAreasText}

Search for and apply domain-driven design principles and microservice best practices to create a detailed architecture design. Your response should include:

1. Domain analysis with identified bounded contexts
2. Complete microservice inventory with clear responsibilities
3. Service boundary justifications and design decisions
4. Data management strategy across services
5. Communication patterns and API design
6. Deployment and operational model
7. Implementation roadmap

For each microservice, provide:
- Business capability and responsibility
- API design and key endpoints
- Data ownership and entity boundaries
- Technology recommendations
- Scaling and resilience considerations

Include a text-based architecture diagram showing the relationships between services. Ensure your design addresses all the specified requirements and focus areas while following microservice best practices.`;

        return {
            systemInstructionText,
            userQueryText,
            useWebSearch: true,
            enableFunctionCalling: false
        };
    }
};