'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

function computeStudentDID(name, rollNumber) {
  const rawInput = `${(name || '').trim().toLowerCase()}:${(rollNumber || '').trim().toUpperCase()}`;
  const sha256Hash = crypto.createHash('sha256').update(rawInput, 'utf8').digest();
  const ripemd160Hex = crypto.createHash('ripemd160').update(sha256Hash).digest('hex');
  return `did:academic:${ripemd160Hex}`;
}

class AcademicContract extends Contract {

  _getTxTimestamp(ctx) {
    try {
      const txTimestamp = ctx.stub.getTxTimestamp();
      if (txTimestamp && txTimestamp.seconds !== undefined) {
        const seconds = txTimestamp.seconds.low !== undefined ? txTimestamp.seconds.low : Number(txTimestamp.seconds);
        const nanos = txTimestamp.nanos || 0;
        const millis = (seconds * 1000) + Math.floor(nanos / 1000000);
        return new Date(millis).toISOString();
      }
    } catch (e) {
      // fallback
    }
    return new Date().toISOString();
  }

  async initLedger(ctx) {
    console.info('============= START : Initialize Academic Ledger ===========');
    const timestamp = this._getTxTimestamp(ctx);
    const initMarker = {
      docType: 'networkInit',
      initializedAt: timestamp,
      consortium: 'AcademicConsortium',
      version: '2.0.0'
    };
    await ctx.stub.putState('NETWORK_INIT', Buffer.from(JSON.stringify(initMarker)));
    console.info('============= END : Initialize Academic Ledger ===========');
  }

  // ==========================================
  // MODULE 1: Student Registration & Profile (with DID)
  // ==========================================

  async RegisterStudent(ctx, studentId, name, email, department, enrollmentYear, didInput) {
    console.info(`RegisterStudent: ${studentId}`);
    if (!studentId || !name || !email) {
      throw new Error('studentId, name, and email are required');
    }

    const exists = await this.studentExists(ctx, studentId);
    if (exists) {
      throw new Error(`Student with ID ${studentId} already exists`);
    }

    const timestamp = this._getTxTimestamp(ctx);
    const did = didInput || computeStudentDID(name, studentId);

    const student = {
      docType: 'student',
      studentId,
      did,
      name,
      email,
      department: department || 'General',
      enrollmentYear: enrollmentYear || timestamp.substring(0, 4),
      registeredAt: timestamp
    };

    // Store student by student ID
    await ctx.stub.putState(`STUDENT_${studentId}`, Buffer.from(JSON.stringify(student)));
    
    // Store reverse-lookup by DID
    await ctx.stub.putState(`DID_${did}`, Buffer.from(studentId));

    return JSON.stringify(student);
  }

  async GetStudent(ctx, studentId) {
    const studentAsBytes = await ctx.stub.getState(`STUDENT_${studentId}`);
    if (!studentAsBytes || studentAsBytes.length === 0) {
      throw new Error(`Student ${studentId} does not exist`);
    }
    return studentAsBytes.toString();
  }

  async GetStudentByDID(ctx, did) {
    const studentIdBytes = await ctx.stub.getState(`DID_${did}`);
    if (!studentIdBytes || studentIdBytes.length === 0) {
      throw new Error(`No student found with DID ${did}`);
    }
    const studentId = studentIdBytes.toString();
    return await this.GetStudent(ctx, studentId);
  }

  async studentExists(ctx, studentId) {
    const studentAsBytes = await ctx.stub.getState(`STUDENT_${studentId}`);
    return studentAsBytes && studentAsBytes.length > 0;
  }

  // =======================================================
  // MODULE 2: Certificate Request & Governance State Machine
  // SUBMITTED -> FACULTY_APPROVED -> FA_APPROVED ->
  // DAC_APPROVED (Multi-Sig) -> EXAM_LOCKED -> DEAN_APPROVED (Multi-Sig) -> ADMIN_FINALIZED
  // =======================================================

