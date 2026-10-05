'use strict';

/**
 * Group 3: Intelligent Fraud Detection, Anomaly Analysis & Security Engine
 *
 * Contributor 3.1 — Ledger Invariant & State Auditor
 * Contributor 3.2 — Transcript Anomaly & Heuristics Lead
 * Contributor 3.3 — Autonomous Fraud Scoring & Quarantine Lead
 */

// In-memory submission tracking for velocity detection (Contributor 3.2)
const submissionTracker = new Map();

/**
 * Contributor 3.2: Heuristic & Statistical Anomaly Rules
 */
function evaluateTranscriptAnomalies(transcript) {
  const flags = [];
  let riskPoints = 0;

  if (!transcript) {
    return { riskPoints: 0, flags };
  }

  // 1. CGPA Velocity Spike Check
  // Sudden jump between cumulative prior semesters and final semester
  if (transcript.previousGPA !== undefined && transcript.recentSemesterGPA !== undefined) {
    const delta = transcript.recentSemesterGPA - transcript.previousGPA;
    if (delta >= 3.0) {
      riskPoints += 75;
      flags.push({
        type: 'CGPA_VELOCITY_SPIKE',
        severity: 'CRITICAL',
        message: `Severe academic performance anomaly: CGPA jumped by +${delta.toFixed(2)} (from ${transcript.previousGPA} to ${transcript.recentSemesterGPA}) in a single term.`
      });
    } else if (delta >= 2.0) {
      riskPoints += 45;
      flags.push({
        type: 'CGPA_VELOCITY_ELEVATED',
        severity: 'HIGH',
        message: `Elevated academic performance variance: CGPA increased by +${delta.toFixed(2)}.`
      });
    } else if (delta >= 1.5) {
      riskPoints += 25;
      flags.push({
        type: 'CGPA_VELOCITY_MODERATE',
        severity: 'MEDIUM',
        message: `Moderate performance delta: CGPA increased by +${delta.toFixed(2)}.`
      });
    }
  }

  // 2. Prerequisite Graph Invariant Violation
  // Checking if student took an advanced course without foundational prerequisite
  if (Array.isArray(transcript.completedCourses)) {
    const courses = new Set(transcript.completedCourses.map(c => (typeof c === 'string' ? c : c.code || '').toUpperCase()));
    
    // Core Rules: Advanced course requires foundational prerequisite
    const prerequisiteRules = [
      { advanced: 'CS401', required: 'CS201', desc: 'Advanced Algorithms requires Data Structures (CS201)' },
      { advanced: 'CS405', required: 'CS301', desc: 'Distributed Systems requires Operating Systems (CS301)' },
      { advanced: 'CS410', required: 'MATH201', desc: 'Cryptography & Blockchain requires Discrete Mathematics (MATH201)' }
    ];

    for (const rule of prerequisiteRules) {
      if (courses.has(rule.advanced) && !courses.has(rule.required)) {
        riskPoints += 70;
        flags.push({
          type: 'PREREQUISITE_INVARIANT_VIOLATION',
          severity: 'CRITICAL',
          message: `Curriculum integrity breach: Enrolled in ${rule.advanced} without passing ${rule.required} (${rule.desc}).`
        });
      }
    }
  }

  // 3. Minimum Credit Floor Validation
  if (transcript.totalCreditsEarned !== undefined && transcript.requiredCredits !== undefined) {
    if (transcript.totalCreditsEarned < transcript.requiredCredits) {
      const deficit = transcript.requiredCredits - transcript.totalCreditsEarned;
      riskPoints += 70;
      flags.push({
        type: 'CREDIT_DEFICIT',
        severity: 'CRITICAL',
        message: `Degree requirements unfulfilled: ${deficit} credits short of minimum graduation requirement (${transcript.totalCreditsEarned}/${transcript.requiredCredits}).`
      });
    }
  }

  return { riskPoints, flags };
}

/**
 * Contributor 3.2: Velocity Anomaly & Replay Attack Detection
 */
function evaluateVelocityAnomalies(studentId) {
  const flags = [];
  let riskPoints = 0;
  const now = Date.now();
  const WINDOW_MS = 60 * 1000; // 60-second window

  let timestamps = submissionTracker.get(studentId) || [];
  // Filter only submissions within the last 60 seconds
  timestamps = timestamps.filter(ts => now - ts < WINDOW_MS);
  timestamps.push(now);
  submissionTracker.set(studentId, timestamps);

  if (timestamps.length >= 3) {
    riskPoints += 35;
    flags.push({
      type: 'RAPID_SUBMISSION_REPLAY',
      severity: 'HIGH',
      message: `Rapid velocity alert: ${timestamps.length} certificate requests submitted in under 60 seconds (Potential replay or bot attack).`
    });
  }

  return { riskPoints, flags };
}

