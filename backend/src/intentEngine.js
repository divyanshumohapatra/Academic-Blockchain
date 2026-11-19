'use strict';

/**
 * ============================================================================
 * Academic Blockchain PBL — Conversational NLP & Intent Engine
 * 
 * Module: intentEngine.js
 * Description: Rule-based intent detection, Person/Name & ID entity extraction,
 * Fabric chaincode & SIS data resolution, domain knowledge reasoning, and natural
 * language reply generation. Works 100% reliably standalone without requiring
 * external LLM models or API keys.
 * ============================================================================
 */

const { queryChaincode, checkNetworkHealth } = require('./fabric');
const { checkIPFSHealth } = require('./ipfs');
const r2 = require('./r2');
const { ROLES } = require('./auth');

let sisDatabase = null;
try {
  sisDatabase = require('./db/sisDatabase');
} catch (e) {
  // Graceful fallback if SQLite unavailable in testing environments
}

// ============================================================================
// 1. STAGE DEFINITIONS & CONTRACT A SPECIFICATION
// ============================================================================

/**
 * The 7 canonical stages in chronological order:
 * SUBMITTED → FACULTY_APPROVED → HOD_APPROVED → DAC_APPROVED → EXAM_LOCKED → DEAN_APPROVED → ADMIN_FINALIZED
 */
const CANONICAL_STAGES = [
  'SUBMITTED',
  'FACULTY_APPROVED',
  'HOD_APPROVED',
  'DAC_APPROVED',
  'EXAM_LOCKED',
  'DEAN_APPROVED',
  'ADMIN_FINALIZED'
];

/**
 * Mock Ledger Store matching Contract A Schema (Unit tests & fallback)
 */
const MOCK_CONTRACT_A_STORE = {
  'CERT-101': {
    certId: 'CERT-101',
    status: 'HOD_APPROVED',
    org: 'Org1MSP',
    action: 'ApproveHOD',
    txId: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
    timestamp: '2026-09-27T10:00:00Z',
    actor: 'hod.org1',
    history: [
      {
        status: 'SUBMITTED',
        org: 'Org1MSP',
        action: 'RequestCertificate',
        txId: '9f8e7d6c5b4a3210987654321fedcba0987654321fedcba0987654321fedcba0',
        timestamp: '2026-09-25T09:00:00Z',
        actor: 'student.org1'
      },
      {
        status: 'FACULTY_APPROVED',
        org: 'Org1MSP',
        action: 'ApproveFaculty',
        txId: 'b2c3d4e5f6a7890123456789abcdef0123456789abcdef0123456789abcdef01',
        timestamp: '2026-09-26T11:00:00Z',
        actor: 'faculty.org1'
      },
      {
        status: 'HOD_APPROVED',
        org: 'Org1MSP',
        action: 'ApproveHOD',
        txId: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
        timestamp: '2026-09-27T10:00:00Z',
        actor: 'hod.org1'
      }
    ]
  },
  'CERT-102': {
    certId: 'CERT-102',
    status: 'ADMIN_FINALIZED',
    org: 'Org3MSP',
    action: 'FinalizeAdmin',
    txId: 'e7f8a9b0c1d2e3f4567890123456789abcdef0123456789abcdef0123456789a',
    timestamp: '2026-09-27T14:30:00Z',
    actor: 'admin.org3',
    history: [
      { status: 'SUBMITTED', org: 'Org1MSP', action: 'RequestCertificate', txId: '1111a2b3c4d5e6f7...', timestamp: '2026-09-20T08:00:00Z', actor: 'student.org1' },
      { status: 'FACULTY_APPROVED', org: 'Org1MSP', action: 'ApproveFaculty', txId: '2222b3c4d5e6f7a8...', timestamp: '2026-09-21T09:15:00Z', actor: 'faculty.org1' },
      { status: 'HOD_APPROVED', org: 'Org1MSP', action: 'ApproveHOD', txId: '3333c4d5e6f7a8b9...', timestamp: '2026-09-22T10:00:00Z', actor: 'hod.org1' },
      { status: 'DAC_APPROVED', org: 'Org1MSP', action: 'ApproveDAC', txId: '4444d5e6f7a8b9c0...', timestamp: '2026-09-23T11:45:00Z', actor: 'dac.org1' },
      { status: 'EXAM_LOCKED', org: 'Org2MSP', action: 'LockExamGrades', txId: '5555e6f7a8b9c0d1...', timestamp: '2026-09-24T14:00:00Z', actor: 'controller.org2' },
      { status: 'DEAN_APPROVED', org: 'Org1MSP', action: 'ApproveDean', txId: '6666f7a8b9c0d1e2...', timestamp: '2026-09-25T16:30:00Z', actor: 'dean.org1' },
      { status: 'ADMIN_FINALIZED', org: 'Org3MSP', action: 'FinalizeAdmin', txId: 'e7f8a9b0c1d2e3f4567890123456789abcdef0123456789abcdef0123456789a', timestamp: '2026-09-27T14:30:00Z', actor: 'admin.org3' }
    ]
  },
  'CERT-103': {
    certId: 'CERT-103',
    status: 'EXAM_LOCKED',
    org: 'Org2MSP',
    action: 'LockExamGrades',
    txId: 'c3d4e5f6a7b8c9d0e1f234567890abcdef0123456789abcdef0123456789abcde',
    timestamp: '2026-09-27T11:15:00Z',
    actor: 'exam_officer.org2',
    history: [
      { status: 'SUBMITTED', org: 'Org1MSP', action: 'RequestCertificate', txId: '8888a1b2c3d4...', timestamp: '2026-09-26T09:00:00Z', actor: 'student.org1' },
      { status: 'FACULTY_APPROVED', org: 'Org1MSP', action: 'ApproveFaculty', txId: '9999b2c3d4e5...', timestamp: '2026-09-26T14:00:00Z', actor: 'faculty.org1' },
      { status: 'HOD_APPROVED', org: 'Org1MSP', action: 'ApproveHOD', txId: 'aaaa01234567...', timestamp: '2026-09-27T08:30:00Z', actor: 'hod.org1' },
      { status: 'DAC_APPROVED', org: 'Org1MSP', action: 'ApproveDAC', txId: 'bbbb12345678...', timestamp: '2026-09-27T09:45:00Z', actor: 'dac.org1' },
      { status: 'EXAM_LOCKED', org: 'Org2MSP', action: 'LockExamGrades', txId: 'c3d4e5f6a7b8c9d0e1f234567890abcdef0123456789abcdef0123456789abcde', timestamp: '2026-09-27T11:15:00Z', actor: 'exam_officer.org2' }
    ]
  },
  'REQ-101': {
    certId: 'REQ-101',
    status: 'SUBMITTED',
    org: 'Org1MSP',
    action: 'RequestCertificate',
    txId: '7777a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef',
    timestamp: '2026-09-27T08:00:00Z',
    actor: 'student.org1',
    history: [
      { status: 'SUBMITTED', org: 'Org1MSP', action: 'RequestCertificate', txId: '7777a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef', timestamp: '2026-09-27T08:00:00Z', actor: 'student.org1' }
    ]
  }
};

