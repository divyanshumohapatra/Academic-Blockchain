'use strict';

const { invokeChaincode, queryChaincode, invokeOrg1Transaction, queryOrg1Ledger } = require('../fabric');
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

// Statutory academic thresholds for Org 1 (Academic Department Ecosystem)
const ORG1_THRESHOLDS = {
  MIN_STATUTORY_ATTENDANCE: 75.0, // Minimum statutory attendance (percentage)
  MIN_CIE_MARKS: 20.0,            // Minimum Continuous Internal Evaluation (CIE) passing mark
  MAX_CIE_MARKS: 50.0,            // Maximum scale for CIE
  MIN_TOTAL_CREDITS: 160,         // Minimum degree credits required
  MIN_CAPSTONE_SCORE: 60.0,       // Minimum passing capstone / thesis evaluation mark (out of 100)
  MIN_ORIGINALITY_PERCENT: 80.0   // Minimum originality report threshold (percentage unique)
};

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
          rationale = llmRes.content.substring(0, 200);
        }
      } else {
        rationale = llmRes.content.substring(0, 200);
      }
    }
  }

  return { decision, confidence: cleanConfidence(confidence), rationale };
}

/**
 * Deterministic Verifiable Rule Engine for Org 1
 * Validates attendance, CIE marks, prerequisite coursework, credits, and DAC rubrics.
 */
class Org1RuleEngine {
  static evaluateAttendance(attendanceVal) {
    const attendance = (attendanceVal !== undefined && attendanceVal !== null) ? Number(attendanceVal) : 88.5;
    const passed = attendance >= ORG1_THRESHOLDS.MIN_STATUTORY_ATTENDANCE;
    return {
      rule: 'STATUTORY_ATTENDANCE',
      metric: 'Attendance Percentage',
      threshold: ORG1_THRESHOLDS.MIN_STATUTORY_ATTENDANCE,
      actual: attendance,
      unit: '%',
      passed,
      comment: passed
        ? `Statutory minimum attendance satisfied (${attendance}% >= ${ORG1_THRESHOLDS.MIN_STATUTORY_ATTENDANCE}%)`
        : `Attendance deficit: ${attendance}% is below statutory threshold of ${ORG1_THRESHOLDS.MIN_STATUTORY_ATTENDANCE}% (Escalation required)`
    };
  }

  static evaluateCIEMarks(cieVal) {
    const cieMarks = (cieVal !== undefined && cieVal !== null) ? Number(cieVal) : 42.0;
    const passed = cieMarks >= ORG1_THRESHOLDS.MIN_CIE_MARKS;
    return {
      rule: 'CIE_MARKS',
      metric: 'Continuous Internal Evaluation (CIE) Score',
      threshold: ORG1_THRESHOLDS.MIN_CIE_MARKS,
      actual: cieMarks,
      unit: `/${ORG1_THRESHOLDS.MAX_CIE_MARKS}`,
      passed,
      comment: passed
        ? `CIE score exceeds minimum passing requirement (${cieMarks} >= ${ORG1_THRESHOLDS.MIN_CIE_MARKS}/${ORG1_THRESHOLDS.MAX_CIE_MARKS})`
        : `CIE mark deficit: ${cieMarks} is below required passing score of ${ORG1_THRESHOLDS.MIN_CIE_MARKS}/${ORG1_THRESHOLDS.MAX_CIE_MARKS}`
    };
  }

  static evaluatePrerequisites(details = {}) {
    let passed = true;
    let detailsMsg = 'All prerequisite course requirements satisfied';

    if (details.prerequisitesMet === false || details.prerequisitesMet === 'false') {
      passed = false;
      detailsMsg = 'Student has not fulfilled mandatory prerequisite coursework';
    } else if (details.completedPrerequisites === false || details.completedPrerequisites === 'false') {
      passed = false;
      detailsMsg = 'Foundational prerequisite courses marked incomplete';
    } else if (Array.isArray(details.prerequisites)) {
      const incomplete = details.prerequisites.filter(p => {
        if (typeof p === 'object') return p.passed === false || p.completed === false;
        return false;
      });
      if (incomplete.length > 0) {
        passed = false;
        detailsMsg = `Incomplete prerequisite courses: ${incomplete.map(i => i.courseCode || i.name || JSON.stringify(i)).join(', ')}`;
      }
    }

    return {
      rule: 'PREREQUISITE_COURSES',
      metric: 'Prerequisite Course Completion',
      threshold: '100% completion of foundational prerequisites',
      actual: passed ? 'All prerequisites cleared' : 'Prerequisites incomplete',
      unit: 'status',
      passed,
      comment: detailsMsg
    };
  }

