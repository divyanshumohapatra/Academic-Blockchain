'use strict';

const { invokeChaincode, queryChaincode } = require('../fabric');
const hfClient = require('./hfAgentClient');
const { signPayload, getActorSigningSecret } = require('../cryptoUtil');
const sisDatabase = require('../db/sisDatabase');

function cleanConfidence(val, defaultVal = 0.98) {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === 'number') {
    if (isNaN(val)) return defaultVal;
    if (val > 1.0) return Math.min(Math.max(val / 100, 0), 1.0);
    return Math.min(Math.max(val, 0), 1.0);
  }
  if (typeof val === 'string') {
    const cleaned = val.replace('%', '').trim();
    const num = parseFloat(cleaned);
    if (isNaN(num)) return defaultVal;
    if (num > 1.0) return Math.min(Math.max(num / 100, 0), 1.0);
    return Math.min(Math.max(num, 0), 1.0);
  }
  return defaultVal;
}

function parseLLMResponse(llmRes, defaultRationale) {
  let decision = 'APPROVE';
  let confidence = 0.98;
  let rationale = defaultRationale;

  const normalizeDecision = (val) => {
    if (!val) return 'APPROVE';
    const norm = String(val).toUpperCase();
    if (norm.includes('APPROV') || norm.includes('COMPLIANT') || norm.includes('PASS') || norm.includes('CLEAR') || norm.includes('ELIGIBLE') || norm.includes('VALID')) {
      return 'APPROVE';
    }
    if (norm.includes('REJECT') || norm.includes('DENY') || norm.includes('FAIL') || norm.includes('FLAG')) {
      return 'REJECT';
    }
    return norm;
  };

  if (llmRes && llmRes.content) {
    try {
      const cleaned = llmRes.content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.decision) decision = normalizeDecision(parsed.decision);
      if (parsed.confidence !== undefined) confidence = cleanConfidence(parsed.confidence);
      if (parsed.reasoning) rationale = parsed.reasoning;
    } catch (e) {
      const match = llmRes.content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.decision) decision = normalizeDecision(parsed.decision);
          if (parsed.confidence !== undefined) confidence = cleanConfidence(parsed.confidence);
          if (parsed.reasoning) rationale = parsed.reasoning;
        } catch (err) {
          rationale = llmRes.content.substring(0, 150);
        }
      } else {
        rationale = llmRes.content.substring(0, 150);
      }
    }
  }

  return { decision, confidence: cleanConfidence(confidence), rationale };
}

/**
 * 1. Faculty Coursework Audit Agent (Org 1)
 */
class FacultyAgent {
  constructor() {
    this.name = 'Agent-Faculty-Audit';
    this.orgNum = 1;
    this.role = 'Coursework & Attendance Verification';
  }

  async auditAndApprove(requestId, details = {}) {
    console.log(`[${this.name}] Running LLM verification on coursework & attendance for ${requestId}...`);

    const systemPrompt = `You are the University Faculty Academic Verification Agent (Org 1) on a Hyperledger Fabric consortium.
Audit coursework, continuous internal evaluation (CIE), and attendance.
Requirements:
1. Minimum statutory attendance: 75.0%.
2. Minimum CIE score: 20.0/50.
3. Prerequisites met: true.

Output valid JSON only:
{"decision":"APPROVE","confidence":0.98,"reasoning":"Verified attendance and CIE marks"}`;

    const userPrompt = `Student Request: ${requestId}, Attendance: ${details.attendance !== undefined ? details.attendance : 88.5}%, CIE: ${details.cieMarks !== undefined ? details.cieMarks : 42}/50, Prerequisites: ${details.prerequisitesMet !== undefined ? details.prerequisitesMet : true}`;

    const llmRes = await hfClient.generateReasoning(systemPrompt, userPrompt, { jsonMode: true });
    const { decision, confidence, rationale } = parseLLMResponse(
      llmRes, 
      `Coursework verified: Attendance=${details.attendance || 88.5}%, CIE=${details.cieMarks || 42}/50`
    );

    const isApproved = decision === 'APPROVE';
    if (!isApproved) {
      return {
        success: false,
        stage: 'FACULTY_APPROVED',
        agent: this.name,
        aiSource: llmRes.source,
        model: llmRes.model,
        confidence,
        rationale,
        escalate: true
      };
    }

    // Autonomously sign and approve eligible semester coursework marks across all faculties
    const studentId = details.studentId || (sisDatabase.getCertificateRequest(requestId)?.studentId) || (requestId ? requestId.replace(/^REQ-/i, 'STU-') : null);
    if (studentId) {
      sisDatabase.autoApproveAndSignEligibleCourseMarks(studentId);
    }

    const comments = `[${this.name} via ${llmRes.model}] Approved (Confidence: ${(confidence * 100).toFixed(1)}%). ${rationale}`;
    let txResult = null;
    try {
      txResult = await invokeChaincode('ApproveFaculty', [requestId, this.name, comments], this.orgNum);
    } catch (e) {
      txResult = { simulated: true, note: e.message };
    }

    return {
      success: true,
      stage: 'FACULTY_APPROVED',
      agent: this.name,
      aiSource: llmRes.source,
      model: llmRes.model,
      confidence,
      rationale,
      txResult
    };
  }
}

