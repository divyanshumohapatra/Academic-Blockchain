'use strict';

/**
 * ============================================================================
 * Live Multi-Agent Consortium Verification Suite
 * Verifies that EVERY agent performs its assigned task using active API keys:
 *   - GROQ_API_KEY / GROQ_MODEL (Live Groq LPU Inference)
 *   - R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_S3_ENDPOINT (Cloudflare R2)
 * ============================================================================
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');

const hfClient = require('./src/agents/hfAgentClient');
const {
  FacultyAgent,
  FacultyAdvisorAgent,
  HODAgent,
  DACAgent,
  DACMultiSigEngine,
  ExamLockAgent,
  DeanAgent,
  DeanMultiSigEngine,
  AdminFinalizeAgent
} = require('./src/agents/orgAgents');

const {
  MetadataSynthesizerAgent,
  CertificateCryptographerAgent,
  IPFSCustodianAgent,
  LedgerAnchorAgent
} = require('./src/agents/certMintingAgents');

const fraudAgent = require('./src/agents/fraudAgent');
const chatAgent = require('./src/agents/chatAgent');
const masterOrchestrator = require('./src/agents/orchestrator');
const sisDatabase = require('./src/db/sisDatabase');
const r2 = require('./src/r2');

async function runAgentVerification() {
  console.log('\n================================================================');
  console.log('🤖 LIVE CONSORTIUM AGENTS API KEY VERIFICATION SUITE');
  console.log('================================================================\n');

  console.log(`Active Environment Configuration:`);
  console.log(`• GROQ_API_KEY: ${process.env.GROQ_API_KEY ? 'Present (***' + process.env.GROQ_API_KEY.slice(-6) + ')' : 'MISSING'}`);
  console.log(`• GROQ_MODEL:   ${process.env.GROQ_MODEL || 'openai/gpt-oss-20b'}`);
  console.log(`• HF_TOKEN:     ${process.env.HF_TOKEN ? 'Present (***' + process.env.HF_TOKEN.slice(-6) + ')' : 'MISSING'}`);
  console.log(`• R2_BUCKET:    ${process.env.R2_BUCKET_NAME || 'academic-certificates'}`);
  console.log(`• R2_ACCOUNT:   ${process.env.R2_ACCOUNT_ID ? 'Present (***' + process.env.R2_ACCOUNT_ID.slice(-6) + ')' : 'MISSING'}\n`);

  let passed = 0;
  let failed = 0;

  function check(name, condition, meta = '') {
    if (condition) {
      console.log(`  ✅ [PASS] ${name} ${meta ? '→ ' + meta : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name} ${meta ? '→ ' + meta : ''}`);
      failed++;
    }
  }

  const testReqId = 'REQ-LIVE-AUDIT-' + Date.now();
  const testStudentId = 'STU-2024-001';

  // --------------------------------------------------------------------------
  // SECTION 1: Core LLM Engine Direct Probe
  // --------------------------------------------------------------------------
  console.log('--- 1. Direct Engine Probe (hfAgentClient) ---');
  try {
    const rawRes = await hfClient.generateReasoning(
      'You are a verification sentinel. Output JSON: {"status":"OK","role":"Engine Probe"}',
      'Ping verification test',
      { jsonMode: true }
    );
    check('Groq Engine Response Received', !!rawRes && !!rawRes.content, `Source: ${rawRes.source}, Model: ${rawRes.model}`);
    check('Groq Engine Source is GROQ_LIVE_API', rawRes.source === 'GROQ_LIVE_API', `Expected GROQ_LIVE_API, got ${rawRes.source}`);
  } catch (err) {
    check('Groq Engine Response Received', false, err.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 2: Organization 1 Agents (Faculty, Advisor, HOD, DAC)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Org 1: Academic & Faculty Autonomous Agents ---');

  // Agent 1: Faculty Coursework Agent
  try {
    const facultyAgent = new FacultyAgent();
    const res = await facultyAgent.auditAndApprove(testReqId, {
      attendance: 88,
      cieMarks: 24,
      studentId: testStudentId
    });
    check('FacultyAgent (Org 1)', res.success === true, `Source: ${res.aiSource}, Model: ${res.model}, Conf: ${res.confidence}`);
  } catch (e) {
    check('FacultyAgent (Org 1)', false, e.message);
  }

  // Agent 2: Faculty Advisor Comprehensive Gate
  try {
    const faAgent = new FacultyAdvisorAgent();
    const res = await faAgent.auditAndEndorse(testReqId, testStudentId, {
      attendance: 85,
      cieMarks: 22
    });
    check('FacultyAdvisorAgent (Org 1)', res.success === true, `Source: ${res.aiSource}, Model: ${res.model}, Conf: ${res.confidence}`);
  } catch (e) {
    check('FacultyAdvisorAgent (Org 1)', false, e.message);
  }

  // Agent 3: HOD Curriculum Agent
  try {
    const hodAgent = new HODAgent();
    const res = await hodAgent.auditAndApprove(testReqId, {
      totalCredits: 168,
      disciplinaryClearance: true
    });
    check('HODAgent (Org 1)', res.success === true, `Source: ${res.aiSource}, Model: ${res.model}, Conf: ${res.confidence}`);
  } catch (e) {
    check('HODAgent (Org 1)', false, e.message);
  }

  // Agent 4: DAC Academic Committee Multi-Sig Engine
  try {
    const dacEngine = new DACMultiSigEngine();
    const res = await dacEngine.runAutonomousMultiSig(testReqId, {
      capstoneScore: 88,
      originality: 92,
      totalCredits: 168
    });
    check('DACMultiSigEngine (Org 1)', res.quorumMet === true, `Source: ${res.aiSource}, Model: ${res.model}, Quorum: ${res.approvalCount}/${res.requiredQuorum}`);
  } catch (e) {
    check('DACMultiSigEngine (Org 1)', false, e.message);
  }

  // Agent 4b: DACAgent (wrapper)
  try {
    const dacAgent = new DACAgent();
    const res = await dacAgent.auditAndApprove(testReqId, {
      capstoneScore: 85,
      originality: 90,
      totalCredits: 164
    });
    check('DACAgent Wrapper (Org 1)', res.success === true, `Source: ${res.aiSource}, Model: ${res.model}`);
  } catch (e) {
    check('DACAgent Wrapper (Org 1)', false, e.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 3: Organization 2 Agent (Examination Board)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Org 2: Examination Board & Grade Lockdown Agent ---');
  try {
    const examAgent = new ExamLockAgent();
    const res = await examAgent.auditAndLock(testReqId, {
      cgpa: 9.15,
      backlogs: 0
    });
    check('ExamLockAgent (Org 2)', res.success === true, `Source: ${res.aiSource}, Model: ${res.model}, Merkle: ${res.gradesHash ? res.gradesHash.slice(0, 20) + '...' : 'N/A'}`);
  } catch (e) {
    check('ExamLockAgent (Org 2)', false, e.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 4: Organization 3 Agents (Dean Senate, Admin Registrar)
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Org 3: Administration, Senate & Registrar Agents ---');

  // Agent 6: Dean Senate Multi-Sig Engine
  try {
    const deanEngine = new DeanMultiSigEngine();
    const res = await deanEngine.runAutonomousMultiSig(testReqId, {
      residencyMet: true,
      institutionalClearance: true
    });
    check('DeanMultiSigEngine (Org 3)', res.quorumMet === true, `Source: ${res.aiSource}, Model: ${res.model}, Quorum: ${res.approvalCount}/${res.requiredQuorum}`);
  } catch (e) {
    check('DeanMultiSigEngine (Org 3)', false, e.message);
  }

  // Agent 6b: DeanAgent (wrapper)
  try {
    const deanAgent = new DeanAgent();
    const res = await deanAgent.auditAndApprove(testReqId, {
      residencyMet: true,
      institutionalClearance: true
    });
    check('DeanAgent Wrapper (Org 3)', res.success === true, `Source: ${res.aiSource}, Model: ${res.model}`);
  } catch (e) {
    check('DeanAgent Wrapper (Org 3)', false, e.message);
  }

  // Agent 7: Admin Registrar Finalization Agent
  try {
    const adminAgent = new AdminFinalizeAgent();
    const res = await adminAgent.auditAndFinalize(testReqId, {
      feeDues: 0,
      libraryDues: 0
    });
    check('AdminFinalizeAgent (Org 3)', res.success === true, `Source: ${res.aiSource}, Model: ${res.model}, Conf: ${res.confidence}`);
  } catch (e) {
    check('AdminFinalizeAgent (Org 3)', false, e.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 5: Module 4 Autonomous Certificate Minting Agents
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Module 4: Autonomous Minting Ecosystem Agents ---');

  let synthMetadata = null;
  let certArtifact = null;
  let ipfsArtifact = null;
  const testCertId = 'CERT-LIVE-' + Date.now();

  // Agent 8: Metadata & DID Synthesizer
  try {
    const synthAgent = new MetadataSynthesizerAgent();
    const res = await synthAgent.synthesize(testReqId, {
      studentId: testStudentId,
      studentName: 'Alice Johnson',
      cgpa: 9.25,
      department: 'Department of Computer Science & Engineering',
      certType: 'Master of Computer Applications (MCA)'
    });
    synthMetadata = res.metadata;
    check('MetadataSynthesizerAgent', res.success === true, `Source: ${res.aiSource}, Model: ${res.model}, DID: ${res.metadata.studentDid.slice(0, 24)}...`);
  } catch (e) {
    check('MetadataSynthesizerAgent', false, e.message);
  }

  // Agent 9: Certificate Cryptographer (High-density QR & PDF minting)
  try {
    const cryptoAgent = new CertificateCryptographerAgent();
    const res = await cryptoAgent.generateArtifact(testCertId, testReqId, synthMetadata);
    certArtifact = res;
    check('CertificateCryptographerAgent', res.success === true, `Source: ${res.aiSource}, Model: ${res.model}, PDF Size: ${res.byteLength} bytes`);
  } catch (e) {
    check('CertificateCryptographerAgent', false, e.message);
  }

  // Agent 10: IPFS Custodian & Cloudflare R2 Dual-Storage Backup Agent
  try {
    const ipfsAgent = new IPFSCustodianAgent();
    const res = await ipfsAgent.pinAndAudit(certArtifact.pdfBuffer, testCertId, certArtifact.sha256);
    ipfsArtifact = res;
    check('IPFSCustodianAgent (Dual-Storage)', res.success === true, `Source: ${res.aiSource}, Model: ${res.model}, R2: ${res.r2Uri}`);
    check('Cloudflare R2 Object Uploaded Live', !!res.r2Uri && res.r2Uri.startsWith('r2://'), `R2 Key: ${res.r2Key}`);
  } catch (e) {
    check('IPFSCustodianAgent (Dual-Storage)', false, e.message);
  }

  // Agent 11: Ledger Anchor & Notary Sentinel Agent
  try {
    const anchorAgent = new LedgerAnchorAgent();
    const res = await anchorAgent.anchor({
      certId: testCertId,
      requestId: testReqId,
      studentId: testStudentId,
      certType: synthMetadata.certType,
      ipfsCid: ipfsArtifact.ipfsCid,
      r2Uri: ipfsArtifact.r2Uri,
      sha256Hash: certArtifact.sha256,
      issueDate: synthMetadata.issueDate,
      metadata: synthMetadata
    });
    check('LedgerAnchorAgent', res.success === true, `Source: ${res.aiSource}, Model: ${res.model}, Tx: ${res.txId.slice(0, 20)}...`);
  } catch (e) {
    check('LedgerAnchorAgent', false, e.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 6: Fraud Sentinel & Chatbot Oracle Intelligence
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Fraud Sentinel & Chatbot Oracle ---');

  // Agent 12: Fraud Sentinel Threat Assessment
  try {
    const risk = await fraudAgent.evaluateRisk({
      requestId: testReqId,
      studentId: testStudentId,
      details: { cgpa: 9.15, attendance: 92, backlogs: 0, feeDues: 0, libraryDues: 0, disciplinaryClearance: true }
    });
    check('FraudSentinelAgent Clean Assessment', risk.riskLevel === 'LOW', `Source: ${risk.aiSource}, Model: ${risk.model}, Score: ${risk.riskScore}/100`);

    const attack = await fraudAgent.simulateScenario('GRADE_TAMPER', testReqId);
    check('FraudSentinelAgent Attack Detection', attack.riskLevel === 'CRITICAL' || attack.riskScore > 70, `Threat Category: ${attack.threatCategory}, Score: ${attack.riskScore}/100`);
  } catch (e) {
    check('FraudSentinelAgent', false, e.message);
  }

  // Agent 13: Chatbot Agent Conversational Oracle with LLM Reasoning
  try {
    const chatRes = await chatAgent.processMessage(
      'Explain how the 3-Organization consortium reaches consensus for certificate issuance.',
      { role: 'STUDENT', name: 'Alice' }
    );
    check('ChatbotAgent LLM Reasoning Response', !!chatRes.reply && chatRes.intent === 'AI_EXPLANATION', `Source: ${chatRes.source}`);
  } catch (e) {
    check('ChatbotAgent LLM Reasoning Response', false, e.message);
  }

  // --------------------------------------------------------------------------
  // SECTION 7: Full 1-Click Autonomous Multi-Agent Pipeline End-to-End
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Master Consortium Autonomous Multi-Agent Pipeline ---');
  try {
    const e2eReqId = 'REQ-LIVE-E2E-' + Date.now();
    sisDatabase.saveCertificateRequest({
      requestId: e2eReqId,
      studentId: testStudentId,
      studentName: 'Alice Johnson',
      studentDid: 'did:academic:a038a2bdb75e4eca20c7efcf34c62fa57f7bd1be',
      department: 'Department of Computer Science & Engineering',
      certType: 'Master of Computer Applications (MCA)',
      details: {
        cgpa: 9.15,
        attendance: 92,
        cieMarks: 46,
        totalCredits: 164,
        capstoneScore: 92,
        originality: 96,
        backlogs: 0,
        feeDues: 0,
        libraryDues: 0,
        disciplinaryClearance: true,
        residencyMet: true,
        institutionalClearance: true
      }
    });

    const pipelineRes = await masterOrchestrator.runAutonomousPipeline(e2eReqId, {
      autoIssue: true,
      certId: 'CERT-E2E-' + Date.now()
    });

    check('Master Multi-Agent Pipeline Completed', pipelineRes.success === true, `Final Status: ${pipelineRes.finalStatus}, Steps: ${pipelineRes.executionLogs.length}`);
    check('Pipeline Minted Certificate & Anchored', !!pipelineRes.issuanceResult, `CertId: ${pipelineRes.issuanceResult?.certId}, CID: ${pipelineRes.issuanceResult?.ipfsCid?.slice(0, 16)}...`);

    const allStepsGroq = pipelineRes.executionLogs.filter(l => l.aiSource === 'GROQ_LIVE_API');
    check('Consortium Pipeline Steps Powered by Groq', allStepsGroq.length >= 7, `${allStepsGroq.length} workflow steps verified live on Groq`);
  } catch (e) {
    check('Master Multi-Agent Pipeline Completed', false, e.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 AGENT VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAgentVerification().catch(err => {
  console.error('Fatal agent verification error:', err);
  process.exit(1);
});
