'use strict';

const {
  FacultyAgent,
  HODAgent,
  DACAgent,
  ExamLockAgent,
  DeanAgent,
  AdminFinalizeAgent
} = require('./orgAgents');
const fraudAgent = require('./fraudAgent');
const { queryChaincode, invokeChaincode } = require('../fabric');
const { generateCertificatePDF } = require('../pdf');
const { uploadToIPFS } = require('../ipfs');
const fs = require('fs');
const path = require('path');

const STORAGE_DIR = path.join(__dirname, '../../storage/certificates');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

class MasterOrchestrator {
  constructor() {
    this.name = 'Master-Consortium-Orchestrator';
    this.facultyAgent = new FacultyAgent();
    this.hodAgent = new HODAgent();
    this.dacAgent = new DACAgent();
    this.examLockAgent = new ExamLockAgent();
    this.deanAgent = new DeanAgent();
    this.adminFinalizeAgent = new AdminFinalizeAgent();
  }

  /**
   * Run full pre-flight audit without executing state transitions
   */
  async auditRequest(requestId) {
    const rawReq = await queryChaincode('GetCertificateRequest', [requestId]);
    if (!rawReq) {
      throw new Error(`Certificate request ${requestId} not found on ledger`);
    }

    const requestObj = typeof rawReq === 'string' ? JSON.parse(rawReq) : rawReq;
    const fraudAssessment = await fraudAgent.evaluateRisk(requestObj);

    return {
      orchestrator: this.name,
      requestId,
      currentStatus: requestObj.status,
      fraudAssessment,
      stageReadiness: {
        faculty: { agent: this.facultyAgent.name, ready: requestObj.status === 'SUBMITTED' },
        hod: { agent: this.hodAgent.name, ready: requestObj.status === 'FACULTY_APPROVED' },
        dac: { agent: this.dacAgent.name, ready: requestObj.status === 'HOD_APPROVED' },
        examLock: { agent: this.examLockAgent.name, ready: requestObj.status === 'DAC_APPROVED' },
        dean: { agent: this.deanAgent.name, ready: requestObj.status === 'EXAM_LOCKED' },
        adminFinalize: { agent: this.adminFinalizeAgent.name, ready: requestObj.status === 'DEAN_APPROVED' }
      }
    };
  }

