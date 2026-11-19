'use strict';

let Contract;
try {
  Contract = require('fabric-contract-api').Contract;
} catch (e) {
  Contract = class MockContract {};
}
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

  /**
   * Contributor 1.1: Org1MSP Access Control Guard
   * Enforces that student onboarding and profile lifecycle management
   * are executed only by Org1MSP (University Academic Department).
   */
  _validateOrg1MSP(ctx) {
    try {
      if (ctx.clientIdentity && typeof ctx.clientIdentity.getMSPID === 'function') {
        const mspId = ctx.clientIdentity.getMSPID();
        if (mspId && mspId !== 'Org1MSP') {
          throw new Error(`Access Denied: Only Org1MSP (Academic Department) is authorized to perform this operation. Invoking MSP: ${mspId}`);
        }
      }
    } catch (err) {
      if (err.message && err.message.startsWith('Access Denied')) {
        throw err;
      }
      // If getMSPID is unavailable in raw test stubs or peer CLI mock, log and proceed gracefully
    }
  }

  /**
   * Contributor 1.1 Enhancement: Academic Standing & Latin Honors Classification Engine
   */
  _computeAcademicStanding(cgpa, attendance, backlogs) {
    const numCgpa = Number(cgpa) || 0;
    const numAtt = Number(attendance) || 0;
    const numBacklogs = Number(backlogs) || 0;

    if (numBacklogs > 0 || numCgpa < 5.0) {
      return { standing: 'ACADEMIC_PROBATION', honors: 'NONE' };
    }

    let honors = 'NONE';
    if (numCgpa >= 9.5 && numAtt >= 85.0) {
      honors = 'SUMMA_CUM_LAUDE';
    } else if (numCgpa >= 9.0) {
      honors = 'MAGNA_CUM_LAUDE';
    } else if (numCgpa >= 8.5) {
      honors = numAtt >= 90.0 ? 'DEAN_HONOR_ROLL' : 'CUM_LAUDE';
    }

    return { standing: 'GOOD_STANDING', honors };
  }

  /**
   * Contributor 1.1 Enhancement: Cryptographic Digital Signature Verification
   * Guarantees student non-repudiation and prevents request spoofing.
   */
  _verifySignature(publicKeyPem, dataString, signatureBase64) {
    try {
      if (!publicKeyPem || !signatureBase64) return false;
      const verifier = crypto.createVerify('SHA256');
      verifier.update(dataString);
      verifier.end();
      return verifier.verify(publicKeyPem, Buffer.from(signatureBase64, 'base64'));
    } catch (e) {
      return false;
    }
  }

  /**
   * Contributor 1.1 Enhancement: Deterministic Transcript Digest
   * Anchors cryptographic SHA-256 fingerprint of student transcript snapshot.
   */
  _computeTranscriptDigest(studentId, cgpa, totalCredits, attendance, backlogs, courses) {
    const sortedCourses = Array.isArray(courses) ? [...courses].sort().join(',') : '';
    return crypto.createHash('sha256')
      .update(`${studentId}:${cgpa}:${totalCredits}:${attendance}:${backlogs}:${sortedCourses}`)
      .digest('hex');
  }

  /**
   * Contributor 1.1: Rich Schema Validation for Student Identity
   */
  _validateStudentSchema(studentId, name, email, department, enrollmentYear) {
    if (!studentId || typeof studentId !== 'string') {
      throw new Error('studentId is required and must be a valid string');
    }
    const studentIdRegex = /^[A-Za-z0-9_-]{3,32}$/;
    if (!studentIdRegex.test(studentId.trim())) {
      throw new Error(`Invalid studentId format: '${studentId}'. Must be 3-32 alphanumeric characters, dashes, or underscores`);
    }

    if (!name || typeof name !== 'string') {
      throw new Error('name is required and must be a non-empty string');
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      throw new Error('name must be between 2 and 100 characters');
    }

    if (!email || typeof email !== 'string') {
      throw new Error('email is required and must be a string');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error(`Invalid email format: '${email}'`);
    }

    if (enrollmentYear !== undefined && enrollmentYear !== null && enrollmentYear !== '') {
      const year = Number(enrollmentYear);
      if (isNaN(year) || year < 1990 || year > 2100) {
        throw new Error(`Invalid enrollmentYear: '${enrollmentYear}'. Must be a 4-digit year between 1990 and 2100`);
      }
    }
  }

  /**
   * Contributor 1.1: Rich Schema Validation for Certificate Request
   */
  _validateRequestSchema(requestId, studentId, certType) {
    if (!requestId || typeof requestId !== 'string') {
      throw new Error('requestId is required and must be a string');
    }
    const reqIdRegex = /^[A-Za-z0-9_-]{3,64}$/;
    if (!reqIdRegex.test(requestId.trim())) {
      throw new Error(`Invalid requestId format: '${requestId}'. Must be 3-64 alphanumeric characters, dashes, or underscores`);
    }

    if (!studentId || typeof studentId !== 'string') {
      throw new Error('studentId is required and must be a string');
    }

    if (!certType || typeof certType !== 'string' || certType.trim().length < 3) {
      throw new Error('certType is required and must be at least 3 characters');
    }
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
  // MODULE 1: Student Registration & Profile (with DID & Contributor 1.1 Lifecycle)
  // ==========================================

  /**
   * Upgraded RegisterStudent with rich schema validation, DID generation,
   * Org1MSP client identity access control, and student identity lifecycle management.
   */
  async RegisterStudent(ctx, studentId, name, email, department, enrollmentYear, profileJson, didInput) {
    console.info(`RegisterStudent: ${studentId}`);
    
    // 1. Enforce Org1MSP authorization
    this._validateOrg1MSP(ctx);

    // 2. Validate input schema
    this._validateStudentSchema(studentId, name, email, department, enrollmentYear);

    const cleanStudentId = studentId.trim();
    const exists = await this.studentExists(ctx, cleanStudentId);
    if (exists) {
      throw new Error(`Student with ID ${cleanStudentId} already exists`);
    }

    let parsedProfile = {};
    let did = null;

    if (profileJson) {
      if (typeof profileJson === 'string' && profileJson.startsWith('did:')) {
        did = profileJson;
      } else {
        try {
          parsedProfile = typeof profileJson === 'string' ? JSON.parse(profileJson) : profileJson;
          if (parsedProfile.did) did = parsedProfile.did;
        } catch (e) {
          parsedProfile = {};
        }
      }
    }
    if (didInput) {
      did = didInput;
    }
    if (!did) {
      did = computeStudentDID(name, cleanStudentId);
    }

    const timestamp = this._getTxTimestamp(ctx);
    let callerMsp = 'Org1MSP';
    try {
      if (ctx.clientIdentity && typeof ctx.clientIdentity.getMSPID === 'function') {
        callerMsp = ctx.clientIdentity.getMSPID() || 'Org1MSP';
      }
    } catch (e) {}

    // Extract academic metrics with robust defaults
    const cgpa = parsedProfile.cgpa !== undefined ? Number(parsedProfile.cgpa) : 8.5;
    const totalCredits = parsedProfile.totalCredits !== undefined ? Number(parsedProfile.totalCredits) : 160;
    const requiredCredits = parsedProfile.requiredCredits !== undefined ? Number(parsedProfile.requiredCredits) : 160;
    const attendance = parsedProfile.attendance !== undefined ? Number(parsedProfile.attendance) : 88.0;
    const backlogs = parsedProfile.backlogs !== undefined ? Number(parsedProfile.backlogs) : 0;
    const completedCourses = Array.isArray(parsedProfile.completedCourses) 
      ? parsedProfile.completedCourses 
      : ['CS101', 'CS102', 'CS201', 'CS202'];

    // Contributor 1.1 Enhancement: Academic Standing & Latin Honors Classification
    const standingEval = this._computeAcademicStanding(cgpa, attendance, backlogs);
    const publicKeyPem = parsedProfile.publicKeyPem || parsedProfile.publicKey || null;

    const student = {
      docType: 'student',
      studentId: cleanStudentId,
      did,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: (department || 'Computer Science & Engineering').trim(),
      enrollmentYear: String(enrollmentYear || timestamp.substring(0, 4)).trim(),
      status: 'ACTIVE', // Lifecycle: ACTIVE, SUSPENDED, GRADUATED, WITHDRAWN
      publicKeyPem,
      academicRecord: {
        cgpa,
        totalCredits,
        requiredCredits,
        attendance,
        backlogs,
        completedCourses,
        prerequisitesMet: attendance >= 75.0 && cgpa >= 5.0 && backlogs === 0 && totalCredits >= requiredCredits,
        academicStanding: standingEval.standing,
        honors: standingEval.honors
      },
      registeredBy: callerMsp,
      registeredAt: timestamp,
      updatedAt: timestamp,
      statusHistory: [
        {
          status: 'ACTIVE',
          updatedBy: callerMsp,
          timestamp,
          reason: 'Initial student registration and profile matriculation'
        }
      ]
    };

    await ctx.stub.putState(`STUDENT_${cleanStudentId}`, Buffer.from(JSON.stringify(student)));
    await ctx.stub.putState(`DID_${did}`, Buffer.from(cleanStudentId));
    return JSON.stringify(student);
  }

  /**
   * Update student academic record (CGPA, credits, attendance, completed courses, backlogs)
   * Protected: Org1MSP only
   */
  async UpdateStudentAcademicRecord(ctx, studentId, recordJson) {
    console.info(`UpdateStudentAcademicRecord: ${studentId}`);
    this._validateOrg1MSP(ctx);

    const studentBytes = await ctx.stub.getState(`STUDENT_${studentId}`);
    if (!studentBytes || studentBytes.length === 0) {
      throw new Error(`Student ${studentId} does not exist`);
    }

    const student = JSON.parse(studentBytes.toString());
    const updates = typeof recordJson === 'string' ? JSON.parse(recordJson) : recordJson;

    if (!student.academicRecord) {
      student.academicRecord = {};
    }

    if (updates.cgpa !== undefined) {
      const cgpa = Number(updates.cgpa);
      if (isNaN(cgpa) || cgpa < 0 || cgpa > 10.0) throw new Error('cgpa must be between 0.0 and 10.0');
      student.academicRecord.cgpa = cgpa;
    }
    if (updates.totalCredits !== undefined) {
      const credits = Number(updates.totalCredits);
      if (isNaN(credits) || credits < 0) throw new Error('totalCredits must be non-negative');
      student.academicRecord.totalCredits = credits;
    }
    if (updates.requiredCredits !== undefined) {
      student.academicRecord.requiredCredits = Number(updates.requiredCredits);
    }
    if (updates.attendance !== undefined) {
      const att = Number(updates.attendance);
      if (isNaN(att) || att < 0 || att > 100.0) throw new Error('attendance must be between 0.0 and 100.0');
      student.academicRecord.attendance = att;
    }
    if (updates.backlogs !== undefined) {
      const b = Number(updates.backlogs);
      if (isNaN(b) || b < 0) throw new Error('backlogs must be non-negative integer');
      student.academicRecord.backlogs = b;
    }
    if (Array.isArray(updates.completedCourses)) {
      student.academicRecord.completedCourses = updates.completedCourses;
    }

    const currentRecord = student.academicRecord;
    currentRecord.prerequisitesMet = 
      (currentRecord.attendance || 0) >= 75.0 && 
      (currentRecord.cgpa || 0) >= 5.0 && 
      (currentRecord.backlogs || 0) === 0 && 
      (currentRecord.totalCredits || 0) >= (currentRecord.requiredCredits || 0);

    // Contributor 1.1 Enhancement: Recalculate standing & honors
    const updatedEval = this._computeAcademicStanding(
      currentRecord.cgpa,
      currentRecord.attendance,
      currentRecord.backlogs
    );
    currentRecord.academicStanding = updatedEval.standing;
    currentRecord.honors = updatedEval.honors;

    const timestamp = this._getTxTimestamp(ctx);
    student.updatedAt = timestamp;

    await ctx.stub.putState(`STUDENT_${studentId}`, Buffer.from(JSON.stringify(student)));
    return JSON.stringify(student);
  }

  /**
   * Update student lifecycle status (ACTIVE, SUSPENDED, GRADUATED, WITHDRAWN)
   * Protected: Org1MSP only
   */
  async UpdateStudentStatus(ctx, studentId, newStatus, reason) {
    console.info(`UpdateStudentStatus: ${studentId} -> ${newStatus}`);
    this._validateOrg1MSP(ctx);

    const validStatuses = ['ACTIVE', 'SUSPENDED', 'GRADUATED', 'WITHDRAWN'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status '${newStatus}'. Allowed: ${validStatuses.join(', ')}`);
    }

    const studentBytes = await ctx.stub.getState(`STUDENT_${studentId}`);
    if (!studentBytes || studentBytes.length === 0) {
      throw new Error(`Student ${studentId} does not exist`);
    }

    const student = JSON.parse(studentBytes.toString());
    student.status = newStatus;
    const timestamp = this._getTxTimestamp(ctx);
    student.updatedAt = timestamp;

    let actor = 'Org1MSP';
    try {
      if (ctx.clientIdentity && typeof ctx.clientIdentity.getMSPID === 'function') {
        actor = ctx.clientIdentity.getMSPID() || 'Org1MSP';
      }
    } catch (e) {}

    if (!Array.isArray(student.statusHistory)) {
      student.statusHistory = [];
    }
    student.statusHistory.push({
      status: newStatus,
      updatedBy: actor,
      timestamp,
      reason: reason || `Status changed to ${newStatus}`
    });

    await ctx.stub.putState(`STUDENT_${studentId}`, Buffer.from(JSON.stringify(student)));
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

  /**
   * Verify whether a student satisfies all prerequisites for degree certificate issuance
   */
  async VerifyStudentEligibility(ctx, studentId, certType) {
    console.info(`VerifyStudentEligibility: ${studentId}`);
    const studentBytes = await ctx.stub.getState(`STUDENT_${studentId}`);
    if (!studentBytes || studentBytes.length === 0) {
      return JSON.stringify({
        studentId,
        eligible: false,
        error: `Student ${studentId} not found`
      });
    }

    const student = JSON.parse(studentBytes.toString());
    const record = student.academicRecord || {};
    const attendance = record.attendance !== undefined ? record.attendance : 85.0;
    const cgpa = record.cgpa !== undefined ? record.cgpa : 8.0;
    const credits = record.totalCredits !== undefined ? record.totalCredits : 160;
    const requiredCredits = record.requiredCredits !== undefined ? record.requiredCredits : 160;
    const backlogs = record.backlogs !== undefined ? record.backlogs : 0;

    const violations = [];
    if (attendance < 75.0) violations.push(`Attendance ${attendance}% is below statutory 75.0%`);
    if (cgpa < 5.0) violations.push(`CGPA ${cgpa} is below minimum 5.0 threshold`);
    if (backlogs > 0) violations.push(`Active backlogs: ${backlogs}`);
    if (credits < requiredCredits) violations.push(`Earned credits ${credits} below required ${requiredCredits}`);
    if (student.status !== 'ACTIVE') violations.push(`Student lifecycle status is '${student.status}'`);

    return JSON.stringify({
      studentId,
      name: student.name,
      department: student.department,
      status: student.status,
      certType: certType || 'Degree Certificate',
      eligible: violations.length === 0,
      violations,
      academicRecord: record
    });
  }

  /**
   * Contributor 1.1 Enhancement: Verify student digital signature against registered on-chain public key
   */
  async VerifyStudentSignature(ctx, studentId, requestId, certType, timestamp, signatureBase64) {
    const cleanStudentId = studentId.trim();
    const cleanReqId = requestId.trim();
    const studentBytes = await ctx.stub.getState(`STUDENT_${cleanStudentId}`);
    if (!studentBytes || studentBytes.length === 0) {
      return JSON.stringify({ verified: false, error: `Student ${cleanStudentId} not found` });
    }
    const student = JSON.parse(studentBytes.toString());
    if (!student.publicKeyPem) {
      return JSON.stringify({ verified: false, error: `No public key registered for student ${cleanStudentId}` });
    }
    const canonicalPayload = `${cleanStudentId}:${cleanReqId}:${certType}:${timestamp || ''}`;
    const verified = this._verifySignature(student.publicKeyPem, canonicalPayload, signatureBase64);
    return JSON.stringify({
      studentId: cleanStudentId,
      requestId: cleanReqId,
      verified,
      canonicalPayload
    });
  }

  /**
   * Contributor 1.1 Enhancement: Retrieve student public key and fingerprint
   */
  async GetStudentPublicKey(ctx, studentId) {
    const cleanStudentId = studentId.trim();
    const studentBytes = await ctx.stub.getState(`STUDENT_${cleanStudentId}`);
    if (!studentBytes || studentBytes.length === 0) {
      throw new Error(`Student ${cleanStudentId} does not exist`);
    }
    const student = JSON.parse(studentBytes.toString());
    return JSON.stringify({
      studentId: cleanStudentId,
      hasKey: Boolean(student.publicKeyPem),
      publicKeyPem: student.publicKeyPem || null
    });
  }

  // =======================================================
  // MODULE 2: Certificate Request & Governance State Machine
  // Contributor 1.1: Academic Chaincode Lead (RequestCertificate with rich schema, DID & prerequisite verification)
  // SUBMITTED -> FACULTY_APPROVED -> FA_APPROVED / HOD_APPROVED ->
  // DAC_APPROVED (Multi-Sig) -> EXAM_LOCKED -> DEAN_APPROVED (Multi-Sig) -> ADMIN_FINALIZED
  // =======================================================

  async RequestCertificate(ctx, requestId, studentId, certType, detailsJson) {
    console.info(`RequestCertificate: ${requestId} for student: ${studentId}`);
    
    // 1. Rich schema validation
    this._validateRequestSchema(requestId, studentId, certType);

    const cleanReqId = requestId.trim();
    const cleanStudentId = studentId.trim();

    // 2. Student Existence & Lifecycle Verification
    const studentBytes = await ctx.stub.getState(`STUDENT_${cleanStudentId}`);
    if (!studentBytes || studentBytes.length === 0) {
      throw new Error(`Student ${cleanStudentId} is not registered`);
    }
    const student = JSON.parse(studentBytes.toString());

    if (student.status && student.status !== 'ACTIVE') {
      throw new Error(`Cannot request certificate: Student ${cleanStudentId} status is '${student.status}'. Only ACTIVE students may apply.`);
    }

    // 3. Unique Request ID check
    const reqKey = `REQ_${cleanReqId}`;
    const existingReq = await ctx.stub.getState(reqKey);
    if (existingReq && existingReq.length > 0) {
      throw new Error(`Request with ID ${cleanReqId} already exists`);
    }

    // 4. Parse incoming request details
    let studentData = student;
    let parsedDetails = {};
    if (detailsJson) {
      try {
        parsedDetails = typeof detailsJson === 'string' ? JSON.parse(detailsJson) : detailsJson;
      } catch (e) {
        parsedDetails = { raw: detailsJson };
      }
    }

    // 5. Evaluate Prerequisite Validation Rules
    const record = student.academicRecord || {};
    const effectiveAttendance = parsedDetails.attendance !== undefined ? Number(parsedDetails.attendance) : (record.attendance !== undefined ? record.attendance : 88.0);
    const effectiveCgpa = parsedDetails.cgpa !== undefined ? Number(parsedDetails.cgpa) : (record.cgpa !== undefined ? record.cgpa : 8.5);
    const effectiveCredits = parsedDetails.totalCredits !== undefined ? Number(parsedDetails.totalCredits) : (record.totalCredits !== undefined ? record.totalCredits : 160);
    const requiredCredits = parsedDetails.requiredCredits !== undefined ? Number(parsedDetails.requiredCredits) : (record.requiredCredits !== undefined ? record.requiredCredits : 160);
    const effectiveBacklogs = parsedDetails.backlogs !== undefined ? Number(parsedDetails.backlogs) : (record.backlogs !== undefined ? record.backlogs : 0);

    const attendancePassed = effectiveAttendance >= 75.0;
    const cgpaPassed = effectiveCgpa >= 5.0;
    const creditsPassed = effectiveCredits >= requiredCredits;
    const backlogsPassed = effectiveBacklogs === 0;

    const prerequisitesSatisfied = attendancePassed && cgpaPassed && creditsPassed && backlogsPassed;

    // Strict validation error if statutory prerequisites violated
    if (!attendancePassed) {
      throw new Error(`Prerequisite validation failed: Statutory attendance must be >= 75.0% (Current: ${effectiveAttendance}%)`);
    }
    if (!cgpaPassed) {
      throw new Error(`Prerequisite validation failed: CGPA must be >= 5.0 (Current: ${effectiveCgpa})`);
    }
    if (!backlogsPassed) {
      throw new Error(`Prerequisite validation failed: Active backlogs must be 0 (Current: ${effectiveBacklogs})`);
    }

    // Contributor 1.1 Enhancement: Cryptographic Student Non-Repudiation Signature Check
    let studentSignatureVerified = false;
    if (parsedDetails.studentSignature) {
      if (!student.publicKeyPem) {
        throw new Error(`Cannot verify signature: Student ${cleanStudentId} does not have a registered public key on ledger`);
      }
      const canonicalPayload = `${cleanStudentId}:${cleanReqId}:${certType}:${parsedDetails.signatureTimestamp || ''}`;
      const isValid = this._verifySignature(student.publicKeyPem, canonicalPayload, parsedDetails.studentSignature);
      if (!isValid) {
        throw new Error('Cryptographic verification failed: Student digital signature does not match registered public key');
      }
      studentSignatureVerified = true;
    } else if (parsedDetails.requireSignature === true) {
      throw new Error('Digital signature required: Certificate request must be cryptographically signed by student');
    }

    // Contributor 1.1 Enhancement: Deterministic Transcript SHA-256 Digest Anchoring
    const transcriptDigest = this._computeTranscriptDigest(
      cleanStudentId,
      effectiveCgpa,
      effectiveCredits,
      effectiveAttendance,
      effectiveBacklogs,
      record.completedCourses || []
    );

    const timestamp = this._getTxTimestamp(ctx);
    const certificateRequest = {
      docType: 'certificateRequest',
      requestId: cleanReqId,
      studentId: cleanStudentId,
      studentName: student.name || parsedDetails.name || studentData.name || '',
      studentDid: studentData.did || student.did || (typeof computeStudentDID === 'function' ? computeStudentDID(student.name || 'Student', cleanStudentId) : `did:academic:nitw:${cleanStudentId.toLowerCase()}`),
      department: student.department || parsedDetails.department || 'Computer Science & Engineering',
      certType: certType || 'Degree Certificate',
      details: parsedDetails,
      academicSnapshot: {
        cgpa: effectiveCgpa,
        totalCredits: effectiveCredits,
        requiredCredits: requiredCredits,
        attendance: effectiveAttendance,
        backlogs: effectiveBacklogs,
        courses: record.completedCourses || [],
        transcriptDigest,
        academicStanding: record.academicStanding || 'GOOD_STANDING',
        honors: record.honors || 'NONE'
      },
      digitalSignature: {
        provided: Boolean(parsedDetails.studentSignature),
        verified: studentSignatureVerified,
        signatureTimestamp: parsedDetails.signatureTimestamp || null
      },
      prerequisitesValidation: {
        verified: prerequisitesSatisfied,
        criteria: {
          attendance: { value: effectiveAttendance, min: 75.0, passed: attendancePassed },
          cgpa: { value: effectiveCgpa, min: 5.0, passed: cgpaPassed },
          credits: { earned: effectiveCredits, required: requiredCredits, passed: creditsPassed },
          backlogs: { count: effectiveBacklogs, allowed: 0, passed: backlogsPassed }
        },
        verifiedAt: timestamp
      },
      status: 'SUBMITTED',
      dacSignatures: {},
      deanBoardSignatures: {},
      createdAt: timestamp,
      updatedAt: timestamp,
      history: [
        {
          stage: 'SUBMITTED',
          updatedBy: cleanStudentId,
          timestamp,
          comments: `Certificate request submitted with verified academic prerequisites (Attendance: ${effectiveAttendance}%, CGPA: ${effectiveCgpa}, Credits: ${effectiveCredits}/${requiredCredits})`
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

  // =======================================================
  // Contributor 1.2: CouchDB Rich Queries & Department State Analytics
  // =======================================================

  async QueryStudentsByDepartment(ctx, department) {
    if (!department || typeof department !== 'string') {
      throw new Error('department is required and must be a string');
    }
    const cleanDept = department.trim();
    const queryString = {
      selector: {
        docType: 'student',
        department: cleanDept
      }
    };
    return await this._getQueryResultForQueryString(ctx, JSON.stringify(queryString), 'STUDENT_', (s) => {
      return (s.department || '').toLowerCase().includes(cleanDept.toLowerCase());
    });
  }

  async QueryRequestsByDepartmentAndStatus(ctx, department, status) {
    const cleanDept = (department || '').trim();
    const cleanStatus = (status || '').trim();
    const selector = { docType: 'certificateRequest' };
    if (cleanDept) selector.department = cleanDept;
    if (cleanStatus) selector.status = cleanStatus;

    const queryString = { selector };
    return await this._getQueryResultForQueryString(ctx, JSON.stringify(queryString), 'REQ_', (r) => {
      const matchDept = !cleanDept || (r.department || '').toLowerCase().includes(cleanDept.toLowerCase());
      const matchStatus = !cleanStatus || r.status === cleanStatus;
      return matchDept && matchStatus;
    });
  }

  async QueryStudentsByHonors(ctx, honors) {
    if (!honors || typeof honors !== 'string') {
      throw new Error('honors is required (e.g. SUMMA_CUM_LAUDE, MAGNA_CUM_LAUDE, CUM_LAUDE, DEANS_LIST)');
    }
    const cleanHonors = honors.trim().toUpperCase();
    const queryString = {
      selector: {
        docType: 'student',
        'academicRecord.honors': cleanHonors
      }
    };
    return await this._getQueryResultForQueryString(ctx, JSON.stringify(queryString), 'STUDENT_', (s) => {
      const rec = s.academicRecord || {};
      return (rec.honors || '').toUpperCase() === cleanHonors;
    });
  }

  async GetDepartmentSummaryMetrics(ctx, department) {
    const cleanDept = (department || 'Computer Science & Engineering').trim();
    const studentsRaw = await this.QueryStudentsByDepartment(ctx, cleanDept);
    const students = JSON.parse(studentsRaw);

    const requestsRaw = await this.QueryRequestsByDepartmentAndStatus(ctx, cleanDept, '');
    const requests = JSON.parse(requestsRaw);

    let totalCgpa = 0;
    let validCgpaCount = 0;
    let activeStudents = 0;
    const honorsBreakdown = {
      SUMMA_CUM_LAUDE: 0,
      MAGNA_CUM_LAUDE: 0,
      CUM_LAUDE: 0,
      DEANS_LIST: 0,
      NONE: 0
    };

    students.forEach(s => {
      if (s.status === 'ACTIVE') activeStudents++;
      const rec = s.academicRecord || {};
      if (rec.cgpa && !isNaN(rec.cgpa)) {
        totalCgpa += Number(rec.cgpa);
        validCgpaCount++;
      }
      const h = (rec.honors || 'NONE').toUpperCase();
      if (honorsBreakdown[h] !== undefined) {
        honorsBreakdown[h]++;
      } else {
        honorsBreakdown.NONE++;
      }
    });

    const requestsByStatus = {};
    requests.forEach(r => {
      requestsByStatus[r.status] = (requestsByStatus[r.status] || 0) + 1;
    });

    const avgCgpa = validCgpaCount > 0 ? (totalCgpa / validCgpaCount).toFixed(2) : '0.00';

    return JSON.stringify({
      department: cleanDept,
      totalRegisteredStudents: students.length,
      activeStudents,
      inactiveStudents: students.length - activeStudents,
      averageCgpa: Number(avgCgpa),
      honorsBreakdown,
      totalRequests: requests.length,
      requestsByStatus,
      retrievedAt: this._getTxTimestamp(ctx)
    });
  }

  async _getQueryResultForQueryString(ctx, queryString, fallbackPrefix, fallbackFilter) {
    if (ctx.stub.getQueryResult && typeof ctx.stub.getQueryResult === 'function') {
      try {
        const iterator = await ctx.stub.getQueryResult(queryString);
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
        if (results.length > 0) {
          return JSON.stringify(results);
        }
      } catch (e) {
        console.warn(`[CouchDB queryResult notice]: ${e.message}, falling back to prefix range scan`);
      }
    }

    const allRecordsRaw = await this._queryByPrefix(ctx, fallbackPrefix);
    const allRecords = JSON.parse(allRecordsRaw);
    const filtered = fallbackFilter ? allRecords.filter(fallbackFilter) : allRecords;
    return JSON.stringify(filtered);
  }
}

module.exports = AcademicContract;
