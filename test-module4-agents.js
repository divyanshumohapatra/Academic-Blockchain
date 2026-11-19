'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const app = require('./backend/src/server');
const sis = require('./backend/src/db/sisDatabase');
const {
  MetadataSynthesizerAgent,
  CertificateCryptographerAgent,
  IPFSCustodianAgent,
  LedgerAnchorAgent,
  CertMintingMultiAgentEngine
} = require('./backend/src/agents/certMintingAgents');

function mockRequest(method, url, body = null) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = { 'content-type': 'application/json' };

    let statusCode = 200;
    const resHeaders = {};

    const res = new EventEmitter();
    res.setHeader = (k, v) => { resHeaders[k] = v; };
    res.getHeader = (k) => resHeaders[k];
    res.status = (code) => { statusCode = code; return res; };
    res.json = (data) => {
      resolve({ status: statusCode, headers: resHeaders, body: data });
    };
    res.send = (data) => {
      resolve({ status: statusCode, headers: resHeaders, body: data });
    };
    res.end = (data) => {
      resolve({ status: statusCode, headers: resHeaders, body: data });
    };

    req.body = body;
    app(req, res);
  });
}

async function runModule4AgentTests() {
  console.log('🧪 Starting Module 4 Multi-Agent Verification Suite...\n');

  const randId = Math.floor(1000 + Math.random() * 9000);
  const testStudentId = `STU-AGENT-${randId}`;
  const testRequestId = `REQ-AGENT-${randId}`;
  const testCertId = `CERT-AGENT-${randId}`;

  // Enroll test student
  sis.addOrUpdateStudent({
    studentId: testStudentId,
    name: 'Siddharth Varma',
    email: `siddharth.${randId}@academic.edu`,
    department: 'Computer Science & Engineering',
    enrollmentYear: '2024',
    attendance: 94.5,
    cieMarks: 48,
    totalCredits: 168,
    requiredCredits: 160,
    cgpa: 9.42,
    backlogs: 0,
    capstoneScore: 95,
    originalityReport: 97,
    feeDues: 0,
    libraryDues: 0
  });

  sis.saveCertificateRequest({
    requestId: testRequestId,
    studentId: testStudentId,
    studentName: 'Siddharth Varma',
    studentDid: `did:academic:org1:${testStudentId}`,
    certType: 'Master of Technology (M.Tech CSE)',
    department: 'Computer Science & Engineering',
    status: 'ADMIN_FINALIZED',
    details: {
      studentId: testStudentId,
      name: 'Siddharth Varma',
      cgpa: 9.42
    }
  });

  // =========================================================================
  // Test 1: Unit Test Individual Agents
  // =========================================================================
  console.log('--> [Test 1] Testing Individual Module 4 Agents...');

  // 1. Metadata Synthesizer
  const metaAgent = new MetadataSynthesizerAgent();
  const metaRes = await metaAgent.synthesize(testRequestId, {
    studentId: testStudentId,
    studentName: 'Siddharth Varma',
    cgpa: 9.42
  });
  assert.strictEqual(metaRes.success, true);
  assert.ok(metaRes.metadata.studentDid.startsWith('did:academic:'));
  assert.strictEqual(metaRes.metadata.distinction, 'First Class with Distinction');
  console.log(`   ✅ Agent 1 (Metadata): DID=${metaRes.metadata.studentDid.substring(0, 22)}... | Distinction="${metaRes.metadata.distinction}"`);

  // 2. Certificate Cryptographer
  const cryptoAgent = new CertificateCryptographerAgent();
  const cryptoRes = await cryptoAgent.generateArtifact(testCertId, testRequestId, metaRes.metadata);
  assert.strictEqual(cryptoRes.success, true);
  assert.ok(Buffer.isBuffer(cryptoRes.pdfBuffer) && cryptoRes.byteLength > 2000);
  assert.strictEqual(typeof cryptoRes.sha256, 'string');
  assert.strictEqual(cryptoRes.sha256.length, 64);
  console.log(`   ✅ Agent 2 (Cryptographer): PDF=${cryptoRes.byteLength} bytes | SHA-256=${cryptoRes.sha256.substring(0, 16)}...`);

  // 3. IPFS Custodian
  const ipfsAgent = new IPFSCustodianAgent();
  const ipfsRes = await ipfsAgent.pinAndAudit(cryptoRes.pdfBuffer, testCertId, cryptoRes.sha256);
  assert.strictEqual(ipfsRes.success, true);
  assert.ok(ipfsRes.ipfsCid.startsWith('Qm'));
  assert.ok(ipfsRes.roundTripAudit.includes('PASS') || ipfsRes.roundTripAudit.includes('VERIFIED'));
  console.log(`   ✅ Agent 3 (IPFS Custodian): CID=${ipfsRes.ipfsCid} | AuditStatus=${ipfsRes.roundTripAudit}`);

  // 4. Ledger Anchor Agent
  const anchorAgent = new LedgerAnchorAgent();
  const anchorRes = await anchorAgent.anchor({
    certId: testCertId,
    requestId: testRequestId,
    studentId: testStudentId,
    certType: metaRes.metadata.certType,
    ipfsCid: ipfsRes.ipfsCid,
    sha256Hash: cryptoRes.sha256,
    issueDate: metaRes.metadata.issueDate,
    metadata: metaRes.metadata
  });
  assert.strictEqual(anchorRes.success, true);
  assert.ok(anchorRes.txId);
  console.log(`   ✅ Agent 4 (Ledger Anchor): Anchored on ledger | TxID=${anchorRes.txId}`);

  // Verify SQLite certificates table contains the newly anchored certificate
  const dbCert = sis.getCertificate(testCertId);
  assert.ok(dbCert, 'Certificate must exist in SQLite certificates table');
  assert.strictEqual(dbCert.ipfsHash, ipfsRes.ipfsCid);
  assert.strictEqual(dbCert.docHash, cryptoRes.sha256);
  console.log(`   ✅ SQLite Verification: Saved cert ${testCertId} with valid IPFS hash and docHash`);

  // =========================================================================
  // Test 2: End-to-End Module 4 Multi-Agent Engine
  // =========================================================================
  console.log('\n--> [Test 2] Testing Master CertMintingMultiAgentEngine Orchestration...');
  const testCertId2 = `CERT-MINT-ENGINE-${randId}`;
  const engine = new CertMintingMultiAgentEngine();
  const engineResult = await engine.mintCertificate(testCertId2, testRequestId, {
    studentId: testStudentId,
    studentName: 'Siddharth Varma'
  });

  assert.strictEqual(engineResult.success, true);
  assert.strictEqual(engineResult.executionLogs.length, 4);
  assert.strictEqual(engineResult.executionLogs[0].step, 'METADATA_SYNTHESIZED');
  assert.strictEqual(engineResult.executionLogs[1].step, 'PDF_CRYPTOGRAPHICALLY_SEALED');
  assert.strictEqual(engineResult.executionLogs[2].step, 'IPFS_STORAGE_AUDITED');
  assert.strictEqual(engineResult.executionLogs[3].step, 'FABRIC_LEDGER_ANCHORED');
  assert.ok(engineResult.ipfsCid.startsWith('Qm'));
  assert.strictEqual(engineResult.sha256Hash.length, 64);
  console.log(`   ✅ Engine Execution Logs: ${engineResult.executionLogs.map(l => l.step).join(' ──> ')}`);

  // =========================================================================
  // Test 3: API Endpoint Integration & Dual Aliases
  // =========================================================================
  console.log('\n--> [Test 3] Testing REST API /api/certificates/issue with Multi-Agent Workflow...');
  const testCertId3 = `CERT-API-ISSUE-${randId}`;
  const issueRes = await mockRequest('POST', '/api/certificates/issue', {
    certId: testCertId3,
    requestId: testRequestId,
    studentId: testStudentId,
    certType: 'Master of Technology (M.Tech CSE)'
  });

  assert.strictEqual(issueRes.status, 201);
  assert.strictEqual(issueRes.body.success, true);
  assert.ok(issueRes.body.ipfsCid && issueRes.body.ipfsCid.startsWith('Qm'));
  assert.ok(issueRes.body.ipfsHash && issueRes.body.ipfsHash.startsWith('Qm'));
  assert.ok(issueRes.body.sha256Hash && issueRes.body.sha256Hash.length === 64);
  assert.ok(issueRes.body.docHash && issueRes.body.docHash.length === 64);
  assert.ok(Array.isArray(issueRes.body.executionLogs) && issueRes.body.executionLogs.length === 4);
  console.log(`   ✅ /api/certificates/issue returned dual hash aliases and 4 agent execution logs`);

  // =========================================================================
  // Test 4: Ledger Explorer Verification (Must never show empty IPFS CID or docHash)
  // =========================================================================
  console.log('\n--> [Test 4] Testing Ledger Explorer /api/certificates Output...');
  const certsRes = await mockRequest('GET', '/api/certificates');
  assert.strictEqual(certsRes.status, 200);
  assert.ok(Array.isArray(certsRes.body));
  assert.ok(certsRes.body.length >= 3);

  let missingCount = 0;
  for (const c of certsRes.body) {
    if (!c.ipfsHash || !c.docHash || !c.ipfsCid || !c.sha256Hash) {
      missingCount++;
      console.error(`   ❌ Empty hash found in cert ${c.certId}`);
    }
  }

  assert.strictEqual(missingCount, 0, 'Zero certificates on Ledger Explorer must have empty IPFS CID or docHash');
  console.log(`   ✅ Verified ${certsRes.body.length} certificates on Ledger Explorer: 0 empty hashes!`);

  console.log('\n🎉 ALL MODULE 4 MULTI-AGENT WORKFLOW & LEDGER EXPLORER TESTS PASSED!\n');
}

runModule4AgentTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
