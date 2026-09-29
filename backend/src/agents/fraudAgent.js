'use strict';

const { queryChaincode } = require('../fabric');

/**
 * Intelligent Fraud Detection & Anomaly Analysis Engine
 */
class FraudDetectionAgent {
  constructor() {
    this.name = 'Agent-Fraud-Sentinel';
    this.role = 'On-Chain Invariant Audit & Anomaly Intelligence';
    this.submissionCache = new Map(); // For velocity detection
  }

  /**
   * Run comprehensive 0-100 risk scoring on a certificate request
   */
  async evaluateRisk(requestData, studentData = null) {
    const findings = [];
    let riskScore = 0;

    const details = requestData.details || {};
    const studentId = requestData.studentId || 'UNKNOWN';
    const requestId = requestData.requestId || 'UNKNOWN';

    // 1. Velocity & Replay Attack Analysis
    const now = Date.now();
    const lastSubmissions = this.submissionCache.get(studentId) || [];
    const recentSubmissions = lastSubmissions.filter(t => now - t < 60000); // within 1 min
    this.submissionCache.set(studentId, [...recentSubmissions, now]);

    if (recentSubmissions.length >= 3) {
      riskScore += 40;
      findings.push({
        type: 'VELOCITY_ANOMALY',
        severity: 'HIGH',
        detail: `High submission velocity detected: ${recentSubmissions.length + 1} requests within 60 seconds.`
      });
    }

    // 2. Transcript & CGPA Anomaly Checks
    const cgpa = details.cgpa !== undefined ? Number(details.cgpa) : 8.85;
    if (cgpa > 10.0 || cgpa < 0.0) {
      riskScore += 60;
      findings.push({
        type: 'TRANSCRIPT_ANOMALY',
        severity: 'CRITICAL',
        detail: `Impossible CGPA value detected: ${cgpa}/10.0.`
      });
    } else if (cgpa >= 9.8 && details.attendance && Number(details.attendance) < 60) {
      riskScore += 35;
      findings.push({
        type: 'CORRELATION_ANOMALY',
        severity: 'HIGH',
        detail: `Severe discrepancy: Near-perfect CGPA (${cgpa}) with critically low attendance (${details.attendance}%).`
      });
    }

    // 3. Attendance Deficit Check
    const attendance = details.attendance !== undefined ? Number(details.attendance) : 88.5;
    if (attendance < 75.0) {
      const isSevere = attendance < 60.0;
      riskScore += isSevere ? 30 : 15;
      findings.push({
        type: 'ATTENDANCE_DEFICIT',
        severity: isSevere ? 'HIGH' : 'MEDIUM',
        detail: `Attendance below statutory threshold: ${attendance}% (Mandatory: 75%).`
      });
    }

    // 4. Backlogs / Disciplinary Hold Check
    const backlogs = details.backlogs !== undefined ? Number(details.backlogs) : 0;
    if (backlogs > 0) {
      riskScore += 25 * backlogs;
      findings.push({
        type: 'ACTIVE_BACKLOGS',
        severity: 'HIGH',
        detail: `Student has ${backlogs} active backlog(s) recorded in registry.`
      });
    }

    if (details.disciplinaryClearance === false) {
      riskScore += 50;
      findings.push({
        type: 'DISCIPLINARY_HOLD',
        severity: 'CRITICAL',
        detail: `Student profile has an active disciplinary hold from Proctor office.`
      });
    }

    // 5. Fee / Dues Verification
    const feeDues = details.feeDues !== undefined ? Number(details.feeDues) : 0;
    const libraryDues = details.libraryDues !== undefined ? Number(details.libraryDues) : 0;
    if (feeDues > 0 || libraryDues > 0) {
      riskScore += 20;
      findings.push({
        type: 'UNPAID_DUES',
        severity: 'MEDIUM',
        detail: `Outstanding dues detected: Fee=₹${feeDues}, Library=₹${libraryDues}.`
      });
    }

    // 6. Ledger Invariant & State Machine Consistency Check
    if (requestData.history && Array.isArray(requestData.history)) {
      const validStageOrder = [
        'SUBMITTED',
        'FACULTY_APPROVED',
        'HOD_APPROVED',
        'DAC_APPROVED',
        'EXAM_LOCKED',
        'DEAN_APPROVED',
        'ADMIN_FINALIZED'
      ];

      const stagesInHistory = requestData.history.map(h => h.stage);
      let lastIndex = -1;
      let invariantViolated = false;

      for (const s of stagesInHistory) {
        const idx = validStageOrder.indexOf(s);
        if (idx < lastIndex) {
          invariantViolated = true;
          break;
        }
        lastIndex = idx;
      }

      if (invariantViolated) {
        riskScore += 70;
        findings.push({
          type: 'LEDGER_INVARIANT_VIOLATION',
          severity: 'CRITICAL',
          detail: `Out-of-sequence state transition detected in ledger history: [${stagesInHistory.join(' -> ')}].`
        });
      }
    }

    // Cap score at 100
    riskScore = Math.min(100, Math.max(0, riskScore));

    // Determine Risk Level & Recommendation
    let riskLevel = 'LOW';
    let recommendation = 'ALLOW_PROCEED';

    if (riskScore >= 75) {
      riskLevel = 'CRITICAL';
      recommendation = 'QUARANTINE_REQUEST';
    } else if (riskScore >= 45) {
      riskLevel = 'HIGH';
      recommendation = 'MANUAL_REVIEW_REQUIRED';
    } else if (riskScore >= 20) {
      riskLevel = 'MEDIUM';
      recommendation = 'SUPERVISED_PROCEED';
    }

    return {
      agent: this.name,
      requestId,
      studentId,
      riskScore,
      riskLevel,
      recommendation,
      findings,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new FraudDetectionAgent();
