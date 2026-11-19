import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  User, 
  Activity, 
  RotateCcw,
  Cloud,
  ExternalLink,
  Award,
  KeyRound,
  Building,
  GraduationCap
} from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:4000/api' : '/api';
const STORAGE_KEY = 'academic_blockchain_chat_history_v2';
const ROLE_STORAGE_KEY = 'academic_blockchain_active_role_v1';

const CONSORTIUM_ROLES = [
  {
    id: 'STUDENT',
    label: 'Student',
    icon: '🎓',
    org: 'Public Portal',
    user: 'Alice Johnson',
    email: 'alice.johnson@academic.edu',
    color: '#0284c7',
    badge: 'Public Verification',
    description: 'Degree verification & public status tracking',
    prompts: [
      "What is the status of CERT-2024-001?",
      "status of this roll number student STU-2024-001",
      "Show me the history of CERT-2024-001",
      "Explain Raft consensus",
      "How does IPFS work?"
    ]
  },
  {
    id: 'FACULTY',
    label: 'Faculty',
    icon: '👨‍🏫',
    org: 'Org 1 Academic Authority',
    user: 'Dr. Rajesh Kumar',
    email: 'rajesh.kumar@academic.edu',
    color: '#4f46e5',
    badge: 'Org 1 • Coursework & CIE',
    description: 'Coursework instructor, attendance & CIE mark audit',
    prompts: [
      "Find Dr. Rajesh Kumar",
      "Who approved CERT-2024-001?",
      "Show student profile STU-2024-001",
      "Explain 7-stage lifecycle workflow",
      "Check network health"
    ]
  },
  {
    id: 'HOD',
    label: 'HOD',
    icon: '🏛️',
    org: 'Org 1 Academic Authority',
    user: 'Prof. K. V. Rao',
    email: 'hod.cse@academic.edu',
    color: '#0891b2',
    badge: 'Org 1 • Department Head',
    description: 'Department curriculum approval & DAC committee multi-sig',
    prompts: [
      "Show me the history of CERT-2024-001",
      "Who approved CERT-2024-001?",
      "What is consortium governance?",
      "Check network health"
    ]
  },
  {
    id: 'EXAM_CONTROLLER',
    label: 'Exam Controller',
    icon: '📝',
    org: 'Org 2 Evaluation Authority',
    user: 'Prof. S. R. Murthy',
    email: 'controller@academic.edu',
    color: '#d97706',
    badge: 'Org 2 • Grade Lockdown',
    description: 'Grade registry lockdown & Merkle root transcript audit',
    prompts: [
      "Who approved CERT-2024-001?",
      "What is the status of CERT-2024-001?",
      "Explain AES encryption",
      "Check network health"
    ]
  },
  {
    id: 'ADMIN',
    label: 'Administrator',
    icon: '🛡️',
    org: 'Org 3 Central Administration',
    user: 'Central Administration Authority',
    email: 'admin@academic.edu',
    color: '#059669',
    badge: 'Org 3 • Cloudflare R2 Full Access',
    description: 'Full consortium governance & Cloudflare R2 enterprise backup storage',
    prompts: [
      "Check Cloudflare R2 backup status",
      "Get Cloudflare R2 link for CERT-2024-001",
      "Explain Cloudflare R2 backup architecture",
      "Show me the history of CERT-2024-001",
      "Check network health"
    ]
  }
];

const DEFAULT_WELCOME = {
  id: 'welcome',
  sender: 'bot',
  text: '👋 Welcome to the **Academic Blockchain AI Assistant** with Role-Based Access Control!\n\nSelect your consortium organization role above to access role-specific ledger features. Central Administrators have exclusive access to Cloudflare R2 enterprise backup storage and presigned certificate download links.',
  time: new Date().toLocaleTimeString()
};

function renderFormattedText(text) {
  if (!text) return null;
  // Parse markdown links [Label](url)
  const parts = [];
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <a
        key={match.index}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          color: '#1e40af',
          background: 'rgba(37, 99, 235, 0.1)',
          border: '1px solid rgba(37, 99, 235, 0.3)',
          padding: '4px 10px',
          borderRadius: '6px',
          fontWeight: 600,
          textDecoration: 'none',
          margin: '4px 0',
          transition: 'all 0.15s ease'
        }}
      >
        <span>{match[1]}</span>
        <ExternalLink size={13} />
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

