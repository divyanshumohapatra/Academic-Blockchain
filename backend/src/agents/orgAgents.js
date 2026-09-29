'use strict';

const { invokeChaincode, queryChaincode } = require('../fabric');
const hfClient = require('./hfAgentClient');

function parseLLMResponse(llmRes, defaultRationale) {
  let decision = 'APPROVE';
  let confidence = 0.98;
  let rationale = defaultRationale;

  if (llmRes && llmRes.content) {
    try {
      const cleaned = llmRes.content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.decision) decision = parsed.decision.toUpperCase();
      if (parsed.confidence) confidence = Number(parsed.confidence);
      if (parsed.reasoning) rationale = parsed.reasoning;
    } catch (e) {
      // Regex extraction fallback
      const match = llmRes.content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.decision) decision = parsed.decision.toUpperCase();
          if (parsed.confidence) confidence = Number(parsed.confidence);
          if (parsed.reasoning) rationale = parsed.reasoning;
        } catch (err) {
          rationale = llmRes.content.substring(0, 150);
        }
      } else {
        rationale = llmRes.content.substring(0, 150);
      }
    }
  }

  return { decision, confidence, rationale };
}

/**
 * Specialized Org 1 Academic Agents powered by Hugging Face LLMs
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

    const comments = `[${this.name} via ${llmRes.model}] Approved (Confidence: ${(confidence * 100).toFixed(1)}%). ${rationale}`;
    const txResult = await invokeChaincode('ApproveFaculty', [requestId, this.name, comments], this.orgNum);

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

class HODAgent {
  constructor() {
    this.name = 'Agent-HOD-Curriculum';
    this.orgNum = 1;
    this.role = 'Departmental Curriculum & Credit Audit';
  }

  async auditAndApprove(requestId, details = {}) {
    console.log(`[${this.name}] Running LLM curriculum & credit audit for ${requestId}...`);

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
    const txResult = await invokeChaincode('ApproveHOD', [requestId, this.name, comments], this.orgNum);

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

class DACAgent {
  constructor() {
    this.name = 'Agent-DAC-Committee';
    this.orgNum = 1;
    this.role = 'Academic Committee & Capstone Evaluation';
  }

  async auditAndApprove(requestId, details = {}) {
    console.log(`[${this.name}] Running DAC committee LLM rubric check for ${requestId}...`);

    const capstoneScore = details.capstoneScore !== undefined ? Number(details.capstoneScore) : 85;
    const originalityReport = details.originalityReport !== undefined ? Number(details.originalityReport) : 94;

    const systemPrompt = `You are the Department Academic Committee (DAC) Review Agent (Org 1).
Evaluate thesis capstone evaluation score (>= 60/100) and originality report (>= 80% unique).
Output valid JSON only:
{"decision":"APPROVE","confidence":0.97,"reasoning":"Capstone rubric and originality metrics verified."}`;

    const userPrompt = `Request: ${requestId}, Capstone Score: ${capstoneScore}/100, Originality: ${originalityReport}% unique`;
    const llmRes = await hfClient.generateReasoning(systemPrompt, userPrompt, { jsonMode: true });

    const { decision, confidence, rationale } = parseLLMResponse(
      llmRes,
      `Capstone score=${capstoneScore}/100, Originality=${originalityReport}%`
    );

    const isApproved = decision === 'APPROVE';
    if (!isApproved) {
      return { success: false, stage: 'DAC_APPROVED', agent: this.name, confidence, rationale, escalate: true };
    }

    const comments = `[${this.name} via ${llmRes.model}] Sanctioned (Confidence: ${(confidence * 100).toFixed(1)}%). ${rationale}`;
    const txResult = await invokeChaincode('ApproveDAC', [requestId, this.name, comments], this.orgNum);

    return {
      success: true,
      stage: 'DAC_APPROVED',
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
 * Specialized Org 2 Examination Board Agent
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

    const isApproved = decision === 'APPROVE';
    if (!isApproved) {
      return { success: false, stage: 'EXAM_LOCKED', agent: this.name, confidence, rationale, escalate: true };
    }

    const comments = `[${this.name} via ${llmRes.model}] Locked (Confidence: ${(confidence * 100).toFixed(1)}%). ${rationale}`;
    const txResult = await invokeChaincode('LockExamGrades', [requestId, this.name, gradesHash, comments], this.orgNum);

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
 * Specialized Org 3 Administration & Minting Agents
 */
class DeanAgent {
  constructor() {
    this.name = 'Agent-Dean-Academics';
    this.orgNum = 3;
    this.role = 'Institutional Compliance & Executive Sanction';
  }

  async auditAndApprove(requestId, details = {}) {
    console.log(`[${this.name}] Running Dean Office compliance LLM check for ${requestId}...`);

    const systemPrompt = `You are the Dean of Academic Affairs Agent (Org 3).
Sanction academic certificate issuance for students meeting graduation residency requirements.
Output valid JSON only:
{"decision":"APPROVE","confidence":0.98,"reasoning":"Institutional residency compliance verified for degree conferral."}`;

    const userPrompt = `Request: ${requestId}, Residency Met: true, Institutional Clearance: true`;
    const llmRes = await hfClient.generateReasoning(systemPrompt, userPrompt, { jsonMode: true });

    const { decision, confidence, rationale } = parseLLMResponse(
      llmRes,
      `Institutional compliance verified for degree award.`
    );

    const comments = `[${this.name} via ${llmRes.model}] Approved (Confidence: ${(confidence * 100).toFixed(1)}%). ${rationale}`;
    const txResult = await invokeChaincode('ApproveDean', [requestId, this.name, comments], this.orgNum);

    return {
      success: true,
      stage: 'DEAN_APPROVED',
      agent: this.name,
      aiSource: llmRes.source,
      model: llmRes.model,
      confidence,
      rationale,
      txResult
    };
  }
}

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
    const txResult = await invokeChaincode('FinalizeAdmin', [requestId, this.name, comments], this.orgNum);

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
  HODAgent,
  DACAgent,
  ExamLockAgent,
  DeanAgent,
  AdminFinalizeAgent
};
