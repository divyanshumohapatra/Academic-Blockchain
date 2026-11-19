import React, { useState, useEffect } from 'react';
import ChatbotWidget from './components/ChatbotWidget';
import { 
  Bot, 
  ShieldCheck, 
  KeyRound, 
  Terminal, 
  Server, 
  FileText,
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:4000/api' : '/api';

export default function App() {
  const [networkHealth, setNetworkHealth] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'history' | 'security'
  const [queryKey, setQueryKey] = useState('CERT-101');
  const [historyResult, setHistoryResult] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [encryptedMode, setEncryptedMode] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(d => setNetworkHealth(d))
      .catch(() => setNetworkHealth({ status: 'OFFLINE' }));
  }, []);

  const handleFetchHistory = async () => {
    if (!queryKey.trim()) return;
    setLoadingHistory(true);
    setHistoryResult(null);
    try {
      const url = `${API_BASE}/history/${encodeURIComponent(queryKey.trim())}?encrypt=${encryptedMode}`;
      const res = await fetch(url);
      const data = await res.json();
      setHistoryResult(data);
    } catch (err) {
      setHistoryResult({ error: err.message });
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="group5-app" style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #0f172a 60%, #020617 100%)',
      color: '#f8fafc',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Top Header */}
      <header style={{
        padding: '1.25rem 2rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
          }}>
            <Bot size={26} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Academic Blockchain — Group 5 Hub
            </h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
              Ledger-Aware Conversational AI Assistant & Secure Event Hub • Hyperledger Fabric 2.5
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '0.4rem 0.9rem',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: networkHealth?.status === 'UP' || networkHealth?.network?.allHealthy ? '#10b981' : '#f59e0b',
              boxShadow: '0 0 8px currentColor'
            }} />
            <span style={{ color: '#cbd5e1' }}>
              Consortium: {networkHealth?.status || 'Active'}
            </span>
          </div>

          <div style={{
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            color: '#a5b4fc',
            padding: '0.4rem 0.9rem',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 600
          }}>
            Org 1 • Org 2 • Org 3
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '0.35rem',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          width: 'fit-content',
          marginBottom: '2rem'
        }}>
          <button
            onClick={() => setActiveTab('chat')}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'chat' ? 'linear-gradient(135deg, #4f46e5, #3b82f6)' : 'transparent',
              color: activeTab === 'chat' ? '#fff' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            <Bot size={16} />
            Conversational Assistant (5.2 & 5.3)
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'history' ? 'linear-gradient(135deg, #4f46e5, #3b82f6)' : 'transparent',
              color: activeTab === 'history' ? '#fff' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            <Activity size={16} />
            Ledger History & Cryptographic Auditing (5.1)
          </button>

          <button
            onClick={() => setActiveTab('security')}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === 'security' ? 'linear-gradient(135deg, #4f46e5, #3b82f6)' : 'transparent',
              color: activeTab === 'security' ? '#fff' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            <ShieldCheck size={16} />
            AES-256-GCM Encryption Architecture
          </button>
        </div>

        {/* Tab 1: Chat Overview */}
        {activeTab === 'chat' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1.75rem'
            }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#60a5fa' }}>
                Group 5 Conversational Intelligence Architecture
              </h2>
              <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '1.25rem' }}>
                This module connects end users directly to the Hyperledger Fabric ledger through natural language:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: '#93c5fd', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                    • Contributor 5.1 — Fabric Event & History Hub
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Listens to block commits via Fabric Gateway gRPC streams and extracts full lifecycle timelines via <code>GetHistoryForKey</code>.
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: '#a78bfa', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                    • Contributor 5.2 — NLP Intent Engine
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Parses questions like <em>"What is the status of CERT-101?"</em> or <em>"Who approved the HOD stage?"</em> into deterministic queries and synthesizes explanations.
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 600, color: '#34d399', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                    • Contributor 5.3 — Chatbot Widget & Real-Time Sync
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Interactive floating widget with quick chips, markdown formatting, and live Server-Sent Event (SSE) updates pushed instantly on block committal.
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              padding: '1.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 0 30px rgba(37, 99, 235, 0.5)'
              }}>
                <Bot size={32} color="#fff" />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 700 }}>
                Interactive Chatbot Widget Active
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '360px', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                Click the circular messenger button at the bottom-right corner to open the Assistant, query mock or live certificates, and inspect the real-time SSE stream.
              </p>
              <div style={{
                background: '#0f172a',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                color: '#38bdf8'
              }}>
                API Route: POST /api/chat
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: History & Auditing */}
        {activeTab === 'history' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.75rem'
          }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#60a5fa' }}>
              Contributor 5.1: Ledger State Auditing & Temporal History
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
              Traverse the append-only cryptographic block history using Fabric's <code>GetHistoryForKey</code>.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
              <input
                type="text"
                value={queryKey}
                onChange={e => setQueryKey(e.target.value)}
                placeholder="Enter Certificate or Request ID (e.g. CERT-101, REQ-2024-001)"
                style={{
                  flex: 1,
                  background: '#090e1a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  padding: '0.75rem 1rem',
                  fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#cbd5e1', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={encryptedMode}
                  onChange={e => setEncryptedMode(e.target.checked)}
                />
                AES-256-GCM Encryption
              </label>
              <button
                onClick={handleFetchHistory}
                disabled={loadingHistory}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.4rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: loadingHistory ? 'not-allowed' : 'pointer'
                }}
              >
                {loadingHistory ? 'Auditing...' : 'Fetch History'}
              </button>
            </div>

            {historyResult && (
              <div style={{
                background: '#090e1a',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '1.25rem',
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                <pre style={{ margin: 0, color: historyResult.encrypted ? '#34d399' : '#93c5fd' }}>
                  {JSON.stringify(historyResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Security & Encryption */}
        {activeTab === 'security' && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '1.75rem'
          }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#34d399' }}>
              Traditional Cryptographic Encryption for Ledger Extractions
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '1.5rem' }}>
              Per academic review feedback, sensitive academic credentials, grade digests, and transition records extracted from the blockchain ledger must not travel in cleartext over public HTTP boundaries.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ background: '#090e1a', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#60a5fa' }}>1. Symmetric Authenticated Encryption</h4>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.5' }}>
                  Implemented using <strong>AES-256-GCM</strong> (Galois/Counter Mode). Each extraction generates a cryptographic 96-bit initialization vector (IV) and a 128-bit authentication tag to prevent tampering during transit.
                </p>
                <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#cbd5e1', background: '#1e293b', padding: '0.6rem', borderRadius: '6px' }}>
                  Cipher: aes-256-gcm<br/>
                  Key Derivation: scryptSync(32-byte)<br/>
                  Envelope: &#123; iv, authTag, ciphertext, timestamp &#125;
                </div>
              </div>

              <div style={{ background: '#090e1a', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#a78bfa' }}>2. Encrypted Event Streaming (SSE)</h4>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.5' }}>
                  The <code>/api/events?encrypt=true</code> stream pushes encrypted ledger mutations directly to authorized clients, ensuring zero plaintext leakage even across multi-tenant environments.
                </p>
                <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#cbd5e1', background: '#1e293b', padding: '0.6rem', borderRadius: '6px' }}>
                  Stream: GET /api/events?encrypt=true<br/>
                  Decrypt Utility: POST /api/crypto/decrypt
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Team Chatbot Component */}
      <ChatbotWidget />

      {/* Footer */}
      <footer style={{
        padding: '1.25rem',
        textAlign: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        fontSize: '0.78rem',
        color: '#64748b'
      }}>
        National Institute of Technology Warangal • Group 5: Ledger AI Assistant & Blockchain Event Hub (Contributors 5.1, 5.2, 5.3)
      </footer>
    </div>
  );
}
