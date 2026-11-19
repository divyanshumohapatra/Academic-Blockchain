'use strict';

const { queryChaincode, checkNetworkHealth } = require('../fabric');
const { checkIPFSHealth } = require('../ipfs');
const fraudAgent = require('./fraudAgent');
const hfClient = require('./hfAgentClient');
const r2 = require('../r2');
const { ROLES } = require('../auth');

class ChatbotAgent {
  constructor() {
    this.name = 'Agent-Ledger-Oracle';
    this.role = 'Conversational Ledger Intelligence & Provenance Assistant';
  }

  /**
   * Process a conversational natural language prompt with Role-Based Access Control
   */
  async processMessage(message, context = {}) {
    const text = message.trim();
    const lower = text.toLowerCase();
    const role = (context.role || 'STUDENT').toUpperCase();
    const userName = context.name || context.user || role;

    // 0. Cloudflare R2 Storage & Presigned Link Queries (Admin Exclusive)
    if (lower.includes('cloudflare') || lower.includes('r2') || (lower.includes('backup') && (lower.includes('storage') || lower.includes('link') || lower.includes('download')))) {
      if (role !== ROLES.ADMIN) {
        return {
          reply: `### 🔒 Access Denied: Cloudflare R2 Enterprise Backup Storage\n\n` +
                 `• **Current Role**: \`${role}\` (${context.org || 'Standard Access'})\n` +
                 `• **Required Role**: \`ADMIN\` (Org 3 Central Administration)\n\n` +
                 `⚠️ Access to Cloudflare R2 enterprise backup storage, bucket introspection, and temporary presigned download links is strictly restricted to authorized Central Administrators.\n\n` +
                 `*To access Cloudflare R2 features, switch your role to **Administrator (Org 3)** in the Chatbot Organization selector.*`,
          intent: 'RBAC_FORBIDDEN',
          role
        };
      }

      // Admin has authorized access to Cloudflare R2!
      let certId = null;
      const certMatch = text.match(/CERT-[A-Za-z0-9-]+/i);
      if (certMatch) {
        certId = certMatch[0].toUpperCase();
      } else {
        const stuMatch = text.match(/STU-[A-Za-z0-9-]+/i);
        if (stuMatch) {
          try {
            const sisDatabase = require('../db/sisDatabase');
            const req = sisDatabase.getCertificateRequestByStudentId(stuMatch[0].toUpperCase());
            if (req && req.details && req.details.certId) {
              certId = req.details.certId;
            }
          } catch (e) {}
        }
      }

      if (certId) {
        try {
          const downloadLink = await r2.getDownloadLink(`certificates/${certId}.pdf`, 900);
          return {
            reply: `### ☁️ Cloudflare R2 Backup Dossier (Authorized: ${userName})\n\n` +
                   `• **Certificate ID**: \`${certId}\`\n` +
                   `• **Bucket**: \`${r2.BUCKET}\`\n` +
                   `• **Primary Storage URI**: \`r2://${r2.BUCKET}/certificates/${certId}.pdf\`\n` +
                   `• **Presigned Download URL** (Valid for 15 minutes):\n` +
                   `  [🔗 Direct Download from Cloudflare R2](${downloadLink})\n\n` +
                   `*Dual-Storage Archival Policy: Active (Primary IPFS Kubo + Cloudflare R2 Enterprise Backup).*`,
            intent: 'R2_BACKUP_LINK',
            data: { certId, downloadLink, role }
          };
        } catch (err) {
          return {
            reply: `⚠️ Error generating Cloudflare R2 download link for ${certId}: ${err.message}`,
            intent: 'R2_ERROR'
          };
        }
      }

      if (lower.includes('link') || lower.includes('download')) {
        return {
          reply: `### ☁️ Cloudflare R2 Presigned Download Link Generator (Authorized: ${userName})\n\n` +
                 `• **Bucket**: \`${r2.BUCKET}\`\n` +
                 `• **Access Level**: Org 3 Central Administrator (Full Authorization)\n\n` +
                 `Please specify the **Certificate ID** or **Student Roll Number** you would like to download (e.g. \`Get Cloudflare R2 link for CERT-2024-001\` or \`Get Cloudflare link for STU-2024-001\`).`,
          intent: 'R2_LINK_HELP',
          data: { role, bucket: r2.BUCKET }
        };
      }

      const r2Health = await r2.checkR2Health();
      return {
        reply: `### ☁️ Cloudflare R2 Enterprise Backup Status (Authorized: ${userName})\n\n` +
               `• **Status**: ${r2Health.healthy ? '🟢 ONLINE & OPERATIONAL' : '🟡 CONFIGURED (SIMULATED)'}\n` +
               `• **Bucket**: \`${r2.BUCKET}\`\n` +
               `• **S3 Endpoint**: \`${r2Health.endpoint || process.env.R2_S3_ENDPOINT}\`\n` +
               `• **Access Tier**: Org 3 Central Administrator Exclusive\n` +
               `• **Policy**: Synchronous dual-pinning along with IPFS Kubo for disaster recovery\n\n` +
               `*Tip: You can ask for a presigned download link by mentioning any Certificate ID (e.g. "Get R2 link for CERT-2024-001").*`,
        intent: 'R2_STATUS',
        data: r2Health
      };
    }

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