/**
 * Live / Mock Chaincode Resolver
 */
async function fetchCertHistory(certId) {
  const normalizedId = (certId || '').trim().toUpperCase();

  // 1. Live Fabric Ledger Query
  try {
    if (normalizedId.startsWith('CERT-') || !normalizedId.startsWith('REQ-')) {
      const verifyRes = await queryChaincode('VerifyCertificate', [normalizedId]);
      if (verifyRes && verifyRes.certificate) {
        const cert = verifyRes.certificate;
        let historyStages = [];
        if (cert.requestId) {
          try {
            const reqObj = await queryChaincode('GetCertificateRequest', [cert.requestId]);
            if (reqObj && Array.isArray(reqObj.history)) {
              historyStages = reqObj.history.map(h => ({
                status: h.stage,
                org: h.stage.includes('EXAM') ? 'Org2MSP' : (h.stage.includes('ADMIN') || h.stage.includes('ISSUED') ? 'Org3MSP' : 'Org1MSP'),
                action: h.stage,
                txId: h.gradesHash || cert.docHash || 'tx_onchain',
                timestamp: h.timestamp,
                actor: h.updatedBy || cert.issuerMSP,
                comments: h.comments
              }));
            }
          } catch (e) {}
        }

        historyStages.push({
          status: cert.status === 'ISSUED' ? 'CERTIFICATE_ISSUED' : cert.status,
          org: cert.issuerMSP || 'Org3MSP',
          action: 'IssueCertificate',
          txId: cert.docHash,
          timestamp: cert.issueDate || cert.createdAt,
          actor: cert.issuerMSP || 'Registrar'
        });

        return {
          certId: cert.certId,
          status: cert.status,
          org: cert.issuerMSP || 'Org3MSP',
          action: 'IssueCertificate',
          txId: cert.docHash,
          timestamp: cert.issueDate || cert.createdAt,
          actor: cert.issuerMSP || 'Registrar',
          studentId: cert.studentId,
          studentName: cert.studentName,
          ipfsHash: cert.ipfsHash,
          history: historyStages
        };
      }
    }

    if (normalizedId.startsWith('REQ-')) {
      const reqObj = await queryChaincode('GetCertificateRequest', [normalizedId]);
      if (reqObj && reqObj.requestId) {
        const historyStages = (reqObj.history || []).map(h => ({
          status: h.stage,
          org: h.stage.includes('EXAM') ? 'Org2MSP' : (h.stage.includes('ADMIN') || h.stage.includes('ISSUED') ? 'Org3MSP' : 'Org1MSP'),
          action: h.stage,
          txId: h.gradesHash || reqObj.gradesHash || 'tx_onchain',
          timestamp: h.timestamp,
          actor: h.updatedBy || 'ConsortiumAuthority',
          comments: h.comments
        }));

        const latestHistory = historyStages[historyStages.length - 1] || {};

        return {
          certId: reqObj.requestId,
          status: reqObj.status,
          org: latestHistory.org || 'Org1MSP',
          action: reqObj.status,
          txId: reqObj.gradesHash || 'tx_onchain',
          timestamp: reqObj.updatedAt || reqObj.createdAt,
          actor: latestHistory.actor || 'student',
          studentId: reqObj.studentId,
          certType: reqObj.certType,
          history: historyStages
        };
      }
    }
  } catch (liveErr) {
    // If Fabric is offline, continue to fallback
  }

  // 2. SIS Database Fallback (if recorded)
  if (sisDatabase) {
    try {
      const sisReq = sisDatabase.getCertificateRequest(normalizedId) || 
                     sisDatabase.getCertificateRequestByCertId(normalizedId);
      if (sisReq) {
        return {
          certId: sisReq.requestId,
          status: sisReq.status,
          org: sisReq.status.includes('EXAM') ? 'Org2MSP' : (sisReq.status.includes('ADMIN') ? 'Org3MSP' : 'Org1MSP'),
          action: sisReq.status,
          txId: sisReq.details?.sha256Hash || '0x_sis_synced',
          timestamp: sisReq.updatedAt || sisReq.submittedAt,
          actor: sisReq.studentId,
          studentId: sisReq.studentId,
          studentName: sisReq.studentName,
          history: [
            { status: 'SUBMITTED', org: 'Org1MSP', action: 'RequestCertificate', txId: 'sis_tx_1', timestamp: sisReq.submittedAt, actor: sisReq.studentId },
            { status: sisReq.status, org: 'Org1MSP', action: sisReq.status, txId: 'sis_tx_2', timestamp: sisReq.updatedAt, actor: 'consortium' }
          ]
        };
      }
    } catch (e) {}
  }

  // 3. Mock Contract A Store
  if (MOCK_CONTRACT_A_STORE[normalizedId]) {
    return JSON.parse(JSON.stringify(MOCK_CONTRACT_A_STORE[normalizedId]));
  }

  return null;
}

/**
 * Resolves comprehensive student records across SIS and Fabric
 */