/**
 * 2. Faculty Advisor Comprehensive Eligibility Agent (Org 1)
 */
class FacultyAdvisorAgent {
  constructor() {
    this.name = 'Agent-Faculty-Advisor';
    this.orgNum = 1;
    this.role = 'Multi-Faculty Cross-Course Prerequisite & Eligibility Gate';
  }

  async auditAndEndorse(requestId, studentId, details = {}) {
    const rawTarget = studentId || details.studentId || (sisDatabase.getCertificateRequest(requestId)?.studentId) || (requestId ? requestId.replace(/^REQ-/i, 'STU-') : null);
    const studentRecord = rawTarget ? sisDatabase.getStudentByRollNumber(rawTarget) : null;
    const targetStudentId = studentRecord ? studentRecord.studentId : rawTarget;
    console.log(`[${this.name}] Running cross-course audit from all faculties for student ${targetStudentId}...`);

    if (targetStudentId) {
      try {
        sisDatabase.autoApproveAndSignEligibleCourseMarks(targetStudentId);
      } catch (e) {
        // fallback
      }
    }

    const audit = sisDatabase.getStudentComprehensiveAudit(targetStudentId);
    const isEligible = audit ? audit.isEligible : (details.attendance >= 75 && details.cieMarks >= 20);

    const systemPrompt = `You are the Faculty Advisor Autonomous Agent (Org 1).
Audit if all courses are graded and signed by their respective instructors, attendance is >= 75%, and student is eligible.
Output valid JSON only:
{"decision":"APPROVE","confidence":0.99,"reasoning":"All 5 faculties have signed passing marks."}`;

    const userPrompt = `Student ID: ${targetStudentId}, Request ID: ${requestId}, Eligible: ${isEligible}, Completed Courses: ${audit ? audit.coursesSubmitted : 5}/${audit ? audit.coursesTotal : 5}, Deficits: ${audit ? JSON.stringify(audit.deficitReasons) : 'None'}`;

    const llmRes = await hfClient.generateReasoning(systemPrompt, userPrompt, { jsonMode: true });
    const { decision, confidence, rationale } = parseLLMResponse(
      llmRes,
      isEligible ? 'All course requirements verified from all faculties. Student endorsed for DAC review.' : 'Deficits in course requirements.'
    );

    if (!isEligible || decision !== 'APPROVE') {
      return {
        success: false,
        stage: 'FA_APPROVED',
        agent: this.name,
        confidence: 0.2,
        rationale: (audit && audit.deficitReasons.length > 0) ? audit.deficitReasons.join('; ') : rationale,
        escalate: true,
        auditDetails: audit
      };
    }

    const secret = getActorSigningSecret('FACULTY_ADVISOR');
    const faSignature = signPayload({ requestId, studentId: targetStudentId, timestamp: new Date().toISOString() }, secret);
    const comments = `[${this.name}] Comprehensive check passed for all subjects. Signed by FA.`;

    let txResult = null;
    try {
      txResult = await invokeChaincode('ApproveFacultyAdvisor', [requestId, this.name, comments, faSignature], this.orgNum);
    } catch (e) {
      try {
        txResult = await invokeChaincode('ApproveHOD', [requestId, this.name, comments], this.orgNum);
      } catch (eHod) {
        txResult = { simulated: true, note: e.message, fallbackNote: eHod.message };
      }
    }

    return {
      success: true,
      stage: 'FA_APPROVED',
      agent: this.name,
      signature: faSignature,
      confidence,
      rationale,
      txResult,
      auditDetails: audit
    };
  }
}

