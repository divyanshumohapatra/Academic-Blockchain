'use strict';

/**
 * ============================================================================
 * Academic Blockchain PBL — Group 5 (Contributor 5.2)
 * Conversational NLP & Intent Engine Lead
 * 
 * Module: intentEngine.js
 * Description: Rule-based intent detection, ID extraction, ledger data resolution,
 * and natural language reply generation for academic blockchain queries.
 * ============================================================================
 */

const { queryChaincode } = require('./fabric');

// ============================================================================
// 1. STAGE DEFINITIONS & 5.1 CONTRACT INTEGRATION
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
 * Mock Ledger Store matching 5.1's Contract A Schema
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
 * ============================================================================
 * [SWAP POINT FOR CONTRIBUTOR 5.1 REAL FUNCTION]
 * 
 * When 5.1 delivers getCertHistory in backend/src/fabric.js, replace the mock 
 * lookup below with:
 *   const { getCertHistory } = require('./fabric');
 * ============================================================================
 */
async function fetchCertHistory(certId) {
  // Normalize ID (e.g. "cert-2024-4025" -> "CERT-2024-4025")
  const normalizedId = (certId || '').trim().toUpperCase();

  // 1. First, attempt querying the live Hyperledger Fabric Ledger
  try {
    // A. Check if querying a certificate (e.g. CERT-2024-4025)
    if (normalizedId.startsWith('CERT-') || !normalizedId.startsWith('REQ-')) {
      const verifyRes = await queryChaincode('VerifyCertificate', [normalizedId]);
      if (verifyRes && verifyRes.certificate) {
        const cert = verifyRes.certificate;

        // Fetch linked request lifecycle history if available
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
                actor: h.updatedBy || 'ConsortiumAuthority',
                comments: h.comments
              }));
            }
          } catch (reqErr) {
            // Request query fallback
          }
        }

        if (historyStages.length === 0) {
          historyStages = [
            {
              status: cert.status,
              org: cert.issuerMSP || 'Org3MSP',
              action: 'IssueCertificate',
              txId: cert.docHash || 'tx_onchain',
              timestamp: cert.createdAt,
              actor: cert.issuerMSP || 'Admin-Registrar'
            }
          ];
        }

        return {
          certId: cert.certId,
          status: cert.status,
          org: cert.issuerMSP || 'Org3MSP',
          action: 'IssueCertificate',
          txId: cert.docHash || 'tx_onchain',
          timestamp: cert.createdAt,
          actor: cert.issuerMSP || 'Admin-Registrar',
          studentName: cert.studentName,
          studentId: cert.studentId,
          department: cert.department,
          certType: cert.certType,
          ipfsHash: cert.ipfsHash,
          history: historyStages
        };
      }
    }

    // B. Check if querying a certificate request (e.g. REQ-2024-4025)
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
    // If Fabric is offline or query errors out, proceed to mock fallback
  }

  // 2. STUB / MOCK FALLBACK (for unit tests & mock items)
  if (MOCK_CONTRACT_A_STORE[normalizedId]) {
    return JSON.parse(JSON.stringify(MOCK_CONTRACT_A_STORE[normalizedId]));
  }

  return null;
}


// ============================================================================
// 2. ID EXTRACTION (REGEX ENGINE)
// ============================================================================

/**
 * Extracts Certificate IDs (CERT-xxx, REQ-xxx) or Student IDs from user text.
 * Handles:
 *  - "CERT-101", "cert-101", "CERT#101", "cert 101", "certificate CERT-102", "certificate 101"
 *  - "REQ-101", "request 101", "REQ-2024-001"
 *  - "STU-001", "student 001"
 */