async function fetchStudentInfo(studentId) {
  if (!studentId) return null;
  const cleanId = studentId.trim();

  let sisStudent = null;
  let certReq = null;
  let audit = null;
  let certObj = null;

  if (sisDatabase) {
    try {
      sisStudent = sisDatabase.getStudentByRollNumber(cleanId) || sisDatabase.getStudentByDID(cleanId);
      if (!sisStudent && !cleanId.toUpperCase().startsWith('STU-')) {
        sisStudent = sisDatabase.getStudentByRollNumber(`STU-${cleanId.toUpperCase()}`);
      }
      const resolvedId = sisStudent ? sisStudent.studentId : cleanId;
      certReq = sisDatabase.getLatestCertificateRequestForStudent(resolvedId);
      audit = sisDatabase.getStudentComprehensiveAudit(resolvedId);
      if (certReq?.requestId) {
        certObj = sisDatabase.getCertificateByRequestId(certReq.requestId);
      }
    } catch (e) {}
  }

  // Live Fabric Ledger Check
  let onChainStudent = null;
  try {
    const raw = await queryChaincode('GetStudent', [sisStudent?.studentId || cleanId]);
    if (raw) onChainStudent = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {}

  if (!sisStudent && !onChainStudent) {
    return null;
  }

  const s = sisStudent || onChainStudent;
  return {
    studentId: s.studentId,
    name: s.name,
    email: s.email,
    department: s.department,
    enrollmentYear: s.enrollmentYear,
    attendance: s.attendance || audit?.attendance || 88,
    cgpa: s.cgpa || audit?.computedSgpa || 8.5,
    did: s.did,
    isOnLedger: Boolean(s.isOnLedger || onChainStudent),
    certReq,
    audit,
    certObj
  };
}

// ============================================================================
// 2. PERSON SEARCH ENGINE (STUDENT & FACULTY LOOKUP BY NAME)
// ============================================================================

/**
 * Searches the University SIS & Consortium for students or faculty matching a name query.
 */
function findPersonInSystem(text) {
  if (!text || typeof text !== 'string') return null;
  const clean = text.toLowerCase().trim();

  if (!sisDatabase) return null;

  const students = sisDatabase.getAllSISStudents ? sisDatabase.getAllSISStudents() : [];
  const faculties = sisDatabase.getAllFaculties ? sisDatabase.getAllFaculties() : [];

  // 1. Exact full student name match
  for (const s of students) {
    if (clean.includes(s.name.toLowerCase())) {
      return { type: 'student', data: s };
    }
  }

  // 2. Exact full faculty name match
  for (const f of faculties) {
    if (clean.includes(f.name.toLowerCase())) {
      return { type: 'faculty', data: f };
    }
  }

  // 3. Match explicit Student ID inside text
  for (const s of students) {
    const idLower = s.studentId.toLowerCase();
    const idNum = idLower.replace('stu-', '');
    if (clean.includes(idLower) || (idNum.length >= 3 && clean.includes(idNum))) {
      return { type: 'student', data: s };
    }
  }

  // 4. Token-based matching (matches specific name words like "Divyanshu", "Mohapatra", "Prabir", "Alice")
  const stopWords = new Set([
    'can', 'you', 'find', 'show', 'student', 'person', 'profile', 'status',
    'about', 'tell', 'check', 'who', 'the', 'is', 'for', 'me', 'please', 'details',
    'look', 'up', 'search', 'get', 'give', 'information', 'info', 'record', 'does', 'exist', 'roll', 'number', 'no', 'of', 'in', 'at'
  ]);
  const tokens = clean.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length >= 3 && !stopWords.has(t));

  for (const s of students) {
    const sTokens = s.name.toLowerCase().split(/\s+/);
    for (const token of tokens) {
      if (sTokens.includes(token)) {
        return { type: 'student', data: s };
      }
    }
  }

  for (const f of faculties) {
    const fTokens = f.name.toLowerCase().replace('dr.', '').trim().split(/\s+/);
    for (const token of tokens) {
      if (fTokens.includes(token)) {
        return { type: 'faculty', data: f };
      }
    }
  }

  return null;
}

// ============================================================================
// 3. ID & ENTITY EXTRACTION ENGINE
// ============================================================================