  async RequestCertificate(ctx, requestId, studentId, certType, detailsJson) {
    console.info(`RequestCertificate: ${requestId} for student: ${studentId}`);
    const studentExists = await this.studentExists(ctx, studentId);
    if (!studentExists) {
      throw new Error(`Student ${studentId} is not registered`);
    }

    const reqKey = `REQ_${requestId}`;
    const existingReq = await ctx.stub.getState(reqKey);
    if (existingReq && existingReq.length > 0) {
      throw new Error(`Request with ID ${requestId} already exists`);
    }

    const studentStr = await this.GetStudent(ctx, studentId);
    let studentData = {};
    try {
      studentData = JSON.parse(studentStr);
    } catch (e) {
      // fallback
    }

    let parsedDetails = {};
    if (detailsJson) {
      try {
        parsedDetails = JSON.parse(detailsJson);
      } catch (e) {
        parsedDetails = { raw: detailsJson };
      }
    }

    const timestamp = this._getTxTimestamp(ctx);
    const certificateRequest = {
      docType: 'certificateRequest',
      requestId,
      studentId,
      studentDid: studentData.did || computeStudentDID(studentData.name || 'Student', studentId),
      certType: certType || 'Degree Certificate',
      details: parsedDetails,
      status: 'SUBMITTED',
      dacSignatures: {},
      deanBoardSignatures: {},
      createdAt: timestamp,
      updatedAt: timestamp,
      history: [
        {
          stage: 'SUBMITTED',
          updatedBy: studentId,
          timestamp,
          comments: 'Certificate request submitted by student'
        }
      ]
    };

    await ctx.stub.putState(reqKey, Buffer.from(JSON.stringify(certificateRequest)));
    return JSON.stringify(certificateRequest);
  }

  // Step 1: Faculty Approval
  async ApproveFaculty(ctx, requestId, facultyId, comments) {
    return await this._transitionState(ctx, requestId, ['SUBMITTED'], 'FACULTY_APPROVED', facultyId, comments || 'Faculty approval granted');
  }

  // Step 2: Faculty Advisor Approval (Cross-Course Audit Gate)
  async ApproveFacultyAdvisor(ctx, requestId, advisorId, comments, faSignature) {
    const request = await this._getRequestObject(ctx, requestId);
    if (request.status !== 'FACULTY_APPROVED' && request.status !== 'SUBMITTED') {
      throw new Error(`Invalid stage transition for Faculty Advisor. Expected FACULTY_APPROVED or SUBMITTED, current is ${request.status}`);
    }

    const timestamp = this._getTxTimestamp(ctx);
    request.status = 'FA_APPROVED';
    request.facultyAdvisorSignature = faSignature || `SIG_FA_${advisorId}_${Date.now()}`;
    request.updatedAt = timestamp;
    request.history.push({
      stage: 'FA_APPROVED',
      updatedBy: advisorId || 'FacultyAdvisor',
      signature: request.facultyAdvisorSignature,
      timestamp,
      comments: comments || 'Faculty Advisor verified all course requirements and endorsed candidate'
    });

    await ctx.stub.putState(`REQ_${requestId}`, Buffer.from(JSON.stringify(request)));
    return JSON.stringify(request);
  }

  // Backward compatibility alias: ApproveHOD
  async ApproveHOD(ctx, requestId, hodId, comments) {
    return await this._transitionState(ctx, requestId, ['FACULTY_APPROVED', 'FA_APPROVED'], 'HOD_APPROVED', hodId, comments || 'HOD recommendation approved');
  }

  // Backward compatibility alias: ApproveDAC
  async ApproveDAC(ctx, requestId, dacMemberId, comments) {
    return await this._transitionState(ctx, requestId, ['HOD_APPROVED', 'FA_APPROVED', 'FACULTY_APPROVED'], 'DAC_APPROVED', dacMemberId, comments || 'DAC approval complete');
  }