export default function ChatbotPortal() {
  const [activeRole, setActiveRole] = useState(() => {
    try {
      const savedRoleId = localStorage.getItem(ROLE_STORAGE_KEY);
      const found = CONSORTIUM_ROLES.find(r => r.id === savedRoleId);
      if (found) return found;
    } catch (e) {}
    return CONSORTIUM_ROLES[4]; // Default to ADMIN for rich demo experience
  });

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [DEFAULT_WELCOME];
  });

  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {}
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem(ROLE_STORAGE_KEY, activeRole.id);
    } catch (e) {}
  }, [activeRole]);

  const handleClearChat = () => {
    setMessages([DEFAULT_WELCOME]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  };

  const sendMessage = async (textOverride) => {
    const textToSend = (textOverride || inputVal).trim();
    if (!textToSend || loading) return;

    const userMsg = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: textToSend,
      role: activeRole.id,
      time: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': activeRole.id
        },
        body: JSON.stringify({ 
          message: textToSend,
          role: activeRole.id,
          user: activeRole.user
        })
      });
      const data = await res.json();

      const botMsg = {
        id: 'bot-' + Date.now(),
        sender: 'bot',
        text: data.reply || 'No response returned from the assistant.',
        intent: data.intent,
        data: data.data,
        role: activeRole.id,
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

  return (
    <div className="card wide-card" style={{ padding: '1.75rem', maxWidth: '1060px', margin: '0 auto', background: 'var(--panel-bg, #ffffff)' }}>
      {/* Top Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '1.25rem',
        borderBottom: '1px solid var(--border, #e6dfd5)',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a, #0284c7)',
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(30, 58, 138, 0.25)'
          }}>
            <Bot size={26} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--heading, #0f172a)' }}>
              Consortium AI Assistant
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
              Role-Based Access Control • Fabric 2.5 • IPFS Kubo • Cloudflare R2 Enterprise Backup
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleClearChat}
            title="Clear Chat History"
            style={{
              background: 'var(--bg-subtle, #f5f1ea)',
              border: '1px solid var(--border, #e6dfd5)',
              color: 'var(--text-muted, #64748b)',
              padding: '0.4rem 0.85rem',
              borderRadius: '20px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontWeight: 500,
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCcw size={13} />
            Clear
          </button>

          <span style={{
            background: 'var(--success-bg, #ecfdf5)',
            border: '1px solid var(--success-border, #a7f3d0)',
            color: 'var(--success, #059669)',
            padding: '0.4rem 0.85rem',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <Cloud size={13} />
            Cloudflare R2 Dual Storage
          </span>

          <span style={{
            background: 'var(--primary-light, #eff6ff)',
            border: '1px solid var(--primary-border, #bfdbfe)',
            color: 'var(--primary, #1e3a8a)',
            padding: '0.4rem 0.85rem',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem'
          }}>
            <Lock size={13} />
            AES-256-GCM Secure
          </span>
        </div>
      </div>

      {/* Organization & Role-Based Access Control Switcher */}
      <div style={{
        background: 'var(--bg-subtle, #f5f1ea)',
        border: '1px solid var(--border, #e6dfd5)',
        borderRadius: '12px',
        padding: '0.9rem 1.15rem',
        marginBottom: '1.25rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <KeyRound size={16} color="var(--primary, #1e3a8a)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--heading, #0f172a)' }}>
              Active Consortium Role & Organization Access:
            </span>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>
            Selected: <strong style={{ color: activeRole.color }}>{activeRole.user}</strong> ({activeRole.email})
          </div>
        </div>

        {/* Role Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {CONSORTIUM_ROLES.map((r) => {
            const isSelected = activeRole.id === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setActiveRole(r)}
                style={{
                  background: isSelected ? r.color : 'var(--panel-bg, #ffffff)',
                  color: isSelected ? '#ffffff' : 'var(--text, #1c1917)',
                  border: isSelected ? `1px solid ${r.color}` : '1px solid var(--border, #e6dfd5)',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '10px',
                  fontSize: '0.82rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>{r.icon}</span>
                <span>{r.label}</span>
                <span style={{
                  fontSize: '0.7rem',
                  opacity: isSelected ? 0.9 : 0.6,
                  padding: '1px 6px',
                  borderRadius: '12px',
                  background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-subtle, #f5f1ea)'
                }}>
                  {r.id === 'ADMIN' ? 'R2 Admin' : r.id === 'STUDENT' ? 'Public' : 'Org ' + (r.id === 'EXAM_CONTROLLER' ? '2' : '1')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Role Privilege Notice */}
        <div style={{
          marginTop: '0.75rem',
          paddingTop: '0.65rem',
          borderTop: '1px solid var(--border-light, #f0ebe2)',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <span style={{ color: 'var(--text-muted, #64748b)' }}>
            <strong>Scope:</strong> {activeRole.description}
          </span>
          <span style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: '6px',
            background: activeRole.id === 'ADMIN' ? 'var(--success-bg, #ecfdf5)' : 'var(--primary-light, #eff6ff)',
            color: activeRole.id === 'ADMIN' ? 'var(--success, #059669)' : 'var(--primary, #1e3a8a)',
            fontWeight: 600,
            border: `1px solid ${activeRole.id === 'ADMIN' ? 'var(--success-border, #a7f3d0)' : 'var(--primary-border, #bfdbfe)'}`
          }}>
            {activeRole.id === 'ADMIN' ? '🛡️ Cloudflare R2 Full Access' : '🔒 Cloudflare R2 Restricted (Admin Only)'}
          </span>
        </div>
      </div>

      {/* Dynamic Quick Prompts Bar */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', marginBottom: '0.5rem', fontWeight: 600 }}>
          Suggested Queries for {activeRole.label}:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {activeRole.prompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(p)}
              style={{
                background: 'var(--primary-light, #eff6ff)',
                border: '1px solid var(--primary-border, #bfdbfe)',
                color: 'var(--primary, #1e3a8a)',
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'var(--primary, #1e3a8a)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'var(--primary-light, #eff6ff)';
                e.currentTarget.style.color = 'var(--primary, #1e3a8a)';
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Main Conversation Stream */}
      <div style={{
        background: 'var(--bg-subtle, #f5f1ea)',
        border: '1px solid var(--border, #e6dfd5)',
        borderRadius: '12px',
        padding: '1.25rem',
        height: '460px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        marginBottom: '1rem',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem'
              }}
            >
              <div style={{
                background: isUser 
                  ? 'linear-gradient(135deg, #1e3a8a, #2563eb)' 
                  : 'var(--panel-bg, #ffffff)',
                color: isUser ? '#ffffff' : 'var(--text, #1c1917)',
                padding: '0.9rem 1.25rem',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                fontSize: '0.9rem',
                lineHeight: '1.6',
                border: isUser ? 'none' : '1px solid var(--border, #e6dfd5)',
                boxShadow: isUser 
                  ? '0 3px 10px rgba(30, 58, 138, 0.25)' 
                  : '0 2px 6px rgba(44, 39, 32, 0.05)'
              }}>
                {msg.intent && (
                  <div style={{
                    fontSize: '0.74rem',
                    color: isUser ? '#bfdbfe' : msg.intent === 'RBAC_FORBIDDEN' ? '#dc2626' : '#2563eb',
                    marginBottom: '0.4rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}>
                    <Sparkles size={13} />
                    <span>Intent: {msg.intent}</span>
                  </div>
                )}

                <div style={{ whiteSpace: 'pre-line' }}>
                  {renderFormattedText(msg.text)}
                </div>

                {/* Collapsible/Structured details if on-chain payload attached */}
                {msg.data?.history && (
                  <div style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: `1px solid ${isUser ? 'rgba(255,255,255,0.2)' : 'var(--border, #e6dfd5)'}`,
                    fontSize: '0.78rem',
                    color: isUser ? '#e0e7ff' : 'var(--text-muted, #64748b)'
                  }}>
                    <div style={{ fontWeight: 600, color: isUser ? '#ffffff' : 'var(--primary, #1e3a8a)', marginBottom: '0.35rem' }}>
                      🔗 Immutable Multi-Org Lifecycle Proofs:
                    </div>
                    {msg.data.history.map((h, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span><strong>{h.status}</strong> by <code>{h.actor}</code></span>
                        <span style={{ fontFamily: 'monospace', opacity: 0.85 }}>{h.org}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <span style={{
                fontSize: '0.7rem',
                color: 'var(--text-dim, #94a3b8)',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                padding: '0 4px'
              }}>
                {msg.time} {msg.role ? `• ${msg.role}` : ''}
              </span>
            </div>
          );
        })}

        {loading && (
          <div style={{
            alignSelf: 'flex-start',
            background: 'var(--panel-bg, #ffffff)',
            border: '1px solid var(--border, #e6dfd5)',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            color: 'var(--text-muted, #64748b)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 2px 6px rgba(44, 39, 32, 0.05)'
          }}>
            <Bot size={16} className="spinner" />
            <span>Consulting Hyperledger Fabric & Consortium Storage...</span>
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
          placeholder={`Ask as ${activeRole.label}... (e.g. "${activeRole.prompts[0]}")`}
          style={{
            flex: 1,
            background: 'var(--panel-bg, #ffffff)',
            border: '1px solid var(--border, #e6dfd5)',
            borderRadius: '10px',
            padding: '0.85rem 1.1rem',
            color: 'var(--text, #1c1917)',
            fontSize: '0.9rem',
            outline: 'none',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
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
            padding: '0.85rem 1.5rem',
            fontWeight: 600,
            borderRadius: '10px'
          }}
        >
          <Send size={15} />
          Send
        </button>
      </form>
    </div>
  );
}