/**
 * 3. HOD Agent (DAC Chair) (Org 1)
 */
class HODAgent {
  constructor() {
    this.name = 'Agent-HOD-Curriculum';
    this.orgNum = 1;
    this.role = 'Departmental Curriculum & Credit Audit';
  }

  async auditAndApprove(requestId, details = {}) {
    console.log(`[${this.name}] Running HOD curriculum & credit audit for ${requestId}...`);

    const systemPrompt = `You are the Head of Department (HOD) Academic Agent (Org 1).
Audit student credit requirements and disciplinary clearance.
Requirements:
1. Total credits must be >= 160.
2. Disciplinary clearance must be clean.

Output valid JSON only:
{"decision":"APPROVE","confidence":0.99,"reasoning":"Credits threshold and disciplinary standing verified."}`;

    const userPrompt = `Request: ${requestId}, Credits: ${details.totalCredits || 164}/160, Disciplinary Clearance: ${details.disciplinaryClearance !== undefined ? details.disciplinaryClearance : true}`;

    const llmRes = await hfClient.generateReasoning(systemPrompt, userPrompt, { jsonMode: true });
    const { decision, confidence, rationale } = parseLLMResponse(
      llmRes,
      `Curriculum criteria met: Credits=${details.totalCredits || 164}/${details.requiredCredits || 160}`
    );

    const isApproved = decision === 'APPROVE';
    if (!isApproved) {
      return {
        success: false,
        stage: 'HOD_APPROVED',
        agent: this.name,
        aiSource: llmRes.source,
        model: llmRes.model,
        confidence,
        rationale,
        escalate: true
      };
    }

    const comments = `[${this.name} via ${llmRes.model}] Verified (Confidence: ${(confidence * 100).toFixed(1)}%). ${rationale}`;
    let txResult = null;
    try {
      txResult = await invokeChaincode('ApproveHOD', [requestId, this.name, comments], this.orgNum);
    } catch (e) {
      txResult = { simulated: true, note: e.message };
    }

    return {
      success: true,
      stage: 'HOD_APPROVED',
      agent: this.name,
      aiSource: llmRes.source,
      model: llmRes.model,
      confidence,
      rationale,
      txResult
    };
  }
}

/**
 * 4. DAC Committee Member Agents (Multi-Sig Consensus)
 */
class DACMultiSigEngine {
  constructor() {
    this.members = [
      { id: 'DAC-MEMBER-HOD', name: 'Prof. K. V. Rao', role: 'HOD & DAC Chair', agentName: 'Agent-DAC-HOD-Chair' },
      { id: 'DAC-MEMBER-CURRICULUM', name: 'Dr. Sunita Rao', role: 'DAC Curriculum Lead', agentName: 'Agent-DAC-Curriculum-Lead' },
      { id: 'DAC-MEMBER-CAPSTONE', name: 'Dr. Anand Patel', role: 'DAC Research & Capstone Lead', agentName: 'Agent-DAC-Capstone-Lead' }
    ];
  }

  async runAutonomousMultiSig(requestId, details = {}) {
    console.log(`[DACMultiSigEngine] Executing autonomous DAC multi-sig consensus for ${requestId}...`);
    const votes = [];
    const capstoneScore = details.capstoneScore !== undefined ? Number(details.capstoneScore) : 88;
    const originality = details.originalityReport !== undefined ? Number(details.originalityReport) : 94;
    const credits = details.totalCredits !== undefined ? Number(details.totalCredits) : 164;

    for (const m of this.members) {
      const secret = getActorSigningSecret(m.id);
      const signature = signPayload({ requestId, memberId: m.id, role: m.role, timestamp: new Date().toISOString() }, secret);
      const isApproved = credits >= 160 && capstoneScore >= 60 && originality >= 80;
      const decision = isApproved ? 'APPROVE' : 'REJECT';
      const comments = isApproved ? `${m.role} verified departmental criteria (Credits: ${credits}, Capstone: ${capstoneScore}/100, Originality: ${originality}%)` : 'Deficit criteria';

      sisDatabase.recordMultiSigVote(requestId, 'DAC', m.id, m.name, m.role, decision, signature, comments);

      try {
        await invokeChaincode('ApproveDACMultiSig', [requestId, m.id, signature, comments], 1);
      } catch (e) {
        // chaincode invoke
      }

      votes.push({
        memberId: m.id,
        name: m.name,
        role: m.role,
        decision,
        signature,
        comments
      });
    }

    const status = sisDatabase.getMultiSigStatus(requestId, 'DAC');
    return {
      stage: 'DAC_APPROVED',
      quorumMet: status.isMajorityPassed,
      approvalCount: status.approvalCount,
      totalVotes: status.totalVotes,
      requiredQuorum: status.requiredQuorum,
      confidence: 0.99,
      votes
    };
  }
}

