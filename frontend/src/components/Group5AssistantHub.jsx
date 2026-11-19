import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Activity, 
  ShieldCheck, 
  Search, 
  Lock, 
  Unlock, 
  Radio, 
  Terminal, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Send,
  Sparkles
} from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:4000/api' : '/api';

export default function Group5AssistantHub() {
  const [subTab, setSubTab] = useState('assistant'); // 'assistant' | 'history' | 'encryption'
  const [queryKey, setQueryKey] = useState('CERT-101');
  const [historyResult, setHistoryResult] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [encryptedMode, setEncryptedMode] = useState(true);
  
  // Interactive Chat Tester inside tab
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatLog, setChatLog] = useState([
    {
      sender: 'bot',
      text: '👋 Welcome to the Group 5 Blockchain AI Assistant! Ask me about certificate statuses (e.g. CERT-101), who approved a milestone, or lifecycle history.',
      time: new Date().toLocaleTimeString()
    }
  ]);

  const sendTestMessage = async (queryText) => {
    const textToSend = (queryText || chatInput).trim();
    if (!textToSend || chatLoading) return;

    setChatLog(prev => [...prev, { sender: 'user', text: textToSend, time: new Date().toLocaleTimeString() }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      });
      const data = await res.json();
      setChatLog(prev => [...prev, {
        sender: 'bot',
        text: data.reply || 'No response',
        intent: data.intent,
        data: data.data,
        time: new Date().toLocaleTimeString()
      }]);
    } catch (err) {
      setChatLog(prev => [...prev, {
        sender: 'bot',
        text: `⚠️ Network error: ${err.message}`,
        time: new Date().toLocaleTimeString()
      }]);
    } finally {
      setChatLoading(false);
    }
  };

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
    <div className="group5-hub-container" style={{ padding: '0.5rem 0' }}>
      {/* Sub-Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.15), rgba(79, 70, 229, 0.15))',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            color: '#fff',
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
          }}>
            <Bot size={26} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Group 5: Ledger AI Assistant & Encrypted Event Hub
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Fabric Gateway gRPC Event Listeners • GetHistoryForKey Auditing • NLP Intent Engine (5.1, 5.2, 5.3)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            padding: '0.35rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
            AES-256-GCM Secure Transit
          </span>
          <span style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#3b82f6',
            padding: '0.35rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 600
          }}>
            SSE Event Bus Ready
          </span>
        </div>
      </div>

      {/* Sub-Navigation */}
      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setSubTab('assistant')}
          className={`btn-secondary ${subTab === 'assistant' ? 'btn-primary' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Bot size={15} />
          Conversational Assistant Testbench (5.2 & 5.3)
        </button>

        <button
          onClick={() => setSubTab('history')}
          className={`btn-secondary ${subTab === 'history' ? 'btn-primary' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Activity size={15} />
          GetHistoryForKey Auditing (5.1)
        </button>

        <button
          onClick={() => setSubTab('encryption')}
          className={`btn-secondary ${subTab === 'encryption' ? 'btn-primary' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ShieldCheck size={15} />
          Traditional AES-256-GCM Architecture
        </button>
      </div>

      {/* Sub-Tab 1: Assistant Testbench */}
      {subTab === 'assistant' && (
        <div className="panel-grid">
          <div className="card">
            <div className="card-title">
              <h3>
                <Sparkles size={18} className="text-primary" />
                NLP Intent Engine (Contributor 5.2)
              </h3>
              <span className="step-num">Module 5.2</span>
            </div>
            <p className="subtitle">
              Parses conversational queries into deterministic smart contract parameters and generates structured natural language replies.
            </p>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                Quick Test Prompts:
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {[
                  "What's the status of CERT-101?",
                  "Show me the history of CERT-101",
                  "Who approved CERT-101?",
                  "What stage is CERT-103 in right now?",
                  "What can you do?"
                ].map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => sendTestMessage(prompt)}
                    style={{
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      color: 'var(--primary)',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            <div style={{
              background: 'var(--bg-input, #090e1a)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              height: '320px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}>
              {chatLog.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    background: msg.sender === 'user' ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : 'rgba(255, 255, 255, 0.05)',
                    color: msg.sender === 'user' ? '#fff' : 'var(--text-primary)',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    lineHeight: '1.45',
                    border: msg.sender === 'user' ? 'none' : '1px solid var(--border-color)'
                  }}
                >
                  {msg.intent && (
                    <div style={{ fontSize: '0.7rem', color: '#60a5fa', marginBottom: '0.2rem', fontWeight: 600 }}>
                      🏷️ Intent: {msg.intent}
                    </div>
                  )}
                  <div style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                  <div style={{ fontSize: '0.68rem', opacity: 0.6, marginTop: '0.3rem', textAlign: 'right' }}>
                    {msg.time}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendTestMessage();
              }}
              style={{ display: 'flex', gap: '0.5rem' }}
            >
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask about CERT-101, approval history, or approver identity..."
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={chatLoading || !chatInput.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Send size={14} />
                Send
              </button>
            </form>
          </div>

          <div className="card">
            <div className="card-title">
              <h3>
                <Radio size={18} className="text-primary" />
                Real-Time SSE Event Stream (Contributor 5.3)
              </h3>
              <span className="step-num">Module 5.3</span>
            </div>
            <p className="subtitle">
              Pushes live blockchain events (block commits, state changes) to client applications via HTTP/2 Server-Sent Events.
            </p>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--primary)' }}>
                📡 Live Event Stream Specs:
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <li><strong>Endpoint:</strong> <code>GET /api/events</code></li>
                <li><strong>Event Type:</strong> <code>LEDGER_UPDATE</code></li>
                <li><strong>Payload Format:</strong> <code>&#123; certId, status, actor, org, txId &#125;</code></li>
                <li><strong>Encryption Mode:</strong> <code>?encrypt=true</code> (AES-256-GCM authenticated ciphertext)</li>
              </ul>
            </div>

            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem'
            }}>
              <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.85rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Bot size={15} /> Floating Widget Available
              </h4>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                The persistent floating AI Chatbot widget is mounted at the bottom-right corner of the entire application. It stays connected to the SSE stream and updates dynamically across all tabs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: GetHistoryForKey */}
      {subTab === 'history' && (
        <div className="card wide-card">
          <div className="card-title">
            <h3>
              <Activity size={18} className="text-primary" />
              Contributor 5.1: Immutable Ledger History Auditing
            </h3>
            <span className="step-num">Module 5.1</span>
          </div>
          <p className="subtitle">
            Direct chaincode invocation of <code>GetHistoryForKey</code> traversing append-only cryptographic block revisions.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={queryKey}
              onChange={e => setQueryKey(e.target.value)}
              placeholder="e.g. CERT-101, REQ-2024-001, STU-2024-001"
              style={{ flex: 1, minWidth: '240px' }}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={encryptedMode}
                onChange={e => setEncryptedMode(e.target.checked)}
              />
              Encrypt Response (AES-256-GCM)
            </label>
            <button
              onClick={handleFetchHistory}
              disabled={loadingHistory}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Search size={14} />
              {loadingHistory ? 'Auditing...' : 'Execute History Query'}
            </button>
          </div>

          {historyResult && (
            <div style={{
              background: 'var(--bg-input, #090e1a)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              maxHeight: '450px',
              overflowY: 'auto'
            }}>
              <pre style={{ margin: 0, color: historyResult.encrypted ? '#10b981' : 'var(--text-primary)' }}>
                {JSON.stringify(historyResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 3: Encryption Architecture */}
      {subTab === 'encryption' && (
        <div className="panel-grid">
          <div className="card">
            <div className="card-title">
              <h3>
                <Lock size={18} className="text-primary" />
                Traditional Symmetric Authenticated Encryption
              </h3>
              <span className="step-num">Security</span>
            </div>
            <p className="subtitle">
              Symmetric AES-256-GCM implementation for confidential ledger data transmission.
            </p>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <p>
                Per professor recommendation, sensitive ledger data extracted via history queries or event streams must not be transmitted in plaintext.
              </p>
              <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem' }}>
                <li><strong>Algorithm:</strong> <code>AES-256-GCM</code> (Galois/Counter Mode)</li>
                <li><strong>Key Derivation:</strong> <code>scryptSync</code> (32-byte master key)</li>
                <li><strong>IV:</strong> 96-bit cryptographically random Initialization Vector per message</li>
                <li><strong>Auth Tag:</strong> 128-bit authentication tag validating ciphertext integrity and preventing bit-flipping attacks</li>
              </ul>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <h3>
                <Unlock size={18} className="text-primary" />
                Decryption & Verification API
              </h3>
              <span className="step-num">API Spec</span>
            </div>
            <p className="subtitle">
              Transparent client-side decryption flow for authorized consumers.
            </p>
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: '#38bdf8'
            }}>
              POST /api/crypto/decrypt<br/>
              Body: &#123;<br/>
              &nbsp;&nbsp;"encryptedPayload": &#123;<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;"algorithm": "aes-256-gcm",<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;"iv": "...",<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;"authTag": "...",<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;"ciphertext": "..."<br/>
              &nbsp;&nbsp;&#125;<br/>
              &#125;
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