  /**
   * Run 1-Click Autonomous Multi-Agent Approval & Issuance Pipeline
   */
  async runAutonomousPipeline(requestId, options = {}) {
    const executionLogs = [];
    const startTime = Date.now();

    console.log(`\n======================================================`);
    console.log(`🤖 [${this.name}] Starting Autonomous Pipeline for ${requestId}`);
    console.log(`======================================================`);

    // 1. Fetch current request state
    const rawReq = await queryChaincode('GetCertificateRequest', [requestId]);
    if (!rawReq) {
      throw new Error(`Certificate request ${requestId} not found`);
    }
    let requestObj = typeof rawReq === 'string' ? JSON.parse(rawReq) : rawReq;
    const details = requestObj.details || {};

    // 2. Pre-flight Fraud & Invariant Scan
    const fraudCheck = await fraudAgent.evaluateRisk(requestObj);
    executionLogs.push({
      step: 'PRE_FLIGHT_FRAUD_SCAN',
      agent: fraudAgent.name,
      status: fraudCheck.riskLevel === 'CRITICAL' ? 'HALTED' : 'PASSED',
      riskScore: fraudCheck.riskScore,
      riskLevel: fraudCheck.riskLevel,
      details: fraudCheck
    });

    if (fraudCheck.riskLevel === 'CRITICAL') {
      return {
        success: false,
        message: `Pipeline quarantined: High fraud risk score (${fraudCheck.riskScore}/100)`,
        executionLogs,
        finalStatus: requestObj.status
      };
    }

    // 3. Sequential Stage Progression
    // Step 1: Faculty Approval
    if (requestObj.status === 'SUBMITTED') {
      const res = await this.facultyAgent.auditAndApprove(requestId, details);
      executionLogs.push({ step: 'FACULTY_APPROVAL', ...res });
      if (!res.success) return { success: false, executionLogs, finalStatus: requestObj.status };
      requestObj.status = 'FACULTY_APPROVED';
    }

    // Step 2: HOD Approval
    if (requestObj.status === 'FACULTY_APPROVED') {
      const res = await this.hodAgent.auditAndApprove(requestId, details);
      executionLogs.push({ step: 'HOD_APPROVAL', ...res });
      if (!res.success) return { success: false, executionLogs, finalStatus: requestObj.status };
      requestObj.status = 'HOD_APPROVED';
    }

    // Step 3: DAC Approval
    if (requestObj.status === 'HOD_APPROVED') {
      const res = await this.dacAgent.auditAndApprove(requestId, details);
      executionLogs.push({ step: 'DAC_APPROVAL', ...res });
      if (!res.success) return { success: false, executionLogs, finalStatus: requestObj.status };
      requestObj.status = 'DAC_APPROVED';
    }

    // Step 4: Exam Lockdown (Org 2)
    if (requestObj.status === 'DAC_APPROVED') {
      const res = await this.examLockAgent.auditAndLock(requestId, details);
      executionLogs.push({ step: 'EXAM_LOCK', ...res });
      if (!res.success) return { success: false, executionLogs, finalStatus: requestObj.status };
      requestObj.status = 'EXAM_LOCKED';
    }

    // Step 5: Dean Approval (Org 3)
    if (requestObj.status === 'EXAM_LOCKED') {
      const res = await this.deanAgent.auditAndApprove(requestId, details);
      executionLogs.push({ step: 'DEAN_APPROVAL', ...res });
      if (!res.success) return { success: false, executionLogs, finalStatus: requestObj.status };
      requestObj.status = 'DEAN_APPROVED';
    }

    // Step 6: Admin Finalization (Org 3)
    if (requestObj.status === 'DEAN_APPROVED') {
      const res = await this.adminFinalizeAgent.auditAndFinalize(requestId, details);
      executionLogs.push({ step: 'ADMIN_FINALIZATION', ...res });
      if (!res.success) return { success: false, executionLogs, finalStatus: requestObj.status };
      requestObj.status = 'ADMIN_FINALIZED';
    }

    // Step 7: Automated Minting & Anchoring (if requested or default true)
    let issuanceResult = null;
    if (options.autoIssue !== false && requestObj.status === 'ADMIN_FINALIZED') {
      const certId = options.certId || `CERT-${requestId.replace('REQ-', '')}`;
      console.log(`[${this.name}] Automatically minting certificate ${certId}...`);

      // Resolve student name and department
      let studentName = details.name || 'Student Name';
      let department = details.department || 'Computer Science & Engineering';

      try {
        const studentRaw = await queryChaincode('GetStudent', [requestObj.studentId]);
        if (studentRaw) {
          const studentObj = typeof studentRaw === 'string' ? JSON.parse(studentRaw) : studentRaw;
          if (studentObj.name) studentName = studentObj.name;
          if (studentObj.department) department = studentObj.department;
        }
      } catch (e) {
        console.warn(`[Student Lookup] ${e.message}`);
      }

      const issueDate = new Date().toISOString().substring(0, 10);
      const createdAt = new Date().toISOString();

      // Generate PDF
      const pdfBuffer = await generateCertificatePDF({
        certId,
        requestId,
        studentId: requestObj.studentId,
        studentName,
        department,
        certType: requestObj.certType || 'Master of Computer Applications (MCA)',
        issueDate,
        createdAt
      });

      fs.writeFileSync(path.join(STORAGE_DIR, `${certId}.pdf`), pdfBuffer);

      // Upload to IPFS
      const ipfsRes = await uploadToIPFS(pdfBuffer, `${certId}.pdf`);

      // Anchor on Fabric
      const chaincodeRes = await invokeChaincode('IssueCertificate', [
        certId,
        requestId,
        requestObj.studentId,
        requestObj.certType || 'Degree Certificate',
        ipfsRes.cid,
        ipfsRes.sha256,
        issueDate
      ], 3);

      issuanceResult = {
        certId,
        ipfsCid: ipfsRes.cid,
        sha256Hash: ipfsRes.sha256,
        gatewayUrl: ipfsRes.gatewayUrl,
        chaincodeRes
      };

      executionLogs.push({
        step: 'CERTIFICATE_MINTED_AND_ANCHORED',
        agent: 'Agent-Admin-Registrar',
        success: true,
        issuanceResult
      });
    }

    const durationMs = Date.now() - startTime;
    return {
      success: true,
      requestId,
      durationMs,
      finalStatus: issuanceResult ? 'ISSUED' : requestObj.status,
      issuanceResult,
      executionLogs
    };
  }
}

module.exports = new MasterOrchestrator();