// Backward compatibility legacy DACAgent
class DACAgent {
  constructor() {
    this.name = 'Agent-DAC-Committee';
    this.orgNum = 1;
    this.role = 'Academic Committee & Capstone Evaluation';
  }

  async auditAndApprove(requestId, details = {}) {
    const engine = new DACMultiSigEngine();
    const result = await engine.runAutonomousMultiSig(requestId, details);
    return {
      success: result.quorumMet,
      stage: 'DAC_APPROVED',
      agent: this.name,
      confidence: 0.98,
      rationale: `DAC majority consensus satisfied (${result.approvalCount}/${result.totalVotes} votes).`,
      txResult: result
    };
  }
}

/**
 * 5. Examination Board Agent (Org 2)
 */
class ExamLockAgent {
  constructor() {
    this.name = 'Agent-Exam-Controller';
    this.orgNum = 2;
    this.role = 'Grade Registry Lockdown & SHA-256 Merkle Digest';
  }

  async auditAndLock(requestId, details = {}) {
    console.log(`[${this.name}] Running Examination Board LLM grade validation for ${requestId}...`);

    const cgpa = details.cgpa !== undefined ? Number(details.cgpa) : 8.85;
    const backlogs = details.backlogs !== undefined ? Number(details.backlogs) : 0;

    const crypto = require('crypto');
    const gradesHash = 'GRADES_SHA256_' + crypto.createHash('sha256')
      .update(`${requestId}_CGPA:${cgpa}_BACKLOGS:${backlogs}_TIMESTAMP:${Date.now()}`)
      .digest('hex').substring(0, 32);

    const systemPrompt = `You are the Examination Controller Agent (Org 2) on Hyperledger Fabric.
Verify student CGPA >= 5.0 and ZERO active backlogs before locking grades on the blockchain.
Output valid JSON only:
{"decision":"APPROVE","confidence":0.99,"reasoning":"Grade registry verified with zero active backlogs."}`;

    const userPrompt = `Request: ${requestId}, CGPA: ${cgpa}/10.0, Backlogs: ${backlogs}, Computed Merkle Hash: ${gradesHash}`;
    const llmRes = await hfClient.generateReasoning(systemPrompt, userPrompt, { jsonMode: true });

    const { decision, confidence, rationale } = parseLLMResponse(
      llmRes,
      `Grade registry verified: CGPA=${cgpa}/10.00, Active Backlogs=0. Merkle Hash: ${gradesHash}`
    );

    const isApproved = decision === 'APPROVE' && backlogs === 0;
    if (!isApproved) {
      return { success: false, stage: 'EXAM_LOCKED', agent: this.name, confidence: 0.2, rationale: 'Active backlogs found', escalate: true };
    }

    const comments = `[${this.name} via ${llmRes.model}] Locked (Confidence: ${(confidence * 100).toFixed(1)}%). ${rationale}`;
    let txResult = null;
    try {
      txResult = await invokeChaincode('LockExamGrades', [requestId, this.name, gradesHash, comments], this.orgNum);
    } catch (e) {
      txResult = { simulated: true, note: e.message };
    }

    return {
      success: true,
      stage: 'EXAM_LOCKED',
      agent: this.name,
      aiSource: llmRes.source,
      model: llmRes.model,
      confidence,
      gradesHash,
      rationale,
      txResult
    };
  }
}

/**
 * 6. Dean Academics Senate Board Multi-Sig Engine (Org 3)
 */
class DeanMultiSigEngine {
  constructor() {
    this.members = [
      { id: 'DEAN-OFFICE-CHAIR', name: 'Prof. P. Chandrasekhar', role: 'Dean (Academic Affairs)', agentName: 'Agent-Dean-Academics' },
      { id: 'DEAN-OFFICE-ASSOC', name: 'Prof. S. R. Murthy', role: 'Associate Dean (Curriculum & Exams)', agentName: 'Agent-Assoc-Dean' },
      { id: 'SENATE-BOARD-EXT', name: 'Prof. M. V. Ramana', role: 'Academic Senate Representative', agentName: 'Agent-Senate-Board' }
    ];
  }

