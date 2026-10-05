import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Cpu, UserCheck, Play, CheckCircle2, XCircle } from 'lucide-react';
import { API_BASE } from '../context/NetworkContext';

export default function FraudSentinelModule() {
  const [loading, setLoading] = useState(false);
  const [inspectionResult, setInspectionResult] = useState(null);
  const [selectedScenario, setSelectedScenario] = useState('tampered');

  // Interactive Form State
  const [studentId, setStudentId] = useState('STU-7788-TAMPERED');
  const [previousGPA, setPreviousGPA] = useState('5.2');
  const [recentGPA, setRecentGPA] = useState('9.8');
  const [totalCredits, setTotalCredits] = useState('135');
  const [requiredCredits, setRequiredCredits] = useState('160');
  const [courses, setCourses] = useState('CS401, CS405');

  const presetScenarios = {
    genuine: {
      studentId: 'STU-1001-GENUINE',
      previousGPA: '8.4',
      recentGPA: '8.7',
      totalCredits: '160',
      requiredCredits: '160',
      courses: 'CS101, CS201, CS301, CS401, CS405, MATH201'
    },
    tampered: {
      studentId: 'STU-2002-CGPA-SPIKE',
      previousGPA: '5.1',
      recentGPA: '9.9',
      totalCredits: '160',
      requiredCredits: '160',
      courses: 'CS101, CS201, CS301'
    },
    prereq: {
      studentId: 'STU-3003-PREREQ-BYPASS',
      previousGPA: '7.2',
      recentGPA: '7.5',
      totalCredits: '135',
      requiredCredits: '160',
      courses: 'CS401, CS405'
    }
  };

  const applyPreset = (key) => {
    setSelectedScenario(key);
    const p = presetScenarios[key];
    setStudentId(p.studentId);
    setPreviousGPA(p.previousGPA);
    setRecentGPA(p.recentGPA);
    setTotalCredits(p.totalCredits);
    setRequiredCredits(p.requiredCredits);
    setCourses(p.courses);
    setInspectionResult(null);
  };

  const handleInspect = async () => {
    setLoading(true);
    try {
      const payload = {
        studentId,
        requestId: `REQ-${Date.now().toString().slice(-4)}`,
        transcript: {
          previousGPA: parseFloat(previousGPA) || 0,
          recentSemesterGPA: parseFloat(recentGPA) || 0,
          totalCreditsEarned: parseInt(totalCredits, 10) || 0,
          requiredCredits: parseInt(requiredCredits, 10) || 160,
          completedCourses: courses.split(',').map(c => c.trim()).filter(Boolean)
        }
      };

      const res = await fetch(`${API_BASE}/fraud/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success && data.inspection) {
        setInspectionResult(data.inspection);
      } else {
        alert('Inspection failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error contacting Fraud Sentinel API: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="module-card">
      <div className="module-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '8px', borderRadius: '10px' }}>
            <Cpu size={24} color="#38bdf8" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
              Group 3: Intelligent Fraud & Anomaly Sentinel Engine
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Autonomous Multi-Agent Academic Fraud Detection, Transcript Anomaly Heuristics & On-Chain Invariant Auditing
            </p>
          </div>
        </div>
        <span className="badge badge-primary">Group 3 Live Agent</span>
      </div>

      {/* Contributor Deliverables Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '1rem 0' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>CONTRIBUTOR 3.1</div>
          <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 700 }}>Ledger Invariant Auditor</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>CONTRIBUTOR 3.2</div>
          <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 700 }}>Transcript Anomaly & Velocity</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>CONTRIBUTOR 3.3</div>
          <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 700 }}>0–100 Risk Engine & Quarantine</div>
        </div>
      </div>

      {/* Preset Test Scenarios */}
      <div style={{ margin: '1.25rem 0' }}>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600, marginBottom: '8px' }}>
          ⚡ 1-Click Professor Demonstration Scenarios:
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className={`btn-secondary btn-sm ${selectedScenario === 'genuine' ? 'btn-active' : ''}`}
            onClick={() => applyPreset('genuine')}
          >
            🟢 Case 1: Legitimate Student (Expected: 0 Risk)
          </button>
          <button
            type="button"
            className={`btn-secondary btn-sm ${selectedScenario === 'tampered' ? 'btn-active' : ''}`}
            onClick={() => applyPreset('tampered')}
          >
            🔴 Case 2: Grade Velocity Spike (+4.8 GPA Jump)
          </button>
          <button
            type="button"
            className={`btn-secondary btn-sm ${selectedScenario === 'prereq' ? 'btn-active' : ''}`}
            onClick={() => applyPreset('prereq')}
          >
            🛑 Case 3: Prerequisite Curriculum Violation
          </button>
        </div>
      </div>

      {/* Inspection Form */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Student Roll No:</label>
          <input
            type="text"
            className="input-field"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Historical Cumulative GPA:</label>
          <input
            type="text"
            className="input-field"
            value={previousGPA}
            onChange={(e) => setPreviousGPA(e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Final Semester GPA:</label>
          <input
            type="text"
            className="input-field"
            value={recentGPA}
            onChange={(e) => setRecentGPA(e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Earned Credits:</label>
          <input
            type="text"
            className="input-field"
            value={totalCredits}
            onChange={(e) => setTotalCredits(e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Required Credits:</label>
          <input
            type="text"
            className="input-field"
            value={requiredCredits}
            onChange={(e) => setRequiredCredits(e.target.value)}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Completed Course Codes:</label>
          <input
            type="text"
            className="input-field"
            value={courses}
            onChange={(e) => setCourses(e.target.value)}
          />
        </div>
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={handleInspect}
        disabled={loading}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px' }}
      >
        <Play size={18} />
        {loading ? 'AI Agent Inspecting Academic Records...' : 'Execute Autonomous Fraud & Anomaly Audit'}
      </button>

      {/* Inspection Output Card */}
      {inspectionResult && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1.5rem',
          borderRadius: '12px',
          background: inspectionResult.shouldQuarantine ? 'rgba(239, 68, 68, 0.08)' : inspectionResult.riskScore > 30 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
          border: `1px solid ${inspectionResult.shouldQuarantine ? '#ef4444' : inspectionResult.riskScore > 30 ? '#f59e0b' : '#10b981'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {inspectionResult.shouldQuarantine ? (
                <ShieldAlert size={28} color="#ef4444" />
              ) : inspectionResult.riskScore > 30 ? (
                <AlertTriangle size={28} color="#f59e0b" />
              ) : (
                <ShieldCheck size={28} color="#10b981" />
              )}
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
                  Risk Score: {inspectionResult.riskScore} / 100 [{inspectionResult.riskLevel}]
                </div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Evaluated at: {new Date(inspectionResult.inspectedAt).toLocaleTimeString()}
                </div>
              </div>
            </div>

            <div style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              fontWeight: 700,
              fontSize: '0.85rem',
              background: inspectionResult.shouldQuarantine ? '#ef4444' : inspectionResult.riskScore > 30 ? '#f59e0b' : '#10b981',
              color: '#ffffff'
            }}>
              {inspectionResult.shouldQuarantine ? '🔒 AUTOMATIC QUARANTINE' : inspectionResult.riskScore > 30 ? '⚠️ ADVISORY WARNING' : '✅ CLEARED FOR ISSUANCE'}
            </div>
          </div>

          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '12px' }}>
            {inspectionResult.recommendation}
          </div>

          {/* Triggered Flags List */}
          {inspectionResult.flags && inspectionResult.flags.length > 0 && (
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                Violations & Anomalies Detected ({inspectionResult.flags.length}):
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {inspectionResult.flags.map((f, i) => (
                  <li key={i} style={{ fontSize: '0.85rem', color: f.severity === 'CRITICAL' ? '#fca5a5' : '#fde68a' }}>
                    <strong>[{f.severity}]</strong> {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