  // Step 3: HOD + DAC Majority Multi-Sig Approval (Requires >= 2 of 3 member signatures)
  async ApproveDACMultiSig(ctx, requestId, memberId, memberSignature, comments) {
    const request = await this._getRequestObject(ctx, requestId);
    const validPreStates = ['FA_APPROVED', 'FACULTY_APPROVED', 'HOD_APPROVED', 'SUBMITTED'];
    if (!validPreStates.includes(request.status) && request.status !== 'DAC_APPROVED') {
      throw new Error(`Cannot vote in DAC Multi-Sig. Request is in status ${request.status}`);
    }

    request.dacSignatures = request.dacSignatures || {};
    const timestamp = this._getTxTimestamp(ctx);
    request.dacSignatures[memberId] = {
      memberId,
      signature: memberSignature || `SIG_DAC_${memberId}_${Date.now()}`,
      timestamp,
      comments: comments || 'DAC member vote recorded'
    };

    const signatureCount = Object.keys(request.dacSignatures).length;
    const requiredMajority = 2; // Majority threshold: 2 of 3

    if (signatureCount >= requiredMajority && request.status !== 'DAC_APPROVED') {
      request.status = 'DAC_APPROVED';
      request.history.push({
        stage: 'DAC_APPROVED',
        updatedBy: `DAC_MULTISIG_QUORUM (${signatureCount}/3)`,
        timestamp,
        comments: `DAC majority consensus satisfied (${signatureCount}/3 signatures collected)`
      });
    }

    request.updatedAt = timestamp;
    await ctx.stub.putState(`REQ_${requestId}`, Buffer.from(JSON.stringify(request)));
    return JSON.stringify(request);
  }

  // Step 4: Org 2 Examination Grade Lockdown
  async LockExamGrades(ctx, requestId, examOfficerId, gradesHash, comments) {
    const request = await this._getRequestObject(ctx, requestId);
    if (request.status !== 'DAC_APPROVED' && request.status !== 'HOD_APPROVED') {
      throw new Error(`Invalid stage transition. Expected DAC_APPROVED, but current status is ${request.status}`);
    }

    const timestamp = this._getTxTimestamp(ctx);
    request.status = 'EXAM_LOCKED';
    request.gradesHash = gradesHash || 'GRADES_VERIFIED';
    request.updatedAt = timestamp;
    request.history.push({
      stage: 'EXAM_LOCKED',
      updatedBy: examOfficerId || 'ExamController',
      timestamp,
      gradesHash: request.gradesHash,
      comments: comments || 'Examination records verified and locked'
    });

    await ctx.stub.putState(`REQ_${requestId}`, Buffer.from(JSON.stringify(request)));
    return JSON.stringify(request);
  }

  // Step 5: Dean Academics & Senate Board Majority Multi-Sig Approval (>= 2 of 3)
  async ApproveDeanMultiSig(ctx, requestId, boardMemberId, boardMemberSignature, comments) {
    const request = await this._getRequestObject(ctx, requestId);
    if (request.status !== 'EXAM_LOCKED' && request.status !== 'DEAN_APPROVED') {
      throw new Error(`Cannot vote in Dean Board Multi-Sig. Request is in status ${request.status}, expected EXAM_LOCKED`);
    }

    request.deanBoardSignatures = request.deanBoardSignatures || {};
    const timestamp = this._getTxTimestamp(ctx);
    request.deanBoardSignatures[boardMemberId] = {
      boardMemberId,
      signature: boardMemberSignature || `SIG_DEAN_${boardMemberId}_${Date.now()}`,
      timestamp,
      comments: comments || 'Dean Senate Board vote recorded'
    };

    const signatureCount = Object.keys(request.deanBoardSignatures).length;
    const requiredMajority = 2; // Majority threshold: 2 of 3

    if (signatureCount >= requiredMajority && request.status !== 'DEAN_APPROVED') {
      request.status = 'DEAN_APPROVED';
      request.history.push({
        stage: 'DEAN_APPROVED',
        updatedBy: `DEAN_BOARD_QUORUM (${signatureCount}/3)`,
        timestamp,
        comments: `Dean Academic Board majority consensus satisfied (${signatureCount}/3 signatures collected)`
      });
    }

    request.updatedAt = timestamp;
    await ctx.stub.putState(`REQ_${requestId}`, Buffer.from(JSON.stringify(request)));
    return JSON.stringify(request);
  }

  // Backward compatibility alias: ApproveDean
  async ApproveDean(ctx, requestId, deanId, comments) {
    return await this._transitionState(ctx, requestId, ['EXAM_LOCKED'], 'DEAN_APPROVED', deanId, comments || 'Dean Academic sanction granted');
  }

  // Step 6: Admin Finalization
  async FinalizeAdmin(ctx, requestId, adminId, comments) {
    return await this._transitionState(ctx, requestId, ['DEAN_APPROVED'], 'ADMIN_FINALIZED', adminId, comments || 'Administration final clearance verified for issuance');
  }

