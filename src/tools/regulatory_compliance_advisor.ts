import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const regulatoryComplianceAdvisorTool: ToolDefinition = {
    name: "regulatory_compliance_advisor",
    description: `Provides guidance on regulatory requirements for specific industries (GDPR, HIPAA, etc.). Suggests implementation approaches for compliance. Includes checklists and verification strategies. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'regulations' and 'context'.`,
    inputSchema: {
        type: "object",
        properties: {
            regulations: {
                type: "array",
                items: { type: "string" },
                description: "Regulations to address (e.g., ['GDPR', 'HIPAA', 'PCI DSS', 'CCPA'])."
            },
            context: {
                type: "object",
                properties: {
                    industry: {
                        type: "string",
                        description: "Industry context (e.g., 'healthcare', 'finance', 'e-commerce')."
                    },
                    application_type: {
                        type: "string",
                        description: "Type of application (e.g., 'web app', 'mobile app', 'SaaS platform')."
                    },
                    data_types: {
                        type: "array",
                        items: { type: "string" },
                        description: "Types of data being processed (e.g., ['PII', 'PHI', 'payment data'])."
                    },
                    user_regions: {
                        type: "array",
                        items: { type: "string" },
                        description: "Regions where users are located (e.g., ['EU', 'US', 'Canada'])."
                    }
                },
                required: ["industry", "application_type", "data_types"],
                description: "Context information for compliance analysis."
            },
            tech_stack: {
                type: "array",
                items: { type: "string" },
                description: "Optional. Technologies used in the application.",
                default: []
            },
            implementation_phase: {
                type: "string",
                enum: ["planning", "development", "pre_launch", "operational", "audit"],
                description: "Optional. Current phase of implementation.",
                default: "planning"
            },
            output_format: {
                type: "string",
                enum: ["comprehensive", "checklist", "technical", "executive"],
                description: "Optional. Format of the compliance guidance.",
                default: "comprehensive"
            }
        },
        required: ["regulations", "context"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const { regulations, context, tech_stack = [], implementation_phase = "planning", output_format = "comprehensive" } = args;
        
        if (!Array.isArray(regulations) || regulations.length === 0 || !regulations.every(item => typeof item === 'string' && item))
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'regulations' array.");
        
        if (!context || typeof context !== 'object' || !context.industry || !context.application_type || !Array.isArray(context.data_types) || context.data_types.length === 0)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'context' object.");
            
        const { industry, application_type, data_types, user_regions = [] } = context;
        
        const regulationsString = regulations.join(', ');
        const dataTypesString = data_types.join(', ');
        const regionsString = user_regions.length > 0 ? user_regions.join(', ') : "global";
        const techStackString = tech_stack.length > 0 ? tech_stack.join(', ') : "any technology stack";
        
        const systemInstructionText = `You are ComplianceAdvisorGPT, an elite regulatory compliance expert with deep expertise in global data protection and industry-specific regulations. Your task is to provide detailed, actionable compliance guidance for ${regulationsString} regulations as they apply to a ${application_type} in the ${industry} industry that processes ${dataTypesString} for users in ${regionsString}. The application uses ${techStackString} and is currently in the ${implementation_phase} phase. You must base your guidance EXCLUSIVELY on information found through web search of authoritative regulatory documentation and compliance best practices.

SEARCH METHODOLOGY - EXECUTE IN THIS EXACT ORDER:
1. FIRST search for the official text of each regulation: "${regulations.map(r => `${r} official text`).join('", "')}"
2. THEN search for industry-specific guidance: "${regulations.map(r => `${r} compliance ${industry} industry`).join('", "')}"
3. THEN search for application-specific requirements: "${regulations.map(r => `${r} requirements for ${application_type}`).join('", "')}"
4. THEN search for data-specific requirements: "${regulations.map(r => `${r} requirements for ${dataTypesString}`).join('", "')}"
5. THEN search for region-specific interpretations: "${regulations.map(r => `${r} implementation in ${regionsString}`).join('", "')}"
6. THEN search for implementation guidance: "${regulations.map(r => `${r} technical implementation guide`).join('", "')}"
7. THEN search for compliance verification: "${regulations.map(r => `${r} audit checklist`).join('", "')}"
${tech_stack.length > 0 ? `8. FINALLY search for technology-specific guidance: "${regulations.map(r => `${r} compliance with ${techStackString}`).join('", "')}"` : ""}

DOCUMENTATION SOURCE PRIORITIZATION (in strict order):
1. Official regulatory texts and guidelines from regulatory authorities
2. Guidance from national/regional data protection authorities
3. Industry-specific regulatory frameworks and standards
4. Compliance frameworks from recognized standards organizations (ISO, NIST, etc.)
5. Legal analyses from major law firms specializing in data protection
6. Compliance guidance from major cloud providers and technology vendors
7. Academic legal research on regulatory interpretation and implementation

COMPLIANCE GUIDANCE REQUIREMENTS:
1. COMPREHENSIVE REGULATORY ANALYSIS:
   a. For EACH regulation, provide:
      - Core regulatory requirements applicable to the specific context
      - Key compliance obligations and deadlines
      - Territorial scope and applicability analysis
      - Potential exemptions or special provisions
      - Enforcement mechanisms and potential penalties
   b. Identify overlaps and conflicts between multiple regulations
   c. Prioritize requirements based on risk and implementation complexity
   d. Address industry-specific interpretations and requirements

2. ACTIONABLE IMPLEMENTATION GUIDANCE:
   a. Provide specific technical and organizational measures for compliance
   b. Include data governance frameworks and policies
   c. Outline data protection by design and default approaches
   d. Detail consent management and data subject rights implementation
   e. Provide data breach notification procedures
   f. Outline documentation and record-keeping requirements
   g. Include specific implementation steps for the current phase (${implementation_phase})

3. EVIDENCE-BASED RECOMMENDATIONS:
   a. Cite specific articles, sections, or recitals from official regulatory texts
   b. Reference authoritative guidance from regulatory bodies
   c. Include case law or enforcement actions when relevant
   d. Acknowledge areas of regulatory uncertainty or evolving interpretation
   e. Distinguish between mandatory requirements and best practices

4. PRACTICAL COMPLIANCE VERIFICATION:
   a. Provide detailed compliance checklists for each regulation
   b. Include audit preparation guidance
   c. Outline documentation requirements for demonstrating compliance
   d. Suggest monitoring and ongoing compliance verification approaches
   e. Include risk assessment methodologies

RESPONSE STRUCTURE:
${output_format === 'comprehensive' ? `1. Begin with an "Executive Summary" providing a high-level compliance assessment
2. Include a "Regulatory Overview" section detailing each regulation's key requirements
3. Provide a "Compliance Gap Analysis" based on the provided context
4. For EACH major compliance area:
   a. Detailed requirements from all applicable regulations
   b. Specific implementation guidance
   c. Technical and organizational measures
   d. Documentation requirements
   e. Verification approach
5. Include a "Compliance Roadmap" with phased implementation plan
6. Provide a "Risk Assessment" section outlining key compliance risks
7. Conclude with "Ongoing Compliance" guidance for maintaining compliance` : ''}

${output_format === 'checklist' ? `1. Begin with a brief "Compliance Context" section
2. Organize requirements into clear, actionable checklist items
3. Group checklist items by regulation and compliance domain
4. For EACH checklist item:
   a. Specific requirement with regulatory reference
   b. Implementation guidance
   c. Evidence/documentation needed
   d. Verification method
5. Include priority levels for each item
6. Provide a compliance tracking template` : ''}

${output_format === 'technical' ? `1. Begin with a "Technical Compliance Requirements" overview
2. Organize by technical implementation domains
3. For EACH technical domain:
   a. Specific regulatory requirements
   b. Technical implementation specifications
   c. Security controls and standards
   d. Testing and validation approaches
   e. Code or configuration examples where applicable
4. Include data flow and processing requirements
5. Provide technical architecture recommendations
6. Include monitoring and logging requirements` : ''}

${output_format === 'executive' ? `1. Begin with a "Compliance Executive Summary"
2. Include a "Key Regulatory Obligations" section
3. Provide a "Compliance Risk Assessment" with risk ratings
4. Include a "Strategic Compliance Roadmap"
5. Outline "Resource Requirements" for compliance
6. Provide "Business Impact Analysis"
7. Conclude with "Executive Recommendations"` : ''}

CRITICAL REQUIREMENTS:
1. NEVER oversimplify complex regulatory requirements
2. ALWAYS distinguish between legal requirements and best practices
3. NEVER provide definitive legal advice without appropriate disclaimers
4. ALWAYS consider the specific context (industry, data types, regions)
5. NEVER overlook key regulatory requirements applicable to the context
6. ALWAYS provide specific, actionable guidance rather than generic statements
7. NEVER claim regulatory certainty in areas of evolving interpretation

Your guidance must be technically precise, evidence-based, and practically implementable. Focus on providing comprehensive compliance guidance that enables effective implementation and risk management while acknowledging the complexities of regulatory compliance.`;

        const userQueryText = `Provide ${output_format} compliance guidance for ${regulationsString} as they apply to a ${application_type} in the ${industry} industry that processes ${dataTypesString} for users in ${regionsString}. The application uses ${techStackString} and is currently in the ${implementation_phase} phase.

Search for authoritative regulatory documentation and compliance best practices from sources like:
- Official regulatory texts and guidelines
- Industry-specific regulatory frameworks
- Guidance from data protection authorities
- Recognized compliance frameworks and standards

For each applicable regulation:
1. Identify specific requirements relevant to this context
2. Provide detailed implementation guidance
3. Include technical and organizational measures
4. Outline documentation and verification approaches
5. Reference specific regulatory provisions

${output_format === 'comprehensive' ? `Structure your response with:
- Executive summary of compliance requirements
- Detailed analysis of each regulation's applicability
- Implementation guidance for each compliance domain
- Compliance verification and documentation requirements
- Phased compliance roadmap` : ''}

${output_format === 'checklist' ? `Structure your response as a detailed compliance checklist with:
- Specific requirements organized by regulation and domain
- Implementation guidance for each checklist item
- Required evidence and documentation
- Verification methods
- Priority levels` : ''}

${output_format === 'technical' ? `Structure your response with focus on technical implementation:
- Technical requirements for each compliance domain
- Specific security controls and standards
- Data handling and processing requirements
- Technical architecture recommendations
- Monitoring and validation approaches` : ''}

${output_format === 'executive' ? `Structure your response for executive stakeholders:
- Executive summary of key compliance obligations
- Strategic risk assessment and business impact
- High-level compliance roadmap
- Resource requirements and recommendations
- Key decision points` : ''}

Ensure your guidance is specific to the context provided, technically accurate, and immediately actionable.`;

        return {
            systemInstructionText,
            userQueryText,
            useWebSearch: true,
            enableFunctionCalling: false
        };
    }
};