/**
 * Contributor 3.1: Ledger Invariant & State Monotonicity Check
 */
function evaluateLedgerInvariants(requestHistory) {
  const flags = [];
  let riskPoints = 0;

  if (!Array.isArray(requestHistory) || requestHistory.length === 0) {
    return { riskPoints: 0, flags };
  }

  const STAGE_ORDER = [
    'SUBMITTED',
    'FACULTY_APPROVED',
    'HOD_APPROVED',
    'DAC_APPROVED',
    'EXAM_LOCKED',
    'DEAN_APPROVED',
    'ADMIN_FINALIZED',
    'CERTIFICATE_ISSUED'
  ];

  let lastIndex = -1;
  let lastTimestamp = 0;

  for (const entry of requestHistory) {
    const currentIndex = STAGE_ORDER.indexOf(entry.stage);
    const entryTime = new Date(entry.timestamp).getTime();

    // Check 1: Monotonic State Progression (No backward or illegal stage skips)
    if (currentIndex <= lastIndex && entry.stage !== 'SUBMITTED') {
      riskPoints += 60;
      flags.push({
        type: 'ILLEGAL_STATE_JUMP',
        severity: 'CRITICAL',
        message: `Ledger invariant broken: Out-of-order stage transition detected to '${entry.stage}'.`
      });
    }

    // Check 2: Monotonic Time Ordering
    if (entryTime < lastTimestamp) {
      riskPoints += 50;
      flags.push({
        type: 'RETROACTIVE_TIMESTAMP_TAMPER',
        severity: 'CRITICAL',
        message: `Temporal invariant breach: State transition has a timestamp prior to its preceding stage.`
      });
    }

    lastIndex = currentIndex;
    lastTimestamp = entryTime;
  }

  return { riskPoints, flags };
}

/**
 * Contributor 3.3: Master Autonomous Fraud Scoring & Quarantine Engine
 *
 * Aggregates evaluations from 3.1 and 3.2, computes a unified 0-100 score,
 * and determines automated blockchain quarantine action.
 */
function runFraudInspection(payload) {
  const { studentId, requestId, transcript, history } = payload;

  const transcriptResult = evaluateTranscriptAnomalies(transcript);
  const velocityResult = evaluateVelocityAnomalies(studentId);
  const invariantResult = evaluateLedgerInvariants(history);

  // Combine risk points (capped at 100)
  const totalRiskScore = Math.min(
    100,
    transcriptResult.riskPoints + velocityResult.riskPoints + invariantResult.riskPoints
  );

  const allFlags = [
    ...transcriptResult.flags,
    ...velocityResult.flags,
    ...invariantResult.flags
  ];

  // Risk Classification
  let riskLevel = 'LOW';
  let shouldQuarantine = false;
  let recommendation = 'CLEARED: Automated academic validation passed.';

  const hasCriticalFlag = allFlags.some(f => f.severity === 'CRITICAL');

  if (totalRiskScore >= 70 || hasCriticalFlag) {
    riskLevel = 'CRITICAL';
    shouldQuarantine = true;
    recommendation = 'AUTOMATIC QUARANTINE: Severe anomaly detected. Request is locked pending academic integrity review.';
  } else if (totalRiskScore >= 35) {
    riskLevel = 'MEDIUM';
    shouldQuarantine = false;
    recommendation = 'ADVISORY WARNING: Elevated variance detected. Forwarded to Dean with flagged audit trail.';
  }

  return {
    inspectedAt: new Date().toISOString(),
    studentId,
    requestId: requestId || 'N/A',
    riskScore: totalRiskScore,
    riskLevel,
    shouldQuarantine,
    recommendation,
    flagsCount: allFlags.length,
    flags: allFlags,
    breakdown: {
      transcriptRisk: transcriptResult.riskPoints,
      velocityRisk: velocityResult.riskPoints,
      invariantRisk: invariantResult.riskPoints
    }
  };
}

module.exports = {
  runFraudInspection,
  evaluateTranscriptAnomalies,
  evaluateVelocityAnomalies,
  evaluateLedgerInvariants
};