  async _transitionState(ctx, requestId, expectedStates, targetState, actorId, comments) {
    const request = await this._getRequestObject(ctx, requestId);
    const expected = Array.isArray(expectedStates) ? expectedStates : [expectedStates];
    if (!expected.includes(request.status)) {
      throw new Error(`Invalid stage transition. Request ${requestId} is in status '${request.status}', expected one of [${expected.join(', ')}]`);
    }

    const timestamp = this._getTxTimestamp(ctx);
    request.status = targetState;
    request.updatedAt = timestamp;
    request.history.push({
      stage: targetState,
      updatedBy: actorId || 'SystemAdmin',
      timestamp,
      comments: comments || `Transitioned to ${targetState}`
    });

    await ctx.stub.putState(`REQ_${requestId}`, Buffer.from(JSON.stringify(request)));
    return JSON.stringify(request);
  }

  async _getRequestObject(ctx, requestId) {
    const reqBytes = await ctx.stub.getState(`REQ_${requestId}`);
    if (!reqBytes || reqBytes.length === 0) {
      throw new Error(`Certificate request ${requestId} does not exist`);
    }
    return JSON.parse(reqBytes.toString());
  }

  async GetCertificateRequest(ctx, requestId) {
    const request = await this._getRequestObject(ctx, requestId);
    return JSON.stringify(request);
  }

  // =======================================================
  // MODULE 3 & 4: Certificate Issuance, IPFS Anchor & Verification
  // =======================================================

  async IssueCertificate(ctx, certId, requestId, studentId, certType, ipfsHash, docHash, issueDate) {
    console.info(`IssueCertificate: ${certId}`);
    if (!certId || !studentId || !ipfsHash || !docHash) {
      throw new Error('certId, studentId, ipfsHash, and docHash are required');
    }

    const certKey = `CERT_${certId}`;
    const existingCert = await ctx.stub.getState(certKey);
    if (existingCert && existingCert.length > 0) {
      throw new Error(`Certificate ${certId} already exists`);
    }

    let requestObj = null;
    if (requestId) {
      requestObj = await this._getRequestObject(ctx, requestId);
      if (requestObj.status !== 'ADMIN_FINALIZED') {
        throw new Error(`Cannot issue certificate. Request ${requestId} is not in ADMIN_FINALIZED status (current: ${requestObj.status})`);
      }
    }

    const studentBytes = await ctx.stub.getState(`STUDENT_${studentId}`);
    let studentData = {};
    if (studentBytes && studentBytes.length > 0) {
      studentData = JSON.parse(studentBytes.toString());
    }

    const timestamp = this._getTxTimestamp(ctx);
    let issuerMsp = 'Org3MSP';
    try {
      issuerMsp = ctx.clientIdentity.getMSPID();
    } catch (e) {
      // fallback
    }

    const did = studentData.did || computeStudentDID(studentData.name || 'Student', studentId);

    const certificate = {
      docType: 'certificate',
      certId,
      requestId: requestId || '',
      studentId,
      studentDid: did,
      studentName: studentData.name || '',
      department: studentData.department || '',
      certType: certType || 'Degree Certificate',
      ipfsHash,          // CID from IPFS
      docHash,           // SHA-256 hash of certificate file
      issueDate: issueDate || timestamp.substring(0, 10),
      status: 'ISSUED',  // State: ISSUED or REVOKED
      issuerMSP: issuerMsp,
      createdAt: timestamp,
      revocation: null
    };

    // Store certificate
    await ctx.stub.putState(certKey, Buffer.from(JSON.stringify(certificate)));

    // Store hash mapping for O(1) reverse lookup by file hash
    await ctx.stub.putState(`HASH_${docHash}`, Buffer.from(certId));

    // Store DID mapping for reverse lookup by student DID
    await ctx.stub.putState(`CERT_DID_${did}`, Buffer.from(certId));

    // Update request state if linked
    if (requestObj) {
      requestObj.status = 'CERTIFICATE_ISSUED';
      requestObj.certificateId = certId;
      requestObj.updatedAt = timestamp;
      requestObj.history.push({
        stage: 'CERTIFICATE_ISSUED',
        updatedBy: issuerMsp,
        timestamp,
        comments: `Certificate issued with ID ${certId}, DID ${did}, and IPFS CID ${ipfsHash}`
      });
      await ctx.stub.putState(`REQ_${requestId}`, Buffer.from(JSON.stringify(requestObj)));
    }

    return JSON.stringify(certificate);
  }

