'use strict';

const { queryChaincode, checkNetworkHealth } = require('../fabric');
const { checkIPFSHealth } = require('../ipfs');
const fraudAgent = require('./fraudAgent');
const hfClient = require('./hfAgentClient');

class ChatbotAgent {
  constructor() {
    this.name = 'Agent-Ledger-Oracle';
    this.role = 'Conversational Ledger Intelligence & Provenance Assistant';
  }

  /**
   * Process a conversational natural language prompt and return rich blockchain insights
   */
  async processMessage(message) {
    const text = message.trim();
    const lower = text.toLowerCase();

    // 1. Network Health & Topology Query
    if (lower.includes('health') || (lower.includes('status') && (lower.includes('network') || lower.includes('system') || lower.includes('peer')))) {
      const network = await checkNetworkHealth();
      const ipfs = await checkIPFSHealth();
      return {
        reply: `Consortium Status: **${network.allHealthy ? '🟢 ALL SYSTEMS OPERATIONAL' : '🟡 PARTIAL DEGRADATION'}**.\n\n` +
               `• **Fabric Peers Active**: peer0.org1 (Port 7051), peer0.org2 (Port 8051), peer0.org3 (Port 9051)\n` +
               `• **Consensus Engine**: Raft Orderer (Port 7050, TLS Enabled)\n` +
               `• **IPFS Storage Node**: ${ipfs.healthy ? '🟢 Kubo v0.24 Online (Port 5001/8080)' : '🔴 Offline'}\n` +
               `• **State Databases**: CouchDB0 (Org1), CouchDB1 (Org2), CouchDB2 (Org3)`,
        intent: 'NETWORK_HEALTH',
        data: { network, ipfs }
      };
    }

    // 2. Extract IDs using Regex
    const certMatch = text.match(/CERT-[A-Za-z0-9-]+/i);
    const reqMatch = text.match(/REQ-[A-Za-z0-9-]+/i);
    const stuMatch = text.match(/STU-[A-Za-z0-9-]+/i);
    const hashMatch = text.match(/\b[a-fA-F0-9]{64}\b/);

    // 3. Certificate Verification / Lookup
    if (certMatch) {
      const certId = certMatch[0].toUpperCase();
      try {
        const certRes = await queryChaincode('VerifyCertificate', [certId]);
        if (!certRes || !certRes.certificate) {
          return {
            reply: `⚠️ Certificate **${certId}** was not found on the Hyperledger Fabric ledger. It may not have been issued yet.`,
            intent: 'CERT_NOT_FOUND'
          };
        }

        const cert = certRes.certificate;
        const statusIcon = cert.status === 'ISSUED' ? '✅ VALID & ISSUED' : '❌ REVOKED';

        return {
          reply: `### 🎓 Certificate Verification: ${cert.certId}\n\n` +
                 `• **Status**: ${statusIcon}\n` +
                 `• **Student**: ${cert.studentName} (${cert.studentId})\n` +
                 `• **Department**: ${cert.department}\n` +
                 `• **Degree Awarded**: ${cert.certType}\n` +
                 `• **Issuing Authority**: ${cert.issuerMSP} (Org 3 Registrar)\n` +
                 `• **IPFS Content Identifier (CID)**: \`${cert.ipfsHash}\`\n` +
                 `• **On-Chain SHA-256 Digest**: \`${cert.docHash}\`\n` +
                 `• **Date of Issuance**: ${cert.issueDate}\n\n` +
                 `*This record is cryptographically anchored and immutable across all consortium peers.*`,
          intent: 'CERT_VERIFIED',
          data: cert
        };
      } catch (err) {
        return { reply: `Error querying certificate ${certId}: ${err.message}`, intent: 'ERROR' };
      }
    }

    // 4. SHA-256 Hash Verification
    if (hashMatch) {
      const hash = hashMatch[0];
      try {
        const certRes = await queryChaincode('VerifyCertificateByHash', [hash]);
        if (!certRes || !certRes.certificate) {
          return {
            reply: `⚠️ No certificate matching SHA-256 digest \`${hash}\` was found on the ledger. Document may be forged or untracked.`,
            intent: 'HASH_NOT_FOUND'
          };
        }

        const cert = certRes.certificate;
        return {
          reply: `✅ **Cryptographic Hash Match Confirmed!**\n\n` +
                 `• **Certificate ID**: \`${cert.certId}\`\n` +
                 `• **Recipient**: ${cert.studentName} (${cert.studentId})\n` +
                 `• **Status**: ${cert.status}\n` +
                 `• **IPFS CID**: \`${cert.ipfsHash}\`\n` +
                 `• **Anchor Tx Timestamp**: ${cert.createdAt}`,
          intent: 'HASH_VERIFIED',
          data: cert
        };
      } catch (err) {
        return { reply: `Error querying hash: ${err.message}`, intent: 'ERROR' };
      }
    }

    // 5. Certificate Request Status & Approval Timeline
    if (reqMatch) {
      const reqId = reqMatch[0].toUpperCase();
      try {
        const reqRes = await queryChaincode('GetCertificateRequest', [reqId]);
        if (!reqRes) {
          return {
            reply: `⚠️ Request **${reqId}** does not exist on the ledger.`,
            intent: 'REQ_NOT_FOUND'
          };
        }

        const reqObj = typeof reqRes === 'string' ? JSON.parse(reqRes) : reqRes;
        const historySteps = (reqObj.history || []).map(h =>
          `  - **Stage [${h.stage}]**: Approved by \`${h.updatedBy}\` at _${h.timestamp}_\n    ↳ _"${h.comments}"_`
        ).join('\n');

        const fraudCheck = await fraudAgent.evaluateRisk(reqObj);

        return {
          reply: `### 📋 Request Dossier: ${reqObj.requestId}\n\n` +
                 `• **Current Stage**: \`${reqObj.status}\`\n` +
                 `• **Student ID**: ${reqObj.studentId}\n` +
                 `• **Degree Requested**: ${reqObj.certType}\n` +
                 `• **Autonomous Fraud Risk**: **${fraudCheck.riskScore}/100 (${fraudCheck.riskLevel})**\n\n` +
                 `#### 🕒 Multi-Org Approval Provenance:\n${historySteps}\n\n` +
                 `*Next Step*: ${reqObj.status === 'ADMIN_FINALIZED' ? 'Ready for IPFS/Fabric Certificate Minting' : 'Awaiting next organizational agent audit.'}`,
          intent: 'REQ_FOUND',
          data: { request: reqObj, fraudCheck }
        };
      } catch (err) {
        return { reply: `Error querying request ${reqId}: ${err.message}`, intent: 'ERROR' };
      }
    }

    // 6. Student Profile Lookup
    if (stuMatch) {
      const stuId = stuMatch[0].toUpperCase();
      try {
        const stuRes = await queryChaincode('GetStudent', [stuId]);
        if (!stuRes) {
          return {
            reply: `⚠️ Student **${stuId}** is not registered on the Fabric ledger.`,
            intent: 'STUDENT_NOT_FOUND'
          };
        }

        const stu = typeof stuRes === 'string' ? JSON.parse(stuRes) : stuRes;
        return {
          reply: `### 🎓 Student Profile: ${stu.name}\n\n` +
                 `• **Student ID**: \`${stu.studentId}\`\n` +
                 `• **Department**: ${stu.department}\n` +
                 `• **Email**: ${stu.email}\n` +
                 `• **Enrollment Year**: ${stu.enrollmentYear}\n` +
                 `• **Registered At**: ${stu.registeredAt}`,
          intent: 'STUDENT_FOUND',
          data: stu
        };
      } catch (err) {
        return { reply: `Error querying student ${stuId}: ${err.message}`, intent: 'ERROR' };
      }
    }

    // 7. General Questions -> Route to Real Hugging Face LLM Agent
    const systemPrompt = `You are the Academic Blockchain AI Assistant and Consortium Knowledge Oracle.
The system is built on Hyperledger Fabric 2.5 with a 3-Organization Consortium:
- Org 1 (University/Faculty): Manages student registration, Faculty, HOD, and DAC approvals.
- Org 2 (Examination Board): Manages Grade Registry lockdown and SHA-256 Merkle transcript digests.
- Org 3 (Administration): Manages Dean approval, Registrar finalization, and IPFS/Fabric certificate minting.
Storage: Decentralized IPFS Kubo node.
Consensus: Raft Crash Fault-Tolerant Ordering.

Answer user questions accurately, professionally, and concisely in markdown format.`;

    const llmAnswer = await hfClient.generateReasoning(systemPrompt, text, { max_tokens: 300 });

    return {
      reply: `${llmAnswer.content}\n\n*(Powered by ${llmAnswer.model || 'Autonomous Consortium AI'})*`,
      intent: 'AI_EXPLANATION',
      source: llmAnswer.source
    };
  }
}

module.exports = new ChatbotAgent();
