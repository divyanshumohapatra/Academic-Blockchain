import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  CornerDownLeft, 
  User, 
  Activity,
  Copy,
  Check
} from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:4000/api' : '/api';

export default function ChatbotPortal() {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: '👋 Hello! I am your **Academic Blockchain AI Assistant**. You can ask me to check certificate status, trace multi-organization approval history, or identify which authority signed off on an academic milestone.',
      time: new Date().toLocaleTimeString()
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedTx, setCopiedTx] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async (textOverride) => {
    const textToSend = (textOverride || inputVal).trim();
    if (!textToSend || loading) return;

    const userMsg = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend })
      });
      const data = await res.json();

      const botMsg = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: data.reply || 'No response returned from the assistant.',
        intent: data.intent,
        data: data.data,
        time: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: 'bot-err-' + Date.now(),
        sender: 'bot',
        text: `⚠️ Network error communicating with the blockchain API: ${err.message}`,
        time: new Date().toLocaleTimeString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedTx(id);
    setTimeout(() => setCopiedTx(null), 2000);
  };

  const quickPrompts = [
    "What is the status of CERT-101?",
    "Show me the history of CERT-101",
    "Who approved CERT-101?",
    "What stage is CERT-103 in right now?",
    "What can you do?"
  ];

  return (
    <div className="card wide-card" style={{ padding: '1.75rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border-color)',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #4f46e5, #0284c7)',
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)'
          }}>
            <Bot size={24} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Chatbot
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              AES-256-GCM based secure chatbot
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            padding: '0.35rem 0.8rem',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <Lock size={12} />
            AES-256-GCM Authenticated
          </span>
          <span style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: '#3b82f6',
            padding: '0.35rem 0.8rem',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <Activity size={12} />
            Fabric 2.5 Live
          </span>
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
          Quick Prompts:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(p)}
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                color: 'var(--primary)',
                padding: '0.4rem 0.8rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--primary)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div style={{
        background: '#090e1a',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '1.25rem',
        height: '420px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1rem'
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '82%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}
          >
            <div style={{
              background: msg.sender === 'user' 
                ? 'linear-gradient(135deg, #2563eb, #3b82f6)' 
                : '#1e293b',
              color: '#ffffff',
              padding: '0.85rem 1.15rem',
              borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
              fontSize: '0.9rem',
              lineHeight: '1.55',
              border: msg.sender === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
              {msg.intent && (
                <div style={{
                  fontSize: '0.72rem',
                  color: '#93c5fd',
                  marginBottom: '0.35rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <Sparkles size={12} />
                  <span>Intent: {msg.intent}</span>
                </div>
              )}

              <div style={{ whiteSpace: 'pre-line' }}>
                {msg.text}
              </div>

              {/* Collapsible/Structured details if on-chain payload attached */}
              {msg.data?.history && (
                <div style={{
                  marginTop: '0.65rem',
                  paddingTop: '0.65rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  fontSize: '0.78rem',
                  color: '#94a3b8'
                }}>
                  <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: '0.3rem' }}>
                    🔗 Immutable Multi-Org Lifecycle Proofs:
                  </div>
                  {msg.data.history.map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                      <span><strong>{h.status}</strong> by <code>{h.actor}</code></span>
                      <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>{h.org}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <span style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted, #64748b)',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              padding: '0 4px'
            }}>
              {msg.time}
            </span>
          </div>
        ))}

        {loading && (
          <div style={{
            alignSelf: 'flex-start',
            background: '#1e293b',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            color: '#94a3b8',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Bot size={16} className="spinner" />
            <span>Consulting Hyperledger Fabric ledger...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage();
        }}
        style={{ display: 'flex', gap: '0.6rem' }}
      >
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Ask about CERT-101, approval history, or approver identity..."
          style={{
            flex: 1,
            background: '#090e1a',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.8rem 1rem',
            color: '#ffffff',
            fontSize: '0.9rem',
            outline: 'none'
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={loading || !inputVal.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.8rem 1.4rem',
            fontWeight: 600
          }}
        >
          <Send size={15} />
          Send
        </button>
      </form>
    </div>
  );
}
