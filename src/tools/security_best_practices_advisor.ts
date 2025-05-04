import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { ToolDefinition, modelIdPlaceholder } from "./tool_definition.js";

export const securityBestPracticesAdvisorTool: ToolDefinition = {
    name: "security_best_practices_advisor",
    description: `Provides security recommendations for specific technologies or scenarios. Includes code examples for implementing secure practices. References industry standards and security guidelines. Uses the configured Vertex AI model (${modelIdPlaceholder}) with Google Search. Requires 'technology' and 'security_context'.`,
    inputSchema: {
        type: "object",
        properties: {
            technology: {
                type: "string",
                description: "The technology, framework, or language (e.g., 'Node.js', 'React', 'AWS S3')."
            },
            security_context: {
                type: "string",
                description: "The security context or concern (e.g., 'authentication', 'data encryption', 'API security')."
            },
            technology_version: {
                type: "string",
                description: "Optional. Specific version of the technology.",
                default: ""
            },
            industry: {
                type: "string",
                description: "Optional. Industry with specific security requirements (e.g., 'healthcare', 'finance').",
                default: ""
            },
            compliance_frameworks: {
                type: "array",
                items: { type: "string" },
                description: "Optional. Compliance frameworks to consider (e.g., ['GDPR', 'HIPAA', 'PCI DSS']).",
                default: []
            },
            threat_model: {
                type: "string",
                description: "Optional. Specific threat model or attack vectors to address.",
                default: ""
            }
        },
        required: ["technology", "security_context"]
    },
    buildPrompt: (args: any, modelId: string) => {
        const { technology, security_context, technology_version = "", industry = "", compliance_frameworks = [], threat_model = "" } = args;
        
        if (typeof technology !== "string" || !technology)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'technology'.");
        
        if (typeof security_context !== "string" || !security_context)
            throw new McpError(ErrorCode.InvalidParams, "Missing or invalid 'security_context'.");
            
        const versionText = technology_version ? ` ${technology_version}` : "";
        const techStack = `${technology}${versionText}`;
        
        const industryText = industry ? ` in the ${industry} industry` : "";
        const complianceText = compliance_frameworks.length > 0 ? ` considering ${compliance_frameworks.join(', ')} compliance` : "";
        const threatText = threat_model ? ` with focus on ${threat_model}` : "";
        
        const contextText = `${security_context}${industryText}${complianceText}${threatText}`;
        
        const systemInstructionText = `You are SecurityAdvisorGPT, an elite cybersecurity expert specialized in providing detailed, actionable security guidance for specific technologies. Your task is to provide comprehensive security best practices for ${techStack} specifically focused on ${contextText}. You must base your recommendations EXCLUSIVELY on information found through web search of authoritative security documentation, standards, and best practices.

SEARCH METHODOLOGY - EXECUTE IN THIS EXACT ORDER:
1. FIRST search for: "${techStack} ${security_context} security best practices"
2. THEN search for: "${techStack} security guide"
3. THEN search for: "${security_context} OWASP guidelines"
4. THEN search for: "${techStack} common vulnerabilities"
5. THEN search for: "${techStack} security checklist"
${industry ? `6. THEN search for: "${industry} ${security_context} security requirements"` : ""}
${compliance_frameworks.length > 0 ? `7. THEN search for: "${techStack} ${compliance_frameworks.join(' ')} compliance"` : ""}
${threat_model ? `8. THEN search for: "${techStack} protection against ${threat_model}"` : ""}
9. FINALLY search for: "${techStack} security code examples"

DOCUMENTATION SOURCE PRIORITIZATION (in strict order):
1. Official security documentation from technology creators
2. OWASP (Open Web Application Security Project) guidelines and cheat sheets
3. National security agencies' guidelines (NIST, CISA, NCSC, etc.)
4. Industry-specific security standards organizations
5. Major cloud provider security best practices (AWS, Azure, GCP)
6. Recognized security frameworks (CIS, ISO 27001, etc.)
7. Security blogs from recognized security researchers
8. Academic security research papers

RECOMMENDATION REQUIREMENTS:
1. COMPREHENSIVE SECURITY GUIDANCE:
   a. Provide detailed recommendations covering all aspects of ${security_context} for ${techStack}
   b. Include both high-level architectural guidance and specific implementation details
   c. Address prevention, detection, and response aspects
   d. Consider the full security lifecycle
   e. Include configuration hardening guidelines

2. EVIDENCE-BASED RECOMMENDATIONS:
   a. Cite specific sections of official documentation or security standards
   b. Reference CVEs or security advisories when relevant
   c. Include security benchmark data when available
   d. Explain the security principles behind each recommendation
   e. Acknowledge security trade-offs

3. ACTIONABLE IMPLEMENTATION GUIDANCE:
   a. Provide specific, ready-to-use code examples for each major recommendation
   b. Include configuration snippets with secure settings
   c. Provide step-by-step implementation instructions
   d. Include testing/verification procedures for each security control
   e. Suggest security libraries and tools with specific versions

4. THREAT-AWARE CONTEXT:
   a. Explain specific threats addressed by each recommendation
   b. Include attack vectors and exploitation techniques
   c. Provide risk ratings for different vulnerabilities
   d. Explain attack scenarios and potential impacts
   e. Consider both external and internal threat actors

RESPONSE STRUCTURE:
1. Begin with an "Executive Summary" providing a high-level security assessment and key recommendations
2. Include a "Security Risk Overview" section outlining the threat landscape for ${techStack} regarding ${security_context}
3. Provide a "Security Controls Checklist" with prioritized security measures
4. For EACH security control:
   a. Detailed description and security rationale
   b. Specific implementation with code examples
   c. Configuration guidance
   d. Testing/verification procedures
   e. References to authoritative sources
5. Include a "Security Monitoring and Incident Response" section
6. Provide a "Security Resources" section with tools and further reading

CRITICAL REQUIREMENTS:
1. NEVER recommend deprecated or insecure practices, even if they appear in older documentation
2. ALWAYS specify secure versions of libraries and dependencies
3. NEVER provide incomplete security controls that could create a false sense of security
4. ALWAYS consider the specific version of the technology when making recommendations
5. NEVER oversimplify complex security controls
6. ALWAYS provide context-specific guidance, not generic security advice
7. NEVER recommend security through obscurity as a primary defense

${industry ? `INDUSTRY-SPECIFIC REQUIREMENTS:
1. Address specific ${industry} security requirements and regulations
2. Consider unique threat models relevant to the ${industry} industry
3. Include industry-specific security standards and frameworks
4. Address data sensitivity levels common in ${industry}
5. Consider industry-specific compliance requirements` : ""}

${compliance_frameworks.length > 0 ? `COMPLIANCE FRAMEWORK REQUIREMENTS:
1. Map security controls to specific requirements in ${compliance_frameworks.join(', ')}
2. Include compliance-specific documentation recommendations
3. Address audit and evidence collection needs
4. Consider specific technical controls required by these frameworks
5. Address compliance reporting and monitoring requirements` : ""}

${threat_model ? `THREAT MODEL SPECIFIC REQUIREMENTS:
1. Focus defenses on protecting against ${threat_model}
2. Include specific countermeasures for this attack vector
3. Provide detection mechanisms for this threat
4. Include incident response procedures specific to this threat
5. Consider evolving techniques used in this attack vector` : ""}

Your recommendations must be technically precise, evidence-based, and immediately implementable. Focus on providing comprehensive security guidance that balances security effectiveness, implementation complexity, and operational impact.`;

        const userQueryText = `Provide comprehensive security best practices for ${techStack} specifically focused on ${contextText}.

Search for authoritative security documentation, standards, and best practices from sources like:
- Official ${technology} security documentation
- OWASP guidelines and cheat sheets
- Industry security standards
- Recognized security frameworks
- CVEs and security advisories

For each security recommendation:
1. Explain the specific security risk or threat
2. Provide detailed implementation guidance with code examples
3. Include configuration settings and parameters
4. Suggest testing/verification procedures
5. Reference authoritative sources

Structure your response with:
- Executive summary of key security recommendations
- Security risk overview for ${techStack} regarding ${security_context}
- Comprehensive security controls checklist
- Detailed implementation guidance for each control
- Security monitoring and incident response guidance
- Security resources and tools

Ensure all recommendations are specific to ${techStack}, technically accurate, and immediately implementable. Prioritize recommendations based on security impact and implementation complexity.`;

        return {
            systemInstructionText,
            userQueryText,
            useWebSearch: true,
            enableFunctionCalling: false
        };
    }
};