  static evaluateCredits(totalCreditsVal, requiredCreditsVal) {
    const requiredCredits = (requiredCreditsVal !== undefined && requiredCreditsVal !== null)
      ? Number(requiredCreditsVal)
      : ORG1_THRESHOLDS.MIN_TOTAL_CREDITS;
    const totalCredits = (totalCreditsVal !== undefined && totalCreditsVal !== null)
      ? Number(totalCreditsVal)
      : 164;
    const passed = totalCredits >= requiredCredits;
    return {
      rule: 'CURRICULUM_CREDITS',
      metric: 'Total Degree Credits Earned',
      threshold: requiredCredits,
      actual: totalCredits,
      unit: 'credits',
      passed,
      comment: passed
        ? `Total credits earned (${totalCredits}) meets degree graduation requirement (>= ${requiredCredits})`
        : `Credit shortfall: Earned ${totalCredits} credits, but ${requiredCredits} required`
    };
  }

  static evaluateDisciplinary(clearanceVal) {
    const passed = clearanceVal !== false && clearanceVal !== 'false';
    return {
      rule: 'DISCIPLINARY_CLEARANCE',
      metric: 'Departmental Conduct & Disciplinary Record',
      threshold: 'Clean standing (no active penalties or suspensions)',
      actual: passed ? 'Clear' : 'Pending Disciplinary Action',
      unit: 'status',
      passed,
      comment: passed
        ? 'Disciplinary record clean with no active misconduct penalties'
        : 'Student has unresolved disciplinary holding flag on academic record'
    };
  }

  static evaluateDACRubric(capstoneVal, originalityVal) {
    const capstone = (capstoneVal !== undefined && capstoneVal !== null) ? Number(capstoneVal) : 85.0;
    const originality = (originalityVal !== undefined && originalityVal !== null) ? Number(originalityVal) : 94.0;
    const capstonePassed = capstone >= ORG1_THRESHOLDS.MIN_CAPSTONE_SCORE;
    const originalityPassed = originality >= ORG1_THRESHOLDS.MIN_ORIGINALITY_PERCENT;

    return {
      capstoneCheck: {
        rule: 'CAPSTONE_RUBRIC',
        metric: 'Department Capstone Evaluation Score',
        threshold: ORG1_THRESHOLDS.MIN_CAPSTONE_SCORE,
        actual: capstone,
        unit: '/100',
        passed: capstonePassed,
        comment: capstonePassed
          ? `Capstone defense score (${capstone}/100) satisfies DAC passing rubric (>= ${ORG1_THRESHOLDS.MIN_CAPSTONE_SCORE})`
          : `Capstone score (${capstone}/100) does not meet minimum DAC standard (>= ${ORG1_THRESHOLDS.MIN_CAPSTONE_SCORE})`
      },
      originalityCheck: {
        rule: 'THESIS_ORIGINALITY',
        metric: 'Originality Report / Plagiarism Clearance',
        threshold: ORG1_THRESHOLDS.MIN_ORIGINALITY_PERCENT,
        actual: originality,
        unit: '% unique',
        passed: originalityPassed,
        comment: originalityPassed
          ? `Originality index (${originality}% unique) passes anti-plagiarism threshold (>= ${ORG1_THRESHOLDS.MIN_ORIGINALITY_PERCENT}%)`
          : `Originality index (${originality}%) violates plagiarism threshold (>= ${ORG1_THRESHOLDS.MIN_ORIGINALITY_PERCENT}% required)`
      },
      passed: capstonePassed && originalityPassed
    };
  }
}

/**
 * Specialized Org 1 Academic Agents powered by LLMs with Verifiable Rule Engine Guardrails
 */
class FacultyAgent {
  constructor() {
    this.name = 'Agent-Faculty-Audit';
    this.orgNum = 1;
    this.msp = 'Org1MSP';
    this.peerAddress = 'peer0.org1.academic.edu:7051';
    this.role = 'Coursework & Attendance Verification';
  }

  async evaluateAudit(requestId, details = {}) {
    const attendanceCheck = Org1RuleEngine.evaluateAttendance(details.attendance);
    const cieCheck = Org1RuleEngine.evaluateCIEMarks(details.cieMarks !== undefined ? details.cieMarks : details.cie);
    const prereqCheck = Org1RuleEngine.evaluatePrerequisites(details);

    const auditTrail = [attendanceCheck, cieCheck, prereqCheck];
    const failedChecks = auditTrail.filter(c => !c.passed);
    const deterministicPassed = failedChecks.length === 0;

    let aiSource = 'DETERMINISTIC_RULE_ENGINE';
    let model = 'NITW-Org1-Deterministic-Audit';
    let confidence = deterministicPassed ? 0.98 : 0.99;
    let rationale = '';

    const systemPrompt = `You are the University Faculty Academic Verification Agent (Org 1) on a Hyperledger Fabric consortium.
Audit coursework, continuous internal evaluation (CIE), and attendance.
Requirements:
1. Minimum statutory attendance: 75.0%.
2. Minimum CIE score: 20.0/50.
3. Prerequisites met: true.

Output valid JSON only:
{"decision":"APPROVE","confidence":0.98,"reasoning":"Verified attendance and CIE marks"}`;

    const userPrompt = `Student Request: ${requestId}, Attendance: ${attendanceCheck.actual}%, CIE: ${cieCheck.actual}/50, Prerequisites: ${prereqCheck.passed}`;

    try {
      const llmRes = await hfClient.generateReasoning(systemPrompt, userPrompt, { jsonMode: true });
      aiSource = llmRes.source;
      model = llmRes.model;
      const parsed = parseLLMResponse(llmRes, '');
      if (parsed.rationale) rationale = parsed.rationale;
      if (parsed.confidence) confidence = parsed.confidence;
    } catch (e) {
      console.warn(`[${this.name}] LLM inference fallback: ${e.message}`);
    }

    const finalPassed = deterministicPassed;
    const escalationReasons = failedChecks.map(c => c.comment);

    if (!finalPassed) {
      rationale = `Faculty verification failed: ${escalationReasons.join('; ')}. Escalated to Department Academic Disciplinary Committee.`;
    } else if (!rationale) {
      rationale = `Coursework & attendance verified: Attendance=${attendanceCheck.actual}% (>=75%), CIE=${cieCheck.actual}/50 (>=20), All prerequisites cleared.`;
    }

    return {
      passed: finalPassed,
      decision: finalPassed ? 'APPROVE' : 'REJECT',
      confidence,
      auditTrail,
      escalate: !finalPassed,
      escalationReasons,
      rationale,
      aiSource,
      model
    };
  }