  async VerifyCertificate(ctx, certId) {
    console.info(`VerifyCertificate: ${certId}`);
    const certBytes = await ctx.stub.getState(`CERT_${certId}`);
    if (!certBytes || certBytes.length === 0) {
      return JSON.stringify({
        certId,
        verificationStatus: 'INVALID',
        message: 'Certificate not found on blockchain ledger',
        verified: false
      });
    }

    const cert = JSON.parse(certBytes.toString());
    if (cert.status === 'REVOKED') {
      return JSON.stringify({
        certId,
        verificationStatus: 'REVOKED',
        message: 'Certificate was issued but subsequently revoked',
        verified: false,
        certificate: cert
      });
    }

    return JSON.stringify({
      certId,
      verificationStatus: 'VERIFIED',
      message: 'Certificate is valid and authentic on Hyperledger Fabric ledger',
      verified: true,
      certificate: cert
    });
  }

  async VerifyCertificateByHash(ctx, docHash) {
    console.info(`VerifyCertificateByHash: ${docHash}`);
    const certIdBytes = await ctx.stub.getState(`HASH_${docHash}`);
    if (!certIdBytes || certIdBytes.length === 0) {
      return JSON.stringify({
        docHash,
        verificationStatus: 'INVALID',
        message: 'No certificate matching this SHA-256 hash found on ledger',
        verified: false
      });
    }

    const certId = certIdBytes.toString();
    return await this.VerifyCertificate(ctx, certId);
  }

  async VerifyCertificateByDID(ctx, did) {
    console.info(`VerifyCertificateByDID: ${did}`);
    const certIdBytes = await ctx.stub.getState(`CERT_DID_${did}`);
    if (!certIdBytes || certIdBytes.length === 0) {
      return JSON.stringify({
        did,
        verificationStatus: 'INVALID',
        message: `No certificate found associated with Student DID ${did}`,
        verified: false
      });
    }

    const certId = certIdBytes.toString();
    return await this.VerifyCertificate(ctx, certId);
  }

  async RevokeCertificate(ctx, certId, reason, revokedBy) {
    console.info(`RevokeCertificate: ${certId}`);
    const certBytes = await ctx.stub.getState(`CERT_${certId}`);
    if (!certBytes || certBytes.length === 0) {
      throw new Error(`Certificate ${certId} does not exist`);
    }

    const cert = JSON.parse(certBytes.toString());
    if (cert.status === 'REVOKED') {
      throw new Error(`Certificate ${certId} has already been revoked`);
    }

    const timestamp = this._getTxTimestamp(ctx);
    cert.status = 'REVOKED';
    cert.revocation = {
      reason: reason || 'Academic misconduct or administrative revocation',
      revokedBy: revokedBy || 'DeanAdmin',
      revokedAt: timestamp
    };

    await ctx.stub.putState(`CERT_${certId}`, Buffer.from(JSON.stringify(cert)));
    return JSON.stringify(cert);
  }

  // =======================================================
  // Query Helpers for Dashboards & Audits
  // ==========================================

  async GetAllRequests(ctx) {
    return await this._queryByPrefix(ctx, 'REQ_');
  }

  async GetAllCertificates(ctx) {
    return await this._queryByPrefix(ctx, 'CERT_');
  }

  async GetAllStudents(ctx) {
    return await this._queryByPrefix(ctx, 'STUDENT_');
  }

  async _queryByPrefix(ctx, prefix) {
    const iterator = await ctx.stub.getStateByRange(prefix, prefix + '\uffff');
    const results = [];
    let result = await iterator.next();
    while (!result.done) {
      if (result.value && result.value.value.toString()) {
        try {
          results.push(JSON.parse(result.value.value.toString('utf8')));
        } catch (e) {
          results.push(result.value.value.toString('utf8'));
        }
      }
      result = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(results);
  }
}

module.exports = AcademicContract;
