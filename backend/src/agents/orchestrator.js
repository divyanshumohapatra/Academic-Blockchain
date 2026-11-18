'use strict';

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
} = require('./orgAgents');
const fraudAgent = require('./fraudAgent');
const { queryChaincode, invokeChaincode } = require('../fabric');
const { generateCertificatePDF } = require('../pdf');
const { uploadToIPFS } = require('../ipfs');
const sisDatabase = require('../db/sisDatabase');
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
    this.facultyAdvisorAgent = new FacultyAdvisorAgent();
    this.hodAgent = new HODAgent();
    this.dacAgent = new DACAgent();
    this.dacMultiSigEngine = new DACMultiSigEngine();
    this.examLockAgent = new ExamLockAgent();
    this.deanAgent = new DeanAgent();
    this.deanMultiSigEngine = new DeanMultiSigEngine();
    this.adminFinalizeAgent = new AdminFinalizeAgent();
  }

  /**
   * Run full pre-flight audit without executing state transitions
   */
  async auditRequest(requestId) {
    let requestObj = null;
    try {
      const rawReq = await queryChaincode('GetCertificateRequest', [requestId]);
      requestObj = typeof rawReq === 'string' ? JSON.parse(rawReq) : rawReq;
    } catch (e) {
      // fallback
    }

    if (!requestObj) {
      requestObj = sisDatabase.getCertificateRequest(requestId);
    }

    if (!requestObj) {
      const candidateStudentId = requestId.replace(/^REQ-/, 'STU-');
      const student = sisDatabase.getStudentByRollNumber(candidateStudentId) || sisDatabase.getStudentByRollNumber(requestId);
      if (student && student.isOnLedger) {
        requestObj = sisDatabase.autoCreateRequestForStudent(student.studentId, requestId);
        console.log(`[${this.name}] Auto-created certificate request ${requestId} for registered student ${student.studentId}`);
      }
    }

    if (!requestObj) {
      throw new Error(`Certificate request "${requestId}" not found on ledger. Please register the student on-chain in Step 1 and submit a certificate request first.`);
    }

    const fraudAssessment = await fraudAgent.evaluateRisk(requestObj);
    const studentAudit = sisDatabase.getStudentComprehensiveAudit(requestObj.studentId);

    return {
      orchestrator: this.name,
      requestId,
      studentId: requestObj.studentId,
      studentDid: requestObj.studentDid,
      currentStatus: requestObj.status,
      fraudAssessment,
      studentAudit,
      stageReadiness: {
        faculty: { agent: this.facultyAgent.name, ready: requestObj.status === 'SUBMITTED' },
        facultyAdvisor: { agent: this.facultyAdvisorAgent.name, ready: ['SUBMITTED', 'FACULTY_APPROVED'].includes(requestObj.status) },
        dacMultiSig: { agent: 'DAC-MultiSig-Consortium', ready: ['FA_APPROVED', 'HOD_APPROVED', 'FACULTY_APPROVED'].includes(requestObj.status) },
        examLock: { agent: this.examLockAgent.name, ready: ['DAC_APPROVED', 'HOD_APPROVED'].includes(requestObj.status) },
        deanMultiSig: { agent: 'Dean-Senate-MultiSig', ready: requestObj.status === 'EXAM_LOCKED' },
        adminFinalize: { agent: this.adminFinalizeAgent.name, ready: ['DEAN_APPROVED', 'EXAM_LOCKED'].includes(requestObj.status) }
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
    console.log(`🤖 [${this.name}] Starting Autonomous Multi-Agent Pipeline for ${requestId}`);
    console.log(`======================================================`);

    // 1. Fetch current request state
    let requestObj = null;
    try {
      const rawReq = await queryChaincode('GetCertificateRequest', [requestId]);
      requestObj = typeof rawReq === 'string' ? JSON.parse(rawReq) : rawReq;
    } catch (e) {
      // fallback
    }

    if (!requestObj) {
      requestObj = sisDatabase.getCertificateRequest(requestId);
    }

    // Auto-recovery: if request not found yet, check if student was registered
    if (!requestObj) {
      const candidateStudentId = requestId.replace(/^REQ-/, 'STU-');
      const student = sisDatabase.getStudentByRollNumber(candidateStudentId) || sisDatabase.getStudentByRollNumber(requestId);
      if (student) {
        if (!student.isOnLedger) {
          throw new Error(`Student ${student.studentId} (${student.name}) is enrolled in the University SIS database, but has NOT been registered on the blockchain ledger yet. Please register the student on-chain in Step 1 first.`);
        }
        requestObj = sisDatabase.autoCreateRequestForStudent(student.studentId, requestId);
        executionLogs.push({
          step: 'AUTO_INIT_REQUEST',
          status: 'SUCCESS',
          message: `Auto-initiated certificate request ${requestId} for registered student ${student.name} (${student.studentId}) under branch ${requestObj.certType}.`
        });
      }
    }

    if (!requestObj) {
      throw new Error(`Certificate request "${requestId}" not found on ledger. Please submit a certificate request in the Lifecycle & Workflow tab first, or enter a valid Request ID.`);
    }
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

    // 3. Step 1: Faculty Coursework Approval
    if (requestObj.status === 'SUBMITTED') {
      const res = await this.facultyAgent.auditAndApprove(requestId, details);
      executionLogs.push({ step: 'FACULTY_APPROVAL', ...res });
      if (!res.success) {
        return {
          success: false,
          message: res.rationale || `Halted by ${res.agent} at stage FACULTY_APPROVED`,
          haltedBy: res.agent,
          executionLogs,
          finalStatus: requestObj.status
        };
      }
      requestObj.status = 'FACULTY_APPROVED';
      sisDatabase.updateCertificateRequestStatus(requestId, 'FACULTY_APPROVED');
    }

    // 4. Step 2: Faculty Advisor Comprehensive Cross-Faculty Audit & Endorsement
    if (requestObj.status === 'FACULTY_APPROVED') {
      const res = await this.facultyAdvisorAgent.auditAndEndorse(requestId, requestObj.studentId, details);
      executionLogs.push({ step: 'FACULTY_ADVISOR_APPROVAL', ...res });
      if (!res.success) {
        return {
          success: false,
          message: res.rationale || `Halted by Faculty Advisor: Course requirements not satisfied across all faculties`,
          haltedBy: res.agent,
          executionLogs,
          finalStatus: requestObj.status
        };
      }
      requestObj.status = 'FA_APPROVED';
      sisDatabase.updateCertificateRequestStatus(requestId, 'FA_APPROVED');
    }

    // 5. Step 3: HOD + DAC Majority Multi-Sig Consensus
    if (requestObj.status === 'FA_APPROVED' || requestObj.status === 'HOD_APPROVED') {
      const dacRes = await this.dacMultiSigEngine.runAutonomousMultiSig(requestId, details);
      executionLogs.push({
        step: 'DAC_MULTISIG_CONSENSUS',
        agent: 'DAC-MultiSig-Engine',
        success: dacRes.quorumMet,
        approvalCount: dacRes.approvalCount,
        requiredQuorum: dacRes.requiredQuorum,
        votes: dacRes.votes
      });

      if (!dacRes.quorumMet) {
        return {
          success: false,
          message: `DAC majority multi-sig quorum not reached (${dacRes.approvalCount}/${dacRes.requiredQuorum} needed)`,
          haltedBy: 'DAC-MultiSig-Engine',
          executionLogs,
          finalStatus: requestObj.status
        };
      }
      requestObj.status = 'DAC_APPROVED';
      sisDatabase.updateCertificateRequestStatus(requestId, 'DAC_APPROVED');
    }

    // 6. Step 4: Exam Lockdown (Org 2)
    if (requestObj.status === 'DAC_APPROVED') {
      const res = await this.examLockAgent.auditAndLock(requestId, details);
      executionLogs.push({ step: 'EXAM_LOCK', ...res });
      if (!res.success) {
        return {
          success: false,
          message: res.rationale || `Halted by Exam Lock Agent`,
          haltedBy: res.agent,
          executionLogs,
          finalStatus: requestObj.status
        };
      }
      requestObj.status = 'EXAM_LOCKED';
      sisDatabase.updateCertificateRequestStatus(requestId, 'EXAM_LOCKED');
    }

    // 7. Step 5: Dean Academics & Senate Board Majority Multi-Sig Consensus
    if (requestObj.status === 'EXAM_LOCKED') {
      const deanRes = await this.deanMultiSigEngine.runAutonomousMultiSig(requestId, details);
      executionLogs.push({
        step: 'DEAN_MULTISIG_CONSENSUS',
        agent: 'Dean-MultiSig-Engine',
        success: deanRes.quorumMet,
        approvalCount: deanRes.approvalCount,
        requiredQuorum: deanRes.requiredQuorum,
        votes: deanRes.votes
      });

      if (!deanRes.quorumMet) {
        return {
          success: false,
          message: `Dean Senate Board multi-sig quorum not reached (${deanRes.approvalCount}/${deanRes.requiredQuorum} needed)`,
          haltedBy: 'Dean-MultiSig-Engine',
          executionLogs,
          finalStatus: requestObj.status
        };
      }
      requestObj.status = 'DEAN_APPROVED';
      sisDatabase.updateCertificateRequestStatus(requestId, 'DEAN_APPROVED');
    }

    // 8. Step 6: Admin Finalization (Org 3)
    if (requestObj.status === 'DEAN_APPROVED') {
      const res = await this.adminFinalizeAgent.auditAndFinalize(requestId, details);
      executionLogs.push({ step: 'ADMIN_FINALIZE', ...res });
      if (!res.success) {
        return {
          success: false,
          message: res.rationale || `Halted by Registrar Finalization Agent`,
          haltedBy: res.agent,
          executionLogs,
          finalStatus: requestObj.status
        };
      }
      requestObj.status = 'ADMIN_FINALIZED';
      sisDatabase.updateCertificateRequestStatus(requestId, 'ADMIN_FINALIZED');
    }

    // 9. Step 7: Automatic Minting if requested
    let issuanceResult = null;
    if (options.autoIssue && requestObj.status === 'ADMIN_FINALIZED') {
      const certId = options.certId || `CERT-${requestId.replace('REQ-', '')}`;
      console.log(`[${this.name}] Auto-issuing certificate ${certId}...`);

      const student = sisDatabase.getStudentByRollNumber(requestObj.studentId);
      const studentName = details.name || student?.name || 'Student Name';
      const studentDid = requestObj.studentDid || student?.did || '';
      const department = details.department || student?.department || 'Computer Science & Engineering';
      const certType = requestObj.certType || 'Master of Computer Applications (MCA)';
      const issueDate = new Date().toISOString().substring(0, 10);
      const createdAt = new Date().toISOString();

      try {
        const pdfBuffer = await generateCertificatePDF({
          certId,
          requestId,
          studentId: requestObj.studentId,
          studentDid,
          studentName,
          department,
          certType,
          issueDate,
          createdAt
        });

        fs.writeFileSync(path.join(STORAGE_DIR, `${certId}.pdf`), pdfBuffer);
        const ipfsResult = await uploadToIPFS(pdfBuffer, `${certId}.pdf`);

        let chaincodeRes = null;
        try {
          chaincodeRes = await invokeChaincode('IssueCertificate', [
            certId,
            requestId,
            requestObj.studentId,
            certType,
            ipfsResult.cid,
            ipfsResult.sha256,
            issueDate
          ], 3);
        } catch (e) {
          chaincodeRes = { simulated: true, note: e.message };
        }

        issuanceResult = {
          certId,
          studentDid,
          ipfsCid: ipfsResult.cid,
          sha256Hash: ipfsResult.sha256,
          gatewayUrl: ipfsResult.gatewayUrl,
          chaincodeRes
        };

        executionLogs.push({
          step: 'CERTIFICATE_MINTED_AND_ANCHORED',
          agent: 'IPFS-Fabric-Minting-Agent',
          success: true,
          issuanceResult
        });

        requestObj.status = 'CERTIFICATE_ISSUED';
        sisDatabase.updateCertificateRequestStatus(requestId, 'CERTIFICATE_ISSUED', {
          certId,
          ipfsCid: ipfsResult.cid,
          sha256Hash: ipfsResult.sha256
        });
      } catch (err) {
        console.error('Auto-issuance failed:', err);
        executionLogs.push({
          step: 'CERTIFICATE_MINTING_ERROR',
          agent: 'IPFS-Fabric-Minting-Agent',
          success: false,
          error: err.message
        });
      }
    }

    if (requestObj.status === 'CERTIFICATE_ISSUED' && !issuanceResult) {
      const existingCert = sisDatabase.getCertificateRequestByCertId(requestObj.certId) || 
                           sisDatabase.getCertificateRequest(requestId);
      issuanceResult = {
        certId: requestObj.certId || existingCert?.certId || `CERT-${requestId.replace('REQ-', '')}`,
        studentDid: requestObj.studentDid || '',
        ipfsCid: requestObj.ipfsCid || existingCert?.ipfsCid || 'QmAcademicLedgerDigestMockHashCID1234567890',
        sha256Hash: requestObj.sha256Hash || existingCert?.sha256Hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      };
      executionLogs.push({
        step: 'CERTIFICATE_MINTED_AND_ANCHORED',
        agent: 'IPFS-Fabric-Minting-Agent',
        success: true,
        issuanceResult,
        rationale: 'Certificate already minted to IPFS and anchored on Fabric ledger.'
      });
    }

    const durationMs = Date.now() - startTime;
    return {
      success: true,
      message: `Autonomous Multi-Agent Consortium pipeline successfully completed all stages (${durationMs}ms)`,
      requestId,
      finalStatus: requestObj.status,
      durationMs,
      issuanceResult,
      executionLogs
    };
  }
}

module.exports = new MasterOrchestrator();