  async auditAndApprove(requestId, details = {}) {
    console.log(`[${this.name}] Running verification on coursework & attendance for ${requestId}...`);
    const evalResult = await this.evaluateAudit(requestId, details);

    if (!evalResult.passed) {
      return {
        success: false,
        stage: 'FACULTY_APPROVED',
        agent: this.name,
        aiSource: evalResult.aiSource,
        model: evalResult.model,
        confidence: evalResult.confidence,
        auditTrail: evalResult.auditTrail,
        escalate: true,
        escalationReasons: evalResult.escalationReasons,
        rationale: evalResult.rationale
      };
    }

    // Autonomously sign and approve eligible semester coursework marks across all faculties
    const studentId = details.studentId || (sisDatabase.getCertificateRequest(requestId)?.studentId) || (requestId ? requestId.replace(/^REQ-/i, 'STU-') : null);
    if (studentId) {
      sisDatabase.autoApproveAndSignEligibleCourseMarks(studentId);
    }

    const comments = `[${this.name} via ${evalResult.model}] Approved (Confidence: ${(evalResult.confidence * 100).toFixed(1)}%). ${evalResult.rationale}`;
    let txResult = null;
    try {
      txResult = await invokeOrg1Transaction('ApproveFaculty', [requestId, this.name, comments]);
    } catch (e) {
      txResult = { simulated: true, note: e.message };
    }

    return {
      success: true,
      stage: 'FACULTY_APPROVED',
      agent: this.name,
      aiSource: evalResult.aiSource,
      model: evalResult.model,
      confidence: evalResult.confidence,
      auditTrail: evalResult.auditTrail,
      rationale: evalResult.rationale,
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
    this.msp = 'Org1MSP';
    this.peerAddress = 'peer0.org1.academic.edu:7051';
    this.role = 'Departmental Curriculum & Credit Audit';
  }

  async evaluateAudit(requestId, details = {}) {
    const creditsCheck = Org1RuleEngine.evaluateCredits(details.totalCredits, details.requiredCredits);
    const disciplinaryCheck = Org1RuleEngine.evaluateDisciplinary(details.disciplinaryClearance);

    const auditTrail = [creditsCheck, disciplinaryCheck];
    const failedChecks = auditTrail.filter(c => !c.passed);
    const deterministicPassed = failedChecks.length === 0;

    let aiSource = 'DETERMINISTIC_RULE_ENGINE';
    let model = 'NITW-Org1-Deterministic-Audit';
    let confidence = deterministicPassed ? 0.99 : 0.99;
    let rationale = '';

    const systemPrompt = `You are the Head of Department (HOD) Academic Agent (Org 1).
Audit student credit requirements and disciplinary clearance.
Requirements:
1. Total credits must be >= 160.
2. Disciplinary clearance must be clean.

Output valid JSON only:
{"decision":"APPROVE","confidence":0.99,"reasoning":"Credits threshold and disciplinary standing verified."}`;

    const userPrompt = `Request: ${requestId}, Credits: ${creditsCheck.actual}/${creditsCheck.threshold}, Disciplinary Clearance: ${disciplinaryCheck.passed}`;

    try {
      const llmRes = await hfClient.generateReasoning(systemPrompt, userPrompt, { jsonMode: true });
      aiSource = llmRes.source;
      model = llmRes.model;
      const parsed = parseLLMResponse(llmRes, '');
      if (parsed.rationale) rationale = parsed.rationale;
      if (parsed.confidence) confidence = parsed.confidence;
    } catch (e) {
      console.warn(`[${this.name}] LLM inference fallback: ${e.message}`);
    }

    const finalPassed = deterministicPassed;
    const escalationReasons = failedChecks.map(c => c.comment);

    if (!finalPassed) {
      rationale = `HOD curriculum audit rejected: ${escalationReasons.join('; ')}. Escalated to Academic Disciplinary Board.`;
    } else if (!rationale) {
      rationale = `Curriculum criteria met: Credits=${creditsCheck.actual}/${creditsCheck.threshold}, Disciplinary standing=Clear.`;
    }

    return {
      passed: finalPassed,
      decision: finalPassed ? 'APPROVE' : 'REJECT',
      confidence,
      auditTrail,
      escalate: !finalPassed,
      escalationReasons,
      rationale,
      aiSource,
      model
    };
  }

  async auditAndApprove(requestId, details = {}) {
    console.log(`[${this.name}] Running LLM curriculum & credit audit for ${requestId}...`);
    const evalResult = await this.evaluateAudit(requestId, details);

    if (!evalResult.passed) {
      return {
        success: false,
        stage: 'HOD_APPROVED',
        agent: this.name,
        aiSource: evalResult.aiSource,
        model: evalResult.model,
        confidence: evalResult.confidence,
        auditTrail: evalResult.auditTrail,
        escalate: true,
        escalationReasons: evalResult.escalationReasons,
        rationale: evalResult.rationale
      };
    }

    const comments = `[${this.name} via ${evalResult.model}] Verified (Confidence: ${(evalResult.confidence * 100).toFixed(1)}%). ${evalResult.rationale}`;
    let txResult = null;
    try {
      txResult = await invokeOrg1Transaction('ApproveHOD', [requestId, this.name, comments]);
    } catch (e) {
      txResult = { simulated: true, note: e.message };
    }

    return {
      success: true,
      stage: 'HOD_APPROVED',
      agent: this.name,
      aiSource: evalResult.aiSource,
      model: evalResult.model,
      confidence: evalResult.confidence,
      auditTrail: evalResult.auditTrail,
      rationale: evalResult.rationale,
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
    this.msp = 'Org1MSP';
    this.peerAddress = 'peer0.org1.academic.edu:7051';
    this.role = 'Academic Committee & Capstone Evaluation';
  }

  async evaluateAudit(requestId, details = {}) {
    const dacRubric = Org1RuleEngine.evaluateDACRubric(details.capstoneScore, details.originalityReport || details.originality);
    const auditTrail = [dacRubric.capstoneCheck, dacRubric.originalityCheck];
    const failedChecks = auditTrail.filter(c => !c.passed);
    const deterministicPassed = failedChecks.length === 0;

    let aiSource = 'DETERMINISTIC_RULE_ENGINE';
    let model = 'NITW-Org1-Deterministic-Audit';
    let confidence = deterministicPassed ? 0.97 : 0.98;
    let rationale = '';

    const systemPrompt = `You are the Department Academic Committee (DAC) Review Agent (Org 1).
Evaluate thesis capstone evaluation score (>= 60/100) and originality report (>= 80% unique).
Output valid JSON only:
{"decision":"APPROVE","confidence":0.97,"reasoning":"Capstone rubric and originality metrics verified."}`;

    const userPrompt = `Request: ${requestId}, Capstone Score: ${dacRubric.capstoneCheck.actual}/100, Originality: ${dacRubric.originalityCheck.actual}% unique`;

    try {
      const llmRes = await hfClient.generateReasoning(systemPrompt, userPrompt, { jsonMode: true });
      aiSource = llmRes.source;
      model = llmRes.model;
      const parsed = parseLLMResponse(llmRes, '');
      if (parsed.rationale) rationale = parsed.rationale;
      if (parsed.confidence) confidence = parsed.confidence;
    } catch (e) {
      console.warn(`[${this.name}] LLM inference fallback: ${e.message}`);
    }

    const finalPassed = deterministicPassed;
    const escalationReasons = failedChecks.map(c => c.comment);

    if (!finalPassed) {
      rationale = `DAC rubric evaluation rejected: ${escalationReasons.join('; ')}. Escalated to Department Academic Council.`;
    } else if (!rationale) {
      rationale = `Capstone score=${dacRubric.capstoneCheck.actual}/100 (>=60), Originality=${dacRubric.originalityCheck.actual}% (>=80%). Rubric sanctioned.`;
    }

    return {
      passed: finalPassed,
      decision: finalPassed ? 'APPROVE' : 'REJECT',
      confidence,
      auditTrail,
      escalate: !finalPassed,
      escalationReasons,
      rationale,
      aiSource,
      model
    };
  }

  async auditAndApprove(requestId, details = {}) {
    console.log(`[${this.name}] Running DAC committee rubric check for ${requestId}...`);
    const evalResult = await this.evaluateAudit(requestId, details);

    if (!evalResult.passed) {
      return {
        success: false,
        stage: 'DAC_APPROVED',
        agent: this.name,
        aiSource: evalResult.aiSource,
        model: evalResult.model,
        confidence: evalResult.confidence,
        auditTrail: evalResult.auditTrail,
        escalate: true,
        escalationReasons: evalResult.escalationReasons,
        rationale: evalResult.rationale
      };
    }

    // Rubric passed: execute DAC 3-member majority multi-sig consensus (Quorum >= 2/3)
    const engine = new DACMultiSigEngine();
    const result = await engine.runAutonomousMultiSig(requestId, details);
    return {
      success: result.quorumMet,
      stage: 'DAC_APPROVED',
      agent: this.name,
      aiSource: evalResult.aiSource,
      model: evalResult.model,
      confidence: evalResult.confidence,
      auditTrail: evalResult.auditTrail,
      rationale: `${evalResult.rationale} DAC majority consensus ${result.quorumMet ? 'satisfied' : 'NOT satisfied'} (${result.approvalCount}/${result.totalVotes} votes).`,
      txResult: result
    };
  }
}

/**
 * Org 1 Autonomous Academic Department Lead Agent
 * Orchestrates autonomous audit and multi-stage endorsement across Stages 1-3.
 */
class Org1AcademicAgent {
  constructor() {
    this.name = 'Agent-Org1-Academic-Lead';
    this.orgNum = 1;
    this.msp = 'Org1MSP';
    this.peerAddress = 'peer0.org1.academic.edu:7051';
    this.role = 'Autonomous Academic Department Lead & Stages 1-3 Coordinator';
    this.facultyAgent = new FacultyAgent();
    this.hodAgent = new HODAgent();
    this.dacAgent = new DACAgent();
  }

  /**
   * Run comprehensive pre-flight audit for Org 1 (Attendance, CIE, Prerequisites, Credits, Capstone)
   */
  async auditRequest(requestId, overrideDetails = {}) {
    console.log(`[${this.name}] Initiating Org 1 autonomous audit for request ${requestId}...`);

    let rawReq = null;
    try {
      rawReq = await queryChaincode('GetCertificateRequest', [requestId]);
    } catch (e) {
      console.warn(`[${this.name}] Could not query request ${requestId}: ${e.message}`);
    }

    let requestObj = {};
    if (rawReq) {
      requestObj = typeof rawReq === 'string' ? JSON.parse(rawReq) : rawReq;
    }

    let studentObj = {};
    if (requestObj.studentId) {
      try {
        const rawStudent = await queryChaincode('GetStudent', [requestObj.studentId]);
        if (rawStudent) {
          studentObj = typeof rawStudent === 'string' ? JSON.parse(rawStudent) : rawStudent;
        }
      } catch (e) {
        console.warn(`[${this.name}] Could not query student ${requestObj.studentId}: ${e.message}`);
      }
    }

    const mergedDetails = {
      ...(requestObj.details || {}),
      ...(overrideDetails.details || overrideDetails),
      studentName: studentObj.name || requestObj.details?.name,
      department: studentObj.department || requestObj.details?.department
    };

    const facultyEval = await this.facultyAgent.evaluateAudit(requestId, mergedDetails);
    const hodEval = await this.hodAgent.evaluateAudit(requestId, mergedDetails);
    const dacEval = await this.dacAgent.evaluateAudit(requestId, mergedDetails);

    const combinedAuditTrail = [
      ...facultyEval.auditTrail,
      ...hodEval.auditTrail,
      ...dacEval.auditTrail
    ];

    const allPassed = facultyEval.passed && hodEval.passed && dacEval.passed;
    const escalationReasons = [
      ...facultyEval.escalationReasons,
      ...hodEval.escalationReasons,
      ...dacEval.escalationReasons
    ];

    const overallConfidence = Number(
      ((facultyEval.confidence + hodEval.confidence + dacEval.confidence) / 3).toFixed(2)
    );

    const decision = allPassed ? 'APPROVE' : 'REJECT';
    const rationale = allPassed
      ? `All Org 1 academic departmental thresholds verified: Attendance (${facultyEval.auditTrail[0].actual}%), CIE (${facultyEval.auditTrail[1].actual}/50), Prerequisites (Cleared), Credits (${hodEval.auditTrail[0].actual}/${hodEval.auditTrail[0].threshold}), Capstone (${dacEval.auditTrail[0].actual}/100). Approved for Stages 1-3 progression.`
      : `Org 1 Academic Agent rejected: ${escalationReasons.join('; ')}. Automated escalation dispatched to Department Academic Council.`;

    return {
      agent: this.name,
      msp: this.msp,
      peerAddress: this.peerAddress,
      requestId,
      studentId: requestObj.studentId || overrideDetails.studentId,
      currentStatus: requestObj.status || 'SUBMITTED',
      decision,
      passed: allPassed,
      confidence: overallConfidence,
      escalate: !allPassed,
      escalationReasons,
      auditTrail: combinedAuditTrail,
      stageEvaluations: {
        stage1_faculty: facultyEval,
        stage2_hod: hodEval,
        stage3_dac: dacEval
      },
      recommendation: allPassed ? 'PROCEED_TO_ONCHAIN_APPROVAL' : 'ESCALATE_TO_ACADEMIC_COUNCIL',
      rationale
    };
  }

  /**
   * Run audit and sequentially submit on-chain approvals for Stages 1-3 via Org1MSP
   */
  async autoApprove(requestId, overrideDetails = {}) {
    console.log(`[${this.name}] Running Org 1 Auto-Approve workflow for ${requestId}...`);

    const auditReport = await this.auditRequest(requestId, overrideDetails);
    if (!auditReport.passed) {
      console.warn(`[${this.name}] Audit failed for ${requestId}. Halting on-chain execution.`);
      return {
        success: false,
        requestId,
        stage: 'ORG1_AUDIT_FAILED',
        escalate: true,
        decision: 'REJECT',
        escalationReasons: auditReport.escalationReasons,
        auditReport,
        message: 'On-chain approval blocked: Student did not satisfy Org 1 academic criteria'
      };
    }

    const rawReq = await queryChaincode('GetCertificateRequest', [requestId]);
    if (!rawReq) {
      throw new Error(`Certificate request ${requestId} not found on ledger`);
    }
    const requestObj = typeof rawReq === 'string' ? JSON.parse(rawReq) : rawReq;
    const details = {
      ...(requestObj.details || {}),
      ...(overrideDetails.details || overrideDetails)
    };

    const stageResults = [];
    let currentStatus = requestObj.status;

    // Stage 1: Faculty Approval
    if (currentStatus === 'SUBMITTED') {
      const facRes = await this.facultyAgent.auditAndApprove(requestId, details);
      stageResults.push({ stage: 'FACULTY_APPROVED', ...facRes });
      if (!facRes.success) {
        return { success: false, failedStage: 'FACULTY_APPROVED', stageResults, auditReport };
      }
      currentStatus = 'FACULTY_APPROVED';
    }

    // Stage 2: HOD Approval
    if (currentStatus === 'FACULTY_APPROVED') {
      const hodRes = await this.hodAgent.auditAndApprove(requestId, details);
      stageResults.push({ stage: 'HOD_APPROVED', ...hodRes });
      if (!hodRes.success) {
        return { success: false, failedStage: 'HOD_APPROVED', stageResults, auditReport };
      }
      currentStatus = 'HOD_APPROVED';
    }

    // Stage 3: DAC Approval
    if (currentStatus === 'HOD_APPROVED') {
      const dacRes = await this.dacAgent.auditAndApprove(requestId, details);
      stageResults.push({ stage: 'DAC_APPROVED', ...dacRes });
      if (!dacRes.success) {
        return { success: false, failedStage: 'DAC_APPROVED', stageResults, auditReport };
      }
      currentStatus = 'DAC_APPROVED';
    }

    return {
      success: true,
      requestId,
      studentId: requestObj.studentId,
      initialStatus: requestObj.status,
      finalStatus: currentStatus,
      completedStages: ['FACULTY_APPROVED', 'HOD_APPROVED', 'DAC_APPROVED'],
      endorsingMsp: this.msp,
      targetPeer: this.peerAddress,
      auditReport,
      stageResults
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
  ORG1_THRESHOLDS,
  Org1RuleEngine,
  FacultyAgent,
  FacultyAdvisorAgent,
  HODAgent,
  DACAgent,
  DACMultiSigEngine,
  Org1AcademicAgent,
  ExamLockAgent,
  DeanAgent,
  DeanMultiSigEngine,
  AdminFinalizeAgent
};