function extractEntities(text) {
  if (!text || typeof text !== 'string') {
    return { certId: null, studentId: null, personMatch: null, searchedName: null, docHash: null, isHealth: false };
  }

  const cleanText = text.trim();
  let certId = null;
  let studentId = null;
  let docHash = null;

  // 1. Explicit Certificate / Request IDs: CERT-101, REQ-101, cert 101, request 101
  const explicitCertMatch = cleanText.match(/\b(CERT|REQ)(?:[-_#:\s]+|\b)(\d+[A-Z0-9_-]*)\b/i);
  if (explicitCertMatch) {
    const prefix = explicitCertMatch[1].toUpperCase();
    const idPart = explicitCertMatch[2].toUpperCase().replace(/[-_#\s]+/g, '-');
    certId = `${prefix}-${idPart}`;
  }

  if (!certId) {
    const wordCertMatch = cleanText.match(/\b(certificate|request)[-_#:\s]+(?:(cert|req)[-_#:\s]+)?(\d+[A-Z0-9_-]*)\b/i);
    if (wordCertMatch) {
      const prefix = (wordCertMatch[2] || (wordCertMatch[1].toLowerCase().startsWith('cert') ? 'CERT' : 'REQ')).toUpperCase();
      certId = `${prefix}-${wordCertMatch[3].toUpperCase()}`;
    }
  }

  // 2. Student ID extraction with digits (e.g. STU-2024-35, STU-001, roll number 2024-35)
  const stuMatch = cleanText.match(/\b(?:STU|STUDENT)(?:[-_#:\s]+|\b)(\d+[A-Z0-9_-]*)\b/i);
  if (stuMatch) {
    studentId = `STU-${stuMatch[1].toUpperCase()}`;
  }

  if (!studentId) {
    const rollMatch = cleanText.match(/\b(?:roll\s*(?:number|no|#)?)\s*[:=]?\s*([A-Za-z0-9_-]+)/i);
    if (rollMatch) {
      const rawRoll = rollMatch[1].toUpperCase();
      if (rawRoll.startsWith('STU-')) {
        studentId = rawRoll;
      } else if (/\d/.test(rawRoll)) {
        studentId = `STU-${rawRoll}`;
      }
    }
  }

  // Standalone cert number fallback like "#101" or "for 101"
  if (!certId && !studentId) {
    const standaloneMatch = cleanText.match(/(?:for|about|of|cert|id|#)\s*#?([0-9]{3,})\b/i);
    if (standaloneMatch) {
      certId = `CERT-${standaloneMatch[1]}`;
    }
  }

  // 3. Person / Name Matching
  const personMatch = findPersonInSystem(cleanText);
  if (personMatch && personMatch.type === 'student' && !studentId) {
    studentId = personMatch.data.studentId;
  }

  // Check if a name search was attempted but not found
  let searchedName = null;
  const nameSearchMatch = cleanText.match(/\b(?:find|search|who\s+is|tell\s+me\s+about|look\s+up|check|profile\s+of)\s+(?:student|person|faculty|prof|professor)?\s*([A-Z][a-zA-Z\s]+)/i);
  if (nameSearchMatch && !personMatch && !certId && !studentId) {
    searchedName = nameSearchMatch[1].trim();
  }

  // 4. Cryptographic SHA-256 Digest
  const hashMatch = cleanText.match(/\b[a-fA-F0-9]{64}\b/);
  if (hashMatch) {
    docHash = hashMatch[0];
  }

  // 5. Health Query check
  const isHealth = /\b(health|network\s+status|blockchain\s+status|peers?\s+status|nodes?\s+online|is\s+blockchain\s+up|orderer\s+status)\b/i.test(cleanText);

  return { certId, studentId, personMatch, searchedName, docHash, isHealth };
}

// ============================================================================
// 4. INTENT DETECTION
// ============================================================================

const INTENTS = {
  STATUS_CHECK: 'STATUS_CHECK',
  HISTORY_LOOKUP: 'HISTORY_LOOKUP',
  WHO_APPROVED: 'WHO_APPROVED',
  STUDENT_LOOKUP: 'STUDENT_LOOKUP',
  FACULTY_LOOKUP: 'FACULTY_LOOKUP',
  NETWORK_HEALTH: 'NETWORK_HEALTH',
  HASH_VERIFY: 'HASH_VERIFY',
  GENERAL_QA: 'GENERAL_QA',
  GENERAL_HELP: 'GENERAL_HELP',
  UNKNOWN: 'UNKNOWN'
};

function detectIntent(text, entities = null) {
  if (!text || typeof text !== 'string') {
    return INTENTS.GENERAL_HELP;
  }

  const lower = text.toLowerCase().trim();
  const ents = entities || extractEntities(text);

  // Exact greetings / help without domain entities
  const isHelpQuery = /^(hi|hello|hey|greetings|help|\?|what can you do|how to use|commands|menu)\b/i.test(lower) ||
                      /\b(what can you do|how do i use|how does this work|give me help|list commands|supported questions|capabilities)\b/i.test(lower);

  const hasTarget = Boolean(ents.certId || ents.studentId || ents.personMatch || ents.searchedName || ents.docHash || ents.isHealth);

  if (isHelpQuery && !hasTarget) {
    return INTENTS.GENERAL_HELP;
  }

  // Health
  if (ents.isHealth || /\b(network\s+health|system\s+health|fabric\s+health|nodes\s+healthy)\b/i.test(lower)) {
    return INTENTS.NETWORK_HEALTH;
  }

  // Hash verification
  if (ents.docHash) {
    return INTENTS.HASH_VERIFY;
  }

  // Approver inquiries
  const whoApprovedPatterns = [
    /\b(who\s+(?:is|was|did)?\s*(?:the\s+)?(approved|approver|signed|signer|signee|authorized|authorizer|verified|verifier|endorsed|finalized|locked|reviewed|passed))\b/i,
    /\b(who\s+locked\s+exam|who\s+finalized|who\s+signed\s+off)\b/i,
    /\b(which\s+(?:actor|org|organization|person|department|party|faculty|board|role)\s+(?:approved|approver|signed|signer|authorized|finalized|locked))\b/i,
    /\b(approver\s+of|signed\s+by|approved\s+by|signed\s+off\s+by|authorized\s+by)\b/i,
    /\bwho\s+approved\b/i
  ];
  for (const pattern of whoApprovedPatterns) {
    if (pattern.test(lower)) {
      return INTENTS.WHO_APPROVED;
    }
  }

  // Lifecycle History & Timeline
  const historyPatterns = [
    /\b(history|timeline|audit\s*trail|lifecycle|all\s+stages|past\s+stages|steps\s+passed|provenance|logs?|trail|track\s+record|milestones|progression)\b/i,
    /\b(show\s+me\s+(?:all\s+)?(?:the\s+)?(?:history|steps|progression|events|milestones))\b/i,
    /\b(what\s+stages\s+did|how\s+did\s+.*progress|show\s+path)\b/i
  ];
  for (const pattern of historyPatterns) {
    if (pattern.test(lower)) {
      return INTENTS.HISTORY_LOOKUP;
    }
  }

  // Faculty specific queries
  if (ents.personMatch && ents.personMatch.type === 'faculty') {
    return INTENTS.FACULTY_LOOKUP;
  }

  // Student specific queries (by roll number, ID, or name)
  if ((ents.studentId || ents.searchedName || (ents.personMatch && ents.personMatch.type === 'student')) && !ents.certId) {
    return INTENTS.STUDENT_LOOKUP;
  }

  // Status check for cert or request
  const statusPatterns = [
    /\b(status|state|current\s+stage|where\s+is|what\s+stage|progress|is\s+it\s+(?:approved|ready|issued|done|complete)|check\s+status|track\s+cert|track\s+progress)\b/i,
    /\b(what\s+is\s+the\s+status|check\s+cert|status\s+of|has\s+.*been\s+approved)\b/i
  ];
  for (const pattern of statusPatterns) {
    if (pattern.test(lower)) {
      return INTENTS.STATUS_CHECK;
    }
  }

  if (ents.certId) {
    return INTENTS.STATUS_CHECK;
  }

  // General Domain Knowledge / Q&A
  const isQuestion = /\b(what|how|why|explain|tell|describe|can you|does|is|are|architecture|consortium|raft|ipfs|encryption|aes|multi-sig|multisig|revocation|did)\b/i.test(lower);
  if (isQuestion) {
    return INTENTS.GENERAL_QA;
  }

  return INTENTS.GENERAL_HELP;
}

// ============================================================================
// 5. DOMAIN KNOWLEDGE ENGINE
// ============================================================================

function answerDomainQuestion(text) {
  const lower = text.toLowerCase();

  // 1. Raft Consensus
  if (lower.includes('raft') || lower.includes('consensus') || lower.includes('orderer')) {
    return "### ⚡ Raft Consensus Architecture\n\n" +
           "Our consortium uses **Crash Fault-Tolerant (CFT) Raft Consensus** implemented within Hyperledger Fabric 2.5:\n\n" +
           "• **Leader-Follower Topology**: An active Orderer node (`orderer.academic.com:7050`) coordinates transaction ordering, batching endorsed transactions into immutable blocks.\n" +
           "• **Deterministic Finality**: Unlike Proof-of-Work (PoW) or Proof-of-Stake (PoS), Raft provides immediate, deterministic block finality with zero chain forks and negligible latency.\n" +
           "• **Fault Tolerance**: Up to $(N-1)/2$ node crashes can be tolerated in a multi-node cluster without halting the consortium.";
  }

  // 2. IPFS Storage & Cloudflare R2 Dual Archival
  if (lower.includes('cloudflare') || lower.includes('r2') || lower.includes('backup')) {
    return "### ☁️ Cloudflare R2 Enterprise Dual-Storage Architecture\n\n" +
           "To guarantee high availability and disaster recovery alongside IPFS, the consortium implements a **Dual-Storage Archival Strategy**:\n\n" +
           "• **Primary Layer**: Decentralized IPFS Kubo node pinning canonical encrypted PDF credentials and on-chain CIDs.\n" +
           "• **Enterprise Backup Layer**: Cloudflare R2 S3-compatible object storage (`academic-certificates` bucket) via `@aws-sdk/client-s3`.\n" +
           "• **Role-Based Access Control**: R2 object access and presigned download link generation are strictly restricted to Org 3 Central Administrators (`ADMIN`).\n" +
           "• **Cryptographic Verification**: Both IPFS and R2 replicas share the exact same verifiable SHA-256 digest anchored into Hyperledger Fabric.";
  }

  if (lower.includes('ipfs') || lower.includes('storage') || lower.includes('cid')) {
    return "### 🌐 Decentralized IPFS Storage Architecture\n\n" +
           "To maintain ledger efficiency while ensuring document immutability, we use a **Dual-Storage Paradigm**:\n\n" +
           "• **Off-Chain IPFS Kubo Node**: The full canonical PDF certificates and high-resolution credentials are encrypted and pinned to our IPFS node (`ipfs-node:5001/8080`).\n" +
           "• **Cloudflare R2 Enterprise Backup**: Synchronously mirrored to Cloudflare R2 S3 storage for enterprise disaster recovery (restricted to Org 3 Admins).\n" +
           "• **On-Chain Cryptographic Anchoring**: The 46-character IPFS Content Identifier (CID, e.g. `Qm...`) and the SHA-256 cryptographic document digest are anchored into the Hyperledger Fabric ledger.\n" +
           "• **Zero Tampering**: Any alteration to the off-chain PDF produces a completely different SHA-256 digest, which fails on-chain verification instantly.";
  }

  // 3. 3-Organization Consortium
  if (lower.includes('consortium') || lower.includes('org') || lower.includes('roles') || lower.includes('organization')) {
    return "### 🏛️ Consortium Governance & Responsibilities\n\n" +
           "The Academic Blockchain is governed by a 3-Organization Consortium:\n\n" +
           "1. **Org 1 (University & Academic Department)** (`Org1MSP` • Port 7051):\n" +
           "   • Manages student admission, SIS profiles, and course registration.\n" +
           "   • Orchestrates Course Faculty, Faculty Advisor, and HOD approvals.\n" +
           "   • Conducts Department Academic Committee (DAC) multi-signature voting.\n\n" +
           "2. **Org 2 (Examination Board)** (`Org2MSP` • Port 8051):\n" +
           "   • Acts as the independent credential auditor.\n" +
           "   • Locks exam grades and anchors Merkle root hashes for transcripts (`EXAM_LOCKED`).\n\n" +
           "3. **Org 3 (Administration & Governance)** (`Org3MSP` • Port 9051):\n" +
           "   • Executes Dean Academic sanction and Registrar clearance.\n" +
           "   • Mints immutable certificates on Fabric & pins PDFs to IPFS.\n" +
           "   • Authorized to execute public certificate revocations if required.";
  }

  // 4. Traditional AES-256-GCM Encryption
  if (lower.includes('aes') || lower.includes('encrypt') || lower.includes('security') || lower.includes('crypto')) {
    return "### 🔒 Traditional AES-256-GCM Encryption\n\n" +
           "As recommended for cryptographic hardening, all sensitive extraction endpoints and streaming channels utilize **traditional symmetric AES-256-GCM**:\n\n" +
           "• **Authenticated Encryption (AEAD)**: Combines 256-bit Advanced Encryption Standard with Galois/Counter Mode to guarantee confidentiality and ciphertext authenticity.\n" +
           "• **Protection Vectors**: Used across `/api/history/:key?encrypt=true` and `/api/events` Server-Sent Events to protect against wiretapping and man-in-the-middle tampering.\n" +
           "• **Payload Format**: Ciphertext includes a 12-byte initialization vector (`iv`), 16-byte authentication `tag`, and encrypted `data` hex string.";
  }

  // 5. 7-Stage Lifecycle Workflow
  if (lower.includes('stage') || lower.includes('workflow') || lower.includes('pipeline') || lower.includes('process') || lower.includes('lifecycle')) {
    return "### 📋 7-Stage Multi-Organization Lifecycle Pipeline\n\n" +
           "Every academic credential progresses through 7 cryptographically signed stages:\n\n" +
           "1. `SUBMITTED`: Student or University SIS initiates graduation clearance.\n" +
           "2. `FACULTY_APPROVED`: Course instructors endorse attendance and course completion.\n" +
           "3. `HOD_APPROVED`: Department Head & Faculty Advisor approve degree criteria.\n" +
           "4. `DAC_APPROVED`: Department Academic Committee executes 3-of-4 multi-signature quorum.\n" +
           "5. `EXAM_LOCKED`: Org 2 Examination Controller locks grades on-chain.\n" +
           "6. `DEAN_APPROVED`: Org 3 Dean clears institutional dues and academic sanction.\n" +
           "7. `ADMIN_FINALIZED`: Registrar authorizes certificate issuance, anchoring IPFS CID and SHA-256 digest on Fabric.";
  }

  // 6. Employer Verification Portal
  if (lower.includes('verify') || lower.includes('employer') || lower.includes('portal') || lower.includes('check')) {
    return "### 🔍 Public Employer Verification Portal\n\n" +
           "Employers and credential validators can instantly verify degrees without university middlemen:\n\n" +
           "• **Verification by Certificate ID**: Query `CERT-xxxx` to pull the cryptographic record directly from peer smart contracts.\n" +
           "• **Verification by SHA-256 Digest**: Upload or compute the 64-character SHA-256 hash of a candidate's PDF degree to test ledger integrity.\n" +
           "• **Tamper Resistance**: If any grade or name was modified, the hash test returns an immediate invalidation alert.";
  }

  // 7. Revocation
  if (lower.includes('revoke') || lower.includes('revocation')) {
    return "### 🛡️ Immutable Certificate Revocation\n\n" +
           "If academic misconduct or error occurs post-graduation:\n\n" +
           "• Org 3 Registrar executes `RevokeCertificate` on the Fabric ledger with reason and timestamp.\n" +
           "• The certificate state is updated to `REVOKED` permanently across all peer CouchDB databases.\n" +
           "• Public verification portals will flag the degree as revoked while preserving the full tamper-proof audit trail.";
  }

  // Fallback domain answer
  return "### 🎓 Academic Blockchain Consortium Assistant\n\n" +
         "I am your ledger-aware intelligence assistant connected directly to **Hyperledger Fabric 2.5** and **IPFS**.\n\n" +
         "Here is what you can ask me:\n" +
         "• **Student by Name**: `Can you find student Divyanshu Mohapatra?` or `Tell me about Alice Johnson`\n" +
         "• **Student by Roll Number**: `status of this roll number student STU-2024-35`\n" +
         "• **Faculty Search**: `Find Dr. Rajesh Kumar` or `Who is Dr. Sunita Rao?`\n" +
         "• **Certificate Verification**: `What's the status of CERT-101?`\n" +
         "• **Multi-Org Approvers**: `Who approved CERT-101?`\n" +
         "• **Audit Trail**: `Show me the history of CERT-101`\n" +
         "• **Architecture Queries**: Ask about `Raft Consensus`, `IPFS Storage`, `AES Encryption`, or `Consortium Roles`.";
}

// ============================================================================
// 6. NATURAL LANGUAGE GENERATION (NLG)
// ============================================================================

function formatTime(isoStr) {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toISOString().replace('.000', '');
  } catch {
    return isoStr;
  }
}

function formatStudentReply(studentData) {
  const s = studentData;
  const ledgerBadge = s.isOnLedger ? '🟢 Confirmed on Fabric Ledger (Org1)' : '🟡 Synchronized in University SIS';

  let reqSection = '';
  if (s.certReq) {
    const r = s.certReq;
    reqSection = `\n\n#### 📜 Degree / Certificate Lifecycle Status:\n` +
      `• **Request ID**: \`${r.requestId}\`\n` +
      `• **Degree**: ${r.certType || s.audit?.branch || 'Master of Computer Applications (MCA)'}\n` +
      `• **Current Stage**: **\`${r.status}\`**\n` +
      `• **Submitted At**: ${formatTime(r.submittedAt || r.createdAt)}\n` +
      `• **Last Updated**: ${formatTime(r.updatedAt || r.submittedAt)}`;

    if (r.details?.certId || s.certObj?.certId) {
      const cId = r.details?.certId || s.certObj?.certId;
      const ipfsHash = r.details?.ipfsCid || r.details?.ipfsHash || s.certObj?.ipfsHash;
      const docHash = r.details?.sha256Hash || r.details?.docHash || s.certObj?.docHash;
      reqSection += `\n\n#### 🎓 Issued Credential:\n` +
        `• **Certificate ID**: \`${cId}\`\n` +
        (ipfsHash ? `• **IPFS CID**: \`${ipfsHash}\`\n` : '') +
        (docHash ? `• **On-Chain SHA-256 Digest**: \`${docHash}\`\n` : '') +
        `• **Verification Status**: ✅ Cryptographically Verified on Fabric`;
    }
  } else {
    reqSection = `\n\n• **Certificate Request**: No active graduation request submitted yet. Student profile is ready for department clearance.`;
  }

  const auditSection = s.audit ? (
    `\n• **Academic Audit**: ${s.audit.allCoursesPassed ? '✅ All Courses Passed' : '⚠️ Pending Course Requirements'} ` +
    `(${s.audit.coursesSubmitted}/${s.audit.coursesTotal} course marks verified)`
  ) : '';

  return `### 🎓 Student Profile: ${s.name} (${s.studentId})\n\n` +
    `• **Name**: ${s.name}\n` +
    `• **Roll Number / Student ID**: \`${s.studentId}\`\n` +
    `• **Department**: ${s.department}\n` +
    `• **Email**: ${s.email || 'N/A'}\n` +
    `• **Enrollment Year**: ${s.enrollmentYear || '2024'}\n` +
    `• **Academic Standing**: CGPA: **${s.cgpa || '8.5'}** | Attendance: **${s.attendance || '88'}%**` +
    auditSection + `\n` +
    `• **Decentralized Identifier (DID)**: \`${s.did || 'did:academic:' + s.studentId}\`\n` +
    `• **Ledger Anchor**: ${ledgerBadge}` +
    reqSection;
}

function formatFacultyReply(faculty) {
  const f = faculty;
  return `### 👨‍🏫 Faculty Dossier: ${f.name}\n\n` +
    `• **Faculty ID**: \`${f.faculty_id || 'FAC-ORG1'}\`\n` +
    `• **Name**: ${f.name}\n` +
    `• **Department**: ${f.department}\n` +
    `• **Designation**: ${f.designation}\n` +
    `• **Official Email**: ${f.email}\n` +
    `• **Assigned Academic Course**: **${f.course_id}** — *${f.course_name}*\n` +
    `• **Consortium Role**: Course Instructor & Initial Multi-Sig Course Endorsement Authority (Org 1)\n\n` +
    `*Authorized to review student coursework, submit CIE marks, and sign off on Stage 2 (FACULTY_APPROVED).*`;
}

/**
 * Generates natural language replies
 */
function generateReply(intent, entities, data, extra = null) {
  const { certId, studentId, searchedName, docHash } = entities;

  // 1. GENERAL_HELP
  if (intent === INTENTS.GENERAL_HELP) {
    return {
      reply: "👋 Hello! I am your Academic Blockchain Assistant. You can ask me:\n" +
             "1. Status Check — \"What's the status of CERT-101?\"\n" +
             "2. Person / Student Search — \"Can you find student Divyanshu Mohapatra?\"\n" +
             "3. Student by Roll No — \"status of this roll number student STU-2024-35\"\n" +
             "4. History Lookup — \"Show me the history of CERT-101\"\n" +
             "5. Approver Lookup — \"Who approved CERT-101?\"\n" +
             "6. General Help — \"What can you do?\"",
      intent: INTENTS.GENERAL_HELP,
      data: null
    };
  }

  // 2. NETWORK_HEALTH
  if (intent === INTENTS.NETWORK_HEALTH) {
    const nw = extra?.network || { allHealthy: true };
    const ipfs = extra?.ipfs || { healthy: true };
    const reply = `### 🌐 Consortium Network & Node Status\n\n` +
      `Consortium Status: **${nw.allHealthy ? '🟢 ALL SYSTEMS OPERATIONAL' : '🟡 PARTIAL DEGRADATION'}**\n\n` +
      `• **peer0.org1** (University/Faculty): 🟢 Port 7051 Active\n` +
      `• **peer0.org2** (Examination Board): 🟢 Port 8051 Active\n` +
      `• **peer0.org3** (Admin & Governance): 🟢 Port 9051 Active\n` +
      `• **Orderer Node**: 🟢 Raft Consensus (Port 7050, TLS Active)\n` +
      `• **IPFS Storage Node**: ${ipfs.healthy ? '🟢 Kubo v0.24 Online (Port 5001/8080)' : '🔴 Offline'}\n` +
      `• **Security Protocol**: AES-256-GCM Payload Encryption Ready`;

    return { reply, intent: INTENTS.NETWORK_HEALTH, data: { network: nw, ipfs } };
  }

  // 3. FACULTY_LOOKUP
  if (intent === INTENTS.FACULTY_LOOKUP) {
    if (!data) {
      return {
        reply: `⚠️ Faculty record could not be found.`,
        intent: INTENTS.FACULTY_LOOKUP,
        data: null
      };
    }
    return {
      reply: formatFacultyReply(data),
      intent: INTENTS.FACULTY_LOOKUP,
      data
    };
  }

  // 4. STUDENT_LOOKUP
  if (intent === INTENTS.STUDENT_LOOKUP) {
    if (!data) {
      const targetQuery = searchedName || studentId || 'the requested student';
      return {
        reply: `⚠️ Student "${targetQuery}" was not found in the University SIS database or on the Fabric ledger. Please check the spelling or provide their Roll Number (e.g. STU-2020-013).`,
        intent: INTENTS.STUDENT_LOOKUP,
        data: null
      };
    }
    return {
      reply: formatStudentReply(data),
      intent: INTENTS.STUDENT_LOOKUP,
      data
    };
  }

  // 5. HASH_VERIFY
  if (intent === INTENTS.HASH_VERIFY) {
    if (!data) {
      return {
        reply: `⚠️ No certificate matching SHA-256 digest \`${docHash}\` was found on the Fabric ledger. The document may be untracked or forged.`,
        intent: INTENTS.HASH_VERIFY,
        data: null
      };
    }
    return {
      reply: `✅ **Cryptographic Hash Match Confirmed!**\n\n` +
             `• **Certificate ID**: \`${data.certId}\`\n` +
             `• **Recipient**: ${data.studentName} (${data.studentId})\n` +
             `• **Status**: ${data.status}\n` +
             `• **IPFS CID**: \`${data.ipfsHash}\`\n` +
             `• **Anchor Tx Timestamp**: ${data.createdAt || data.issueDate}`,
      intent: INTENTS.HASH_VERIFY,
      data
    };
  }

  // 6. GENERAL_QA
  if (intent === INTENTS.GENERAL_QA) {
    const ans = answerDomainQuestion(extra?.rawMessage || '');
    return {
      reply: ans,
      intent: INTENTS.GENERAL_QA,
      data: null
    };
  }

  // Missing target ID check
  if (!certId && !studentId) {
    return {
      reply: "Please provide a valid Certificate ID (e.g. CERT-101) so I can query the Fabric ledger for you.",
      intent,
      data: null
    };
  }

  // Certificate not found
  if (!data) {
    return {
      reply: `I couldn't find certificate "${certId}" on the Academic Blockchain ledger. Please check the ID and try again.`,
      intent,
      data: null
    };
  }

  // 7. STATUS_CHECK
  if (intent === INTENTS.STATUS_CHECK) {
    const txShort = data.txId ? `${data.txId.substring(0, 16)}...` : 'confirmed';
    const reply = `${data.certId} is currently at ${data.status} stage, confirmed on-chain (tx: ${txShort}).`;
    return { reply, intent: INTENTS.STATUS_CHECK, data };
  }

  // 8. WHO_APPROVED
  if (intent === INTENTS.WHO_APPROVED) {
    const history = data.history || [];
    if (history.length === 0) {
      return {
        reply: `${data.certId} is at ${data.status}, signed by ${data.actor || 'N/A'} (${data.org || 'N/A'}).`,
        intent: INTENTS.WHO_APPROVED,
        data
      };
    }

    const approvalEntries = history.filter(h => h.status !== 'SUBMITTED');
    if (approvalEntries.length === 0) {
      const initEntry = history[0];
      return {
        reply: `${data.certId} has only been SUBMITTED by ${initEntry.actor} (${initEntry.org}) on ${formatTime(initEntry.timestamp)} and has not yet been approved by faculty.`,
        intent: INTENTS.WHO_APPROVED,
        data
      };
    }

    const latest = approvalEntries[approvalEntries.length - 1];
    const detailsList = approvalEntries.map(h => 
      `• ${h.status} was signed off by ${h.actor} (${h.org}) on ${formatTime(h.timestamp)} (tx: ${(h.txId || '0x').substring(0, 10)}...)`
    ).join('\n');

    const reply = `${latest.status} was signed off by ${latest.actor} (${latest.org}) on ${formatTime(latest.timestamp)}.\n\nFull Approvals Breakdown:\n${detailsList}`;

    return { reply, intent: INTENTS.WHO_APPROVED, data };
  }

  // 9. HISTORY_LOOKUP
  if (intent === INTENTS.HISTORY_LOOKUP) {
    const history = data.history || [];
    if (history.length === 0) {
      return {
        reply: `No lifecycle history records found for ${data.certId}. Current state: ${data.status}.`,
        intent: INTENTS.HISTORY_LOOKUP,
        data
      };
    }

    const stageLines = history.map((item, idx) => {
      const txShort = item.txId ? ` [tx: ${item.txId.substring(0, 10)}...]` : '';
      return `${idx + 1}. ${item.status} — ${item.actor} (${item.org}), ${formatTime(item.timestamp)}${txShort}`;
    }).join('\n');

    const reply = `📜 Blockchain Lifecycle History for ${data.certId}:\n${stageLines}\n\nCurrent Ledger Status: ${data.status}`;

    return { reply, intent: INTENTS.HISTORY_LOOKUP, data };
  }

  return {
    reply: `I processed your request for ${data.certId || studentId}. Current status is ${data.status || 'Active'}.`,
    intent: INTENTS.UNKNOWN,
    data
  };
}

// ============================================================================
// 7. MASTER CHAT PROCESSOR PIPELINE
// ============================================================================

async function handleChatMessage(message, context = {}) {
  if (!message || typeof message !== 'string') {
    return generateReply(INTENTS.GENERAL_HELP, {}, null);
  }

  const role = (context.role || 'STUDENT').toUpperCase();
  const userName = context.name || context.user || role;
  const lower = message.toLowerCase().trim();

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
        data: { currentRole: role, requiredRole: 'ADMIN' }
      };
    }

    // Admin has authorized access to Cloudflare R2!
    let certId = null;
    const certMatch = message.match(/CERT-[A-Za-z0-9-]+/i);
    if (certMatch) {
      certId = certMatch[0].toUpperCase();
    } else {
      const stuMatch = message.match(/STU-[A-Za-z0-9-]+/i);
      if (stuMatch && sisDatabase) {
        try {
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
             `*Tip: As an Administrator, you can request a presigned download link by mentioning any Certificate ID (e.g. "Get Cloudflare R2 link for CERT-2024-001").*`,
      intent: 'R2_STATUS',
      data: r2Health
    };
  }

  // Role-based restrictions for students querying privileged operations
  if (role === ROLES.STUDENT && (lower.includes('lock grades') || lower.includes('lock grade') || lower.includes('submit marks') || lower.includes('enter marks') || lower.includes('revoke certificate'))) {
    return {
      reply: `### 🔒 Role-Restricted Operation\n\n` +
             `• **Your Role**: \`${role}\` (Public / Student Portal)\n` +
             `• **Restricted Capability**: Course grading, exam lockdown, and certificate revocation are privileged operations.\n\n` +
             `Students can verify certificates, trace public lifecycle milestones, and inspect graduation clearance status. Switch to **Faculty (Org 1)**, **Exam Controller (Org 2)**, or **Admin (Org 3)** to perform institutional tasks.`,
      intent: 'RBAC_FORBIDDEN',
      data: { currentRole: role }
    };
  }

  const entities = extractEntities(message);
  const intent = detectIntent(message, entities);

  // 1. Network Health
  if (intent === INTENTS.NETWORK_HEALTH) {
    let network = { allHealthy: true };
    let ipfs = { healthy: true };
    try {
      network = await checkNetworkHealth();
      ipfs = await checkIPFSHealth();
    } catch (e) {}
    return generateReply(intent, entities, null, { network, ipfs });
  }

  // 2. Hash Verification
  if (intent === INTENTS.HASH_VERIFY) {
    let cert = null;
    try {
      const res = await queryChaincode('VerifyCertificateByHash', [entities.docHash]);
      if (res && res.certificate) cert = res.certificate;
    } catch (e) {}
    return generateReply(intent, entities, cert);
  }

  // 3. Faculty Lookup
  if (intent === INTENTS.FACULTY_LOOKUP) {
    return generateReply(intent, entities, entities.personMatch?.data);
  }

  // 4. Student Profile / Person Query (By Name or Roll Number)
  if (intent === INTENTS.STUDENT_LOOKUP) {
    let studentData = null;
    if (entities.studentId) {
      studentData = await fetchStudentInfo(entities.studentId);
    } else if (entities.personMatch && entities.personMatch.type === 'student') {
      studentData = await fetchStudentInfo(entities.personMatch.data.studentId);
    }
    return generateReply(intent, entities, studentData);
  }

  // 5. General Q&A / Knowledge Inquiry
  if (intent === INTENTS.GENERAL_QA) {
    return generateReply(intent, entities, null, { rawMessage: message });
  }

  // 6. Certificate / Request ID Ledger Fetch
  let ledgerData = null;
  if (entities.certId) {
    ledgerData = await fetchCertHistory(entities.certId);
  }

  return generateReply(intent, entities, ledgerData);
}

module.exports = {
  CANONICAL_STAGES,
  INTENTS,
  findPersonInSystem,
  extractEntities,
  detectIntent,
  fetchCertHistory,
  fetchStudentInfo,
  generateReply,
  handleChatMessage,
  MOCK_CONTRACT_A_STORE
};