  async runAutonomousMultiSig(requestId, details = {}) {
    console.log(`[DeanMultiSigEngine] Executing autonomous Dean Board multi-sig consensus for ${requestId}...`);
    const votes = [];
    const residencyMet = details.residencyMet !== undefined ? details.residencyMet : true;
    const institutionalClearance = details.institutionalClearance !== undefined ? details.institutionalClearance : true;

    for (const m of this.members) {
      const secret = getActorSigningSecret(m.id);
      const signature = signPayload({ requestId, memberId: m.id, role: m.role, timestamp: new Date().toISOString() }, secret);
      const isApproved = residencyMet && institutionalClearance;
      const decision = isApproved ? 'APPROVE' : 'REJECT';
      const comments = isApproved ? `${m.role} sanctioned degree conferral based on institutional residency.` : 'Residency or clearance deficit';

      sisDatabase.recordMultiSigVote(requestId, 'DEAN', m.id, m.name, m.role, decision, signature, comments);

      try {
        await invokeChaincode('ApproveDeanMultiSig', [requestId, m.id, signature, comments], 3);
      } catch (e) {
        // invoke
      }

      votes.push({
        memberId: m.id,
        name: m.name,
        role: m.role,
        decision,
        signature,
        comments
      });
    }

    const status = sisDatabase.getMultiSigStatus(requestId, 'DEAN');
    return {
      stage: 'DEAN_APPROVED',
      quorumMet: status.isMajorityPassed,
      approvalCount: status.approvalCount,
      totalVotes: status.totalVotes,
      requiredQuorum: status.requiredQuorum,
      confidence: 0.99,
      votes
    };
  }
}

// Backward compatibility legacy DeanAgent
class DeanAgent {
  constructor() {
    this.name = 'Agent-Dean-Academics';
    this.orgNum = 3;
    this.role = 'Institutional Compliance & Executive Sanction';
  }

  async auditAndApprove(requestId, details = {}) {
    const engine = new DeanMultiSigEngine();
    const result = await engine.runAutonomousMultiSig(requestId, details);
    return {
      success: result.quorumMet,
      stage: 'DEAN_APPROVED',
      agent: this.name,
      confidence: 0.99,
      rationale: `Dean Board majority consensus satisfied (${result.approvalCount}/${result.totalVotes} votes).`,
      txResult: result
    };
  }
}

/**
 * 7. Admin Finalize Agent (Org 3)
 */
class AdminFinalizeAgent {
  constructor() {
    this.name = 'Agent-Admin-Registrar';
    this.orgNum = 3;
    this.role = 'Fee & Library Dues Clearance & Final Authorization';
  }

  async auditAndFinalize(requestId, details = {}) {
    console.log(`[${this.name}] Running Registrar Clearance check for ${requestId}...`);

    const feeDues = details.feeDues !== undefined ? Number(details.feeDues) : 0;
    const libraryDues = details.libraryDues !== undefined ? Number(details.libraryDues) : 0;
    const isApproved = feeDues === 0 && libraryDues === 0;

    const confidence = isApproved ? 0.99 : 0.10;
    const rationale = isApproved
      ? `All administrative dues cleared (Fee Dues: ₹0, Library Dues: ₹0). Final clearance verified.`
      : `Administrative clearance blocked: Fee Dues=₹${feeDues}, Library Dues=₹${libraryDues}`;

    if (!isApproved) {
      return { success: false, stage: 'ADMIN_FINALIZED', agent: this.name, confidence, rationale, escalate: true };
    }

    const comments = `[${this.name}] Finalized (Confidence: ${(confidence * 100).toFixed(1)}%). ${rationale}`;
    let txResult = null;
    try {
      txResult = await invokeChaincode('FinalizeAdmin', [requestId, this.name, comments], this.orgNum);
    } catch (e) {
      txResult = { simulated: true, note: e.message };
    }

    return {
      success: true,
      stage: 'ADMIN_FINALIZED',
      agent: this.name,
      confidence,
      rationale,
      txResult
    };
  }
}

module.exports = {
  FacultyAgent,
  FacultyAdvisorAgent,
  HODAgent,
  DACAgent,
  DACMultiSigEngine,
  ExamLockAgent,
  DeanAgent,
  DeanMultiSigEngine,
  AdminFinalizeAgent
};
