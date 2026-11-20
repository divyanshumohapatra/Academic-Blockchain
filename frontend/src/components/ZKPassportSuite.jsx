import React, { useState } from 'react';
import { useNetwork, API_BASE } from '../context/NetworkContext';
import {
  ShieldCheck,
  QrCode,
  Fingerprint,
  Bot,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Download,
  FileText,
  Lock,
  Sparkles,
  Award
} from 'lucide-react';

/* ─────────────────────────────────────────────
   Contributor 1.1  –  Academic Passport & QR
   Contributor 1.2  –  ZK Range-Proof Engine
   Contributor 1.3  –  Autonomous ZK Verifier Agent
   ───────────────────────────────────────────── */

// Defined outside the component so inputs keep focus while typing.
const Input = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div style={{ marginBottom: '14px' }}>
    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: '10px 14px',
        border: '1.5px solid #d1d5db',
        borderRadius: '10px',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s'
      }}
      onFocus={e => e.target.style.borderColor = '#6366f1'}
      onBlur={e => e.target.style.borderColor = '#d1d5db'}
    />
  </div>
);

const Card = ({ icon, title, color, children }) => (
  <div style={{
    background: '#ffffff',
    borderRadius: '16px',
    border: `2px solid ${color}33`,
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    flex: 1,
    minWidth: '320px'
  }}>
    <div style={{
      background: `linear-gradient(135deg, ${color}, ${color}dd)`,
      padding: '20px 24px',
      color: '#fff'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {icon}
        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>{title}</h3>
      </div>
    </div>
    <div style={{ padding: '20px 24px' }}>
      {children}
    </div>
  </div>
);

const Btn = ({ onClick, loading, color, children }) => (
  <button
    onClick={onClick}
    disabled={loading}
    style={{
      width: '100%',
      padding: '12px',
      background: loading ? '#9ca3af' : `linear-gradient(135deg, ${color}, ${color}cc)`,
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      fontWeight: 700,
      fontSize: '14px',
      cursor: loading ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      transition: 'transform 0.15s',
      marginBottom: '12px'
    }}
  >
    {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
    {children}
  </button>
);

const ErrorBox = ({ msg }) => msg ? (
  <div style={{
    background: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#dc2626',
    fontSize: '13px',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  }}>
    <XCircle size={14} /> {msg}
  </div>
) : null;

export default function ZKPassportSuite() {
  const { API_BASE: base } = useNetwork();
  const api = base || API_BASE;

  /* ── Contributor 1.1 state ── */
  const [passportStudentId, setPassportStudentId] = useState('STU-2024-001');
  const [passport, setPassport] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [passportLoading, setPassportLoading] = useState(false);
  const [passportError, setPassportError] = useState('');

  /* ── Contributor 1.2 state ── */
  const [zkStudentId, setZkStudentId] = useState('STU-2024-001');
  const [minCgpa, setMinCgpa] = useState('8.5');
  const [zkProof, setZkProof] = useState(null);
  const [zkLoading, setZkLoading] = useState(false);
  const [zkError, setZkError] = useState('');

  /* ── Contributor 1.3 state ── */
  const [verifyHash, setVerifyHash] = useState('');
  const [verifyThreshold, setVerifyThreshold] = useState('8.5');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  /* ── 1.1 Generate Passport ── */
  const generatePassport = async () => {
    setPassportLoading(true);
    setPassportError('');
    setPassport(null);
    setQrDataUrl('');
    try {
      const res = await fetch(`${api}/passport/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: passportStudentId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      setPassport(data.passport);
      setQrDataUrl(data.qrDataUrl || '');
    } catch (e) {
      setPassportError(e.message);
    } finally {
      setPassportLoading(false);
    }
  };

  /* ── 1.2 Generate ZK Proof ── */
  const generateZKProof = async () => {
    setZkLoading(true);
    setZkError('');
    setZkProof(null);
    try {
      const res = await fetch(`${api}/zk/generate-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: zkStudentId, minCgpaThreshold: parseFloat(minCgpa) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      setZkProof(data);
      // Auto-fill the verifier hash
      if (data.proofHash) setVerifyHash(data.proofHash);
    } catch (e) {
      setZkError(e.message);
    } finally {
      setZkLoading(false);
    }
  };

  /* ── 1.3 Verify ZK Proof ── */
  const verifyZKProof = async () => {
    setVerifyLoading(true);
    setVerifyError('');
    setVerifyResult(null);
    try {
      const res = await fetch(`${api}/zk/verify-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofHash: verifyHash, claimedThreshold: parseFloat(verifyThreshold) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      setVerifyResult(data);
    } catch (e) {
      setVerifyError(e.message);
    } finally {
      setVerifyLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  /* ───────────── card wrapper ───────────── */




  return (
    <section style={{ padding: '0' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #312e81, #4f46e5, #7c3aed)',
        borderRadius: '16px',
        padding: '28px 32px',
        marginBottom: '24px',
        color: '#fff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <ShieldCheck size={28} />
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>
            🛡️ ZK-Passport & Privacy Suite
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
          Privacy-preserving academic credentials with Cryptographic Passports, QR Codes, Zero-Knowledge Proofs & Autonomous Verification
        </p>
        <div style={{
          display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap'
        }}>
          {['Org1MSP · Academic Department', 'Hyperledger Fabric 2.5', 'SHA-256 + ZK Range Proofs'].map(tag => (
            <span key={tag} style={{
              background: 'rgba(255,255,255,0.18)',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600
            }}>{tag}</span>
          ))}
        </div>
      </div>

      {/* Three contributor cards */}
      <div style={{
        display: 'flex',
        gap: '20px',
        flexWrap: 'wrap'
      }}>

        {/* ════════════ CARD 1.1 — Academic Passport & QR ════════════ */}
        <Card
          icon={<QrCode size={20} />}
          title="Cryptographic Academic Passport & QR"
          color="#059669"
        >
          <Input
            label="Student ID"
            value={passportStudentId}
            onChange={setPassportStudentId}
            placeholder="STU-2024-001"
          />

          <Btn onClick={generatePassport} loading={passportLoading} color="#059669">
            <Fingerprint size={16} /> Generate Passport & QR Code
          </Btn>

          <ErrorBox msg={passportError} />

          {passport && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              {/* Passport Card */}
              <div style={{
                background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #6ee7b7',
                marginBottom: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Award size={18} color="#059669" />
                  <span style={{ fontWeight: 700, color: '#065f46', fontSize: '15px' }}>Academic Passport</span>
                  <span style={{
                    marginLeft: 'auto',
                    background: '#059669',
                    color: '#fff',
                    padding: '2px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700
                  }}>VERIFIED ✓</span>
                </div>
                <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7 }}>
                  <div><strong>Passport ID:</strong> {passport.passportId}</div>
                  <div><strong>DID:</strong> <code style={{ fontSize: '11px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{passport.did}</code></div>
                  <div><strong>Student:</strong> {passport.fullName || passport.studentId}</div>
                  <div><strong>Degree:</strong> {passport.degree}</div>
                  <div><strong>Latin Honors:</strong> <span style={{ color: '#b45309', fontWeight: 600 }}>{passport.latinHonors}</span></div>
                  <div><strong>Issuer:</strong> {passport.issuerMSP}</div>
                  <div><strong>Status:</strong> <span style={{ color: '#059669', fontWeight: 600 }}>{passport.status}</span></div>
                </div>
              </div>

              {/* QR Code */}
              {qrDataUrl && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                    <QrCode size={14} style={{ verticalAlign: 'middle' }} /> Scannable Verification QR
                  </p>
                  <img
                    src={qrDataUrl}
                    alt="Academic Passport QR"
                    style={{
                      width: '180px', height: '180px',
                      borderRadius: '12px',
                      border: '3px solid #059669',
                      padding: '8px',
                      background: '#fff'
                    }}
                  />
                  <div style={{ marginTop: '8px' }}>
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = qrDataUrl;
                        a.download = `passport-qr-${passport.passportId}.png`;
                        a.click();
                      }}
                      style={{
                        background: 'none',
                        border: '1px solid #059669',
                        color: '#059669',
                        borderRadius: '8px',
                        padding: '6px 16px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Download size={12} /> Download QR
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ════════════ CARD 1.2 — ZK Range-Proof Engine ════════════ */}
        <Card
          icon={<Lock size={20} />}
          title="ZK Academic Range-Proof Engine"
          color="#7c3aed"
        >
          <Input
            label="Student ID"
            value={zkStudentId}
            onChange={setZkStudentId}
            placeholder="STU-2024-001"
          />
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>
              <span>Minimum CGPA Threshold</span>
              <span style={{ color: '#7c3aed' }}>CGPA ≥ {Number(minCgpa).toFixed(1)}</span>
            </label>
            <input
              type="range"
              min="5"
              max="10"
              step="0.1"
              value={minCgpa}
              onChange={e => setMinCgpa(e.target.value)}
              style={{ width: '100%', accentColor: '#7c3aed' }}
              aria-label="Minimum CGPA threshold"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
              <span>5.0</span><span>10.0</span>
            </div>
          </div>

          <Btn onClick={generateZKProof} loading={zkLoading} color="#7c3aed">
            <Lock size={16} /> Generate Zero-Knowledge Proof
          </Btn>

          <ErrorBox msg={zkError} />

          {zkProof && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{
                background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid #c4b5fd'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <CheckCircle2 size={18} color="#7c3aed" />
                  <span style={{ fontWeight: 700, color: '#5b21b6', fontSize: '15px' }}>ZK Proof Generated</span>
                </div>
                <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7 }}>
                  <div><strong>Proof Token:</strong> <code style={{ fontSize: '11px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>{zkProof.proofToken}</code></div>
                  <div>
                    <strong>Proof Hash:</strong>{' '}
                    <code style={{ fontSize: '10px', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', wordBreak: 'break-all' }}>
                      {zkProof.proofHash}
                    </code>
                    <button
                      onClick={() => copyToClipboard(zkProof.proofHash)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: '4px', verticalAlign: 'middle' }}
                      title="Copy hash"
                    >
                      <Copy size={12} color="#7c3aed" />
                    </button>
                  </div>
                  <div><strong>Threshold:</strong> CGPA ≥ {zkProof.claimedThreshold}</div>
                  <div><strong>Satisfied:</strong> <span style={{ color: zkProof.satisfied ? '#059669' : '#dc2626', fontWeight: 700 }}>{zkProof.satisfied ? '✓ YES' : '✗ NO'}</span></div>
                  <div><strong>Issuer:</strong> {zkProof.issuerMSP}</div>
                </div>
                <div style={{
                  marginTop: '10px',
                  background: 'rgba(124, 58, 237, 0.08)',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '12px',
                  color: '#5b21b6',
                  fontStyle: 'italic'
                }}>
                  🔐 {zkProof.message}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ════════════ CARD 1.3 — Autonomous ZK Verifier Agent ════════════ */}
        <Card
          icon={<Bot size={20} />}
          title="Autonomous ZK Verifier Agent"
          color="#dc2626"
        >
          <Input
            label="Proof Hash to Verify"
            value={verifyHash}
            onChange={setVerifyHash}
            placeholder="Paste proof hash from the Range-Proof Engine..."
          />
          <Input
            label="Claimed CGPA Threshold"
            value={verifyThreshold}
            onChange={setVerifyThreshold}
            placeholder="8.5"
            type="number"
          />

          <Btn onClick={verifyZKProof} loading={verifyLoading} color="#dc2626">
            <Bot size={16} /> 🤖 Run Verifier Agent
          </Btn>

          <ErrorBox msg={verifyError} />

          {verifyResult && (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              {(() => {
                const isSuccess = verifyResult.success ?? verifyResult.verified ?? false;
                return (
                  <div style={{
                    background: isSuccess
                      ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)'
                      : 'linear-gradient(135deg, #fef2f2, #fecaca)',
                    borderRadius: '12px',
                    padding: '16px',
                    border: `1px solid ${isSuccess ? '#6ee7b7' : '#fca5a5'}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      {isSuccess
                        ? <CheckCircle2 size={18} color="#059669" />
                        : <XCircle size={18} color="#dc2626" />
                      }
                      <span style={{
                        fontWeight: 700,
                        fontSize: '15px',
                        color: isSuccess ? '#065f46' : '#991b1b'
                      }}>
                        {verifyResult.decision || (isSuccess ? 'HIRE_CLEARANCE_GRANTED ✓' : 'VERIFICATION_FAILED ✗')}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.7 }}>
                      <div><strong>Agent:</strong> {verifyResult.agent || verifyResult.agentName || 'Agent-ZK-Recruiter-Audit'}</div>
                      {verifyResult.proofHash && (
                        <div>
                          <strong>Proof Hash:</strong>{' '}
                          <code style={{ fontSize: '10px', background: '#f3f4f6', padding: '2px 4px', borderRadius: '3px' }}>
                            {verifyResult.proofHash.substring(0, 24)}...
                          </code>
                        </div>
                      )}
                      <div><strong>Privacy Level:</strong> <span style={{ color: '#059669', fontWeight: 600 }}>{verifyResult.disclosureLevel || 'Zero Knowledge'}</span></div>
                      {verifyResult.signedAuditCertificate && (
                        <div>
                          <strong>Audit Certificate:</strong>{' '}
                          <code style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                            {verifyResult.signedAuditCertificate}
                          </code>
                        </div>
                      )}
                      <div><strong>Verified At:</strong> {new Date(verifyResult.verifiedAt || verifyResult.timestamp || Date.now()).toLocaleTimeString()}</div>
                    </div>

                    {/* Agent audit steps */}
                    {verifyResult.steps && verifyResult.steps.length > 0 && (
                      <div style={{
                        marginTop: '12px',
                        background: '#0f172a',
                        borderRadius: '8px',
                        padding: '12px'
                      }}>
                        <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.5px' }}>
                          🤖 AGENT AUDIT PIPELINE
                        </p>
                        {verifyResult.steps.map((s, i) => (
                          <div key={i} style={{
                            fontSize: '11px',
                            color: '#e2e8f0',
                            fontFamily: 'monospace',
                            padding: '4px 0',
                            borderBottom: i < verifyResult.steps.length - 1 ? '1px solid #1e293b' : 'none'
                          }}>
                            <span style={{
                              color: s.status === 'CLEARED' || s.status === 'VALID' || s.status === 'ENDORSED' ? '#34d399' : '#f87171',
                              fontWeight: 700,
                              marginRight: '6px'
                            }}>
                              [{s.status}]
                            </span>
                            {s.timestamp && (
                              <span style={{ color: '#64748b', marginRight: '6px' }}>
                                {new Date(s.timestamp).toISOString().substring(11, 23)} (+{s.elapsedMs ?? 0}ms)
                              </span>
                            )}
                            <strong>{s.step}:</strong> {s.detail}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </Card>
      </div>

      {/* Spin animation for loader */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}