function extractEntities(text) {
  if (!text || typeof text !== 'string') {
    return { certId: null, studentId: null };
  }

  const cleanText = text.trim();
  let certId = null;

  // 1. Explicit ID matches like CERT-101, REQ-101, CERT#101, CERT_101, CERT 101, CERT101 (requiring digits)
  const explicitMatch = cleanText.match(/\b(CERT|REQ)(?:[-_#:\s]+|\b)(\d+[A-Z0-9_-]*)\b/i);
  if (explicitMatch) {
    const prefix = explicitMatch[1].toUpperCase();
    const idPart = explicitMatch[2].toUpperCase().replace(/[-_#\s]+/g, '-');
    certId = `${prefix}-${idPart}`;
  }

  // 2. Word-based patterns like "certificate 101", "certificate CERT-102"
  if (!certId) {
    const wordMatch = cleanText.match(/\b(certificate|request)[-_#:\s]+(?:(cert|req)[-_#:\s]+)?(\d+[A-Z0-9_-]*)\b/i);
    if (wordMatch) {
      const prefix = (wordMatch[2] || (wordMatch[1].toLowerCase().startsWith('cert') ? 'CERT' : 'REQ')).toUpperCase();
      certId = `${prefix}-${wordMatch[3].toUpperCase()}`;
    }
  }

  // 3. Match Student IDs: STU-001, STUDENT-001, student 001
  let studentId = null;
  const studentMatch = cleanText.match(/\b(?:STU|STUDENT)(?:[-_#:\s]+|\b)(\d+[A-Z0-9_-]*)\b/i);
  if (studentMatch) {
    studentId = `STU-${studentMatch[1].toUpperCase()}`;
  }

  // 4. Fallback for standalone numbers like "#101" or "for 101" in cert context
  if (!certId) {
    const standaloneMatch = cleanText.match(/(?:for|about|of|cert|id|#)\s*#?([0-9]{3,})\b/i);
    if (standaloneMatch) {
      certId = `CERT-${standaloneMatch[1]}`;
    }
  }

  return { certId, studentId };
}


// ============================================================================
// 3. INTENT DETECTION (KEYWORD & PATTERN ENGINE)
// ============================================================================

const INTENTS = {
  STATUS_CHECK: 'STATUS_CHECK',
  HISTORY_LOOKUP: 'HISTORY_LOOKUP',
  WHO_APPROVED: 'WHO_APPROVED',
  GENERAL_HELP: 'GENERAL_HELP',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Detects user intent based on weighted keyword and regex rules.
 */
function detectIntent(text) {
  if (!text || typeof text !== 'string') {
    return INTENTS.GENERAL_HELP;
  }

  const lower = text.toLowerCase().trim();

  // Pattern 1: GENERAL_HELP (greeting, generic questions without cert target)
  const isHelpQuery = /^(hi|hello|hey|greetings|help|\?|what can you do|how to use|commands|menu)\b/i.test(lower) ||
                      /\b(what can you do|how do i use|how does this work|give me help|list commands|supported questions|capabilities)\b/i.test(lower);

  const hasCertTarget = /\b(cert|req|certificate|request|stu|student)\b/i.test(lower) || /[0-9]{3,}/.test(lower);

  if (isHelpQuery && !hasCertTarget) {
    return INTENTS.GENERAL_HELP;
  }

  // Pattern 2: WHO_APPROVED (High priority check for approval/actor queries)
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

  // Pattern 3: HISTORY_LOOKUP (Timeline, audit trail, lifecycle, progression, steps, path)
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

  // Pattern 4: STATUS_CHECK (Current stage, where is it, progress, state, check status)
  const statusPatterns = [
    /\b(status|state|current\s+stage|where\s+is|what\s+stage|progress|is\s+it\s+(?:approved|ready|issued|done|complete)|check\s+status|track\s+cert|track\s+progress)\b/i,
    /\b(what\s+is\s+the\s+status|check\s+cert|status\s+of|has\s+.*been\s+approved)\b/i
  ];
  for (const pattern of statusPatterns) {
    if (pattern.test(lower)) {
      return INTENTS.STATUS_CHECK;
    }
  }

  // If a certificate ID is present without explicit intent keywords, default to STATUS_CHECK
  const entities = extractEntities(text);
  if (entities.certId) {
    return INTENTS.STATUS_CHECK;
  }

  return INTENTS.GENERAL_HELP;
}


// ============================================================================
// 4. NATURAL LANGUAGE GENERATION (NLG TEMPLATES)
// ============================================================================

/**
 * Formats a single timestamp into human-readable ISO string
 */
function formatTime(isoStr) {
  if (!isoStr) return 'N/A';
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? isoStr : d.toISOString().replace('.000', '');
  } catch {
    return isoStr;
  }
}

/**
 * Generates natural language replies using real Contract A fields.
 */
function generateReply(intent, entities, ledgerData) {
  const { certId } = entities;

  // Case: GENERAL_HELP
  if (intent === INTENTS.GENERAL_HELP) {
    return {
      reply: "👋 Hello! I am your Academic Blockchain Assistant. You can ask me:\n" +
             "1. Status Check — \"What's the status of CERT-101?\"\n" +
             "2. History Lookup — \"Show me the history of CERT-101\"\n" +
             "3. Approver Lookup — \"Who approved CERT-101?\"\n" +
             "4. General Help — \"What can you do?\"",
      intent: INTENTS.GENERAL_HELP,
      data: null
    };
  }

  // Case: Missing Certificate ID
  if (!certId) {
    return {
      reply: "Please provide a valid Certificate ID (e.g. CERT-101) so I can query the Fabric ledger for you.",
      intent,
      data: null
    };
  }

  // Case: Certificate not found on ledger (Friendly message)
  if (!ledgerData) {
    return {
      reply: `I couldn't find certificate "${certId}" on the Academic Blockchain ledger. Please check the ID and try again.`,
      intent,
      data: null
    };
  }

  // Case 1: STATUS_CHECK
  // Template: "{certId} is currently at {status} stage, confirmed on-chain (tx: {txId})."
  if (intent === INTENTS.STATUS_CHECK) {
    const txShort = ledgerData.txId ? `${ledgerData.txId.substring(0, 16)}...` : 'confirmed';
    const reply = `${ledgerData.certId} is currently at ${ledgerData.status} stage, confirmed on-chain (tx: ${txShort}).`;
    return {
      reply,
      intent: INTENTS.STATUS_CHECK,
      data: ledgerData
    };
  }

  // Case 2: WHO_APPROVED
  // Template: "{status} was signed off by {actor} ({org}) on {timestamp}."
  if (intent === INTENTS.WHO_APPROVED) {
    const history = ledgerData.history || [];
    if (history.length === 0) {
      return {
        reply: `${ledgerData.certId} is at ${ledgerData.status}, signed by ${ledgerData.actor || 'N/A'} (${ledgerData.org || 'N/A'}).`,
        intent: INTENTS.WHO_APPROVED,
        data: ledgerData
      };
    }

    // Find the latest approval entry or list all approval sign-offs
    const approvalEntries = history.filter(h => h.status !== 'SUBMITTED');
    if (approvalEntries.length === 0) {
      const initEntry = history[0];
      return {
        reply: `${ledgerData.certId} has only been SUBMITTED by ${initEntry.actor} (${initEntry.org}) on ${formatTime(initEntry.timestamp)} and has not yet been approved by faculty.`,
        intent: INTENTS.WHO_APPROVED,
        data: ledgerData
      };
    }

    const latest = approvalEntries[approvalEntries.length - 1];
    const detailsList = approvalEntries.map(h => 
      `• ${h.status} was signed off by ${h.actor} (${h.org}) on ${formatTime(h.timestamp)} (tx: ${h.txId.substring(0, 10)}...)`
    ).join('\n');

    const reply = `${latest.status} was signed off by ${latest.actor} (${latest.org}) on ${formatTime(latest.timestamp)}.\n\nFull Approvals Breakdown:\n${detailsList}`;

    return {
      reply,
      intent: INTENTS.WHO_APPROVED,
      data: ledgerData
    };
  }

  // Case 3: HISTORY_LOOKUP
  // Template: list each entry in history[] in order as "{status} — {actor}, {timestamp}"
  if (intent === INTENTS.HISTORY_LOOKUP) {
    const history = ledgerData.history || [];
    if (history.length === 0) {
      return {
        reply: `No lifecycle history records found for ${ledgerData.certId}. Current state: ${ledgerData.status}.`,
        intent: INTENTS.HISTORY_LOOKUP,
        data: ledgerData
      };
    }

    const stageLines = history.map((item, idx) => {
      const txShort = item.txId ? ` [tx: ${item.txId.substring(0, 10)}...]` : '';
      return `${idx + 1}. ${item.status} — ${item.actor} (${item.org}), ${formatTime(item.timestamp)}${txShort}`;
    }).join('\n');

    const reply = `📜 Blockchain Lifecycle History for ${ledgerData.certId}:\n${stageLines}\n\nCurrent Ledger Status: ${ledgerData.status}`;

    return {
      reply,
      intent: INTENTS.HISTORY_LOOKUP,
      data: ledgerData
    };
  }

  // Fallback
  return {
    reply: `I processed your request for ${ledgerData.certId}. Current status is ${ledgerData.status}.`,
    intent: INTENTS.UNKNOWN,
    data: ledgerData
  };
}


// ============================================================================
// 5. MASTER CHAT PROCESSOR PIPELINE
// ============================================================================

/**
 * Main entry point: takes raw user message string and returns Contract B response.
 * 
 * Contract B Shape:
 * {
 *   "reply": "string",
 *   "intent": "STATUS_CHECK | HISTORY_LOOKUP | WHO_APPROVED | GENERAL_HELP | UNKNOWN",
 *   "data": { ...Contract A object (optional)... }
 * }
 */
async function handleChatMessage(message) {
  if (!message || typeof message !== 'string') {
    return generateReply(INTENTS.GENERAL_HELP, {}, null);
  }

  // 1. Detect Intent
  const intent = detectIntent(message);

  // 2. Extract Entities (Certificate ID, Student ID)
  const entities = extractEntities(message);

  // 3. Fetch Ledger Data via Contract A (Stub or 5.1 Real Implementation)
  let ledgerData = null;
  if (entities.certId) {
    ledgerData = await fetchCertHistory(entities.certId);
  }

  // 4. Generate Natural Language Reply
  return generateReply(intent, entities, ledgerData);
}

module.exports = {
  CANONICAL_STAGES,
  INTENTS,
  extractEntities,
  detectIntent,
  fetchCertHistory,
  generateReply,
  handleChatMessage,
  MOCK_CONTRACT_A_STORE
};
