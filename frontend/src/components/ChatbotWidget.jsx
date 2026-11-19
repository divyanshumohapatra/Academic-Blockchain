import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, Sparkles, Activity, ShieldCheck } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:4000/api' : '/api';

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: '👋 Hello! I am your Academic Blockchain Assistant. Ask me about certificate statuses, lifecycle history, or who approved a milestone.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [sseConnected, setSseConnected] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen, isLoading]);

  // Connect to live SSE Event Stream (5.1 & 5.3)
  useEffect(() => {
    let eventSource = null;
    try {
      eventSource = new EventSource(`${API_BASE}/events`);

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event && event.type === 'LEDGER_UPDATE' && event.payload) {
            const { certId, status, actor, org, txId } = event.payload;
            const txShort = txId ? `${txId.substring(0, 10)}...` : '';

            const sysMsg = {
              id: 'event-' + Date.now() + Math.random(),
              sender: 'system',
              certId,
              status,
              actor: actor || 'authority',
              org: org || 'Org1MSP',
              txShort,
              timestamp: new Date().toLocaleTimeString()
            };

            setMessages((prev) => [...prev, sysMsg]);
          }
        } catch (err) {
          console.warn('Could not parse SSE event:', err);
        }
      };

      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch (err) {
      console.warn('SSE connection failed:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const handleSendMessage = async (queryText) => {
    const textToSend = (queryText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    // 1. Append user message
    const userMsg = {
      id: 'user-' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    // 2. Call POST /api/chat (5.2 NLP Intent Engine)
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
        text: data?.reply || '⚠️ Unexpected response received from the assistant.',
        intent: data?.intent,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg = {
        id: 'bot-err-' + Date.now(),
        sender: 'bot',
        text: `⚠️ Could not reach Blockchain Assistant API (${err.message}). Please ensure the backend is running.`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickChips = [
    { label: 'Status CERT-2024-4025', query: "What is the status of CERT-2024-4025?" },
    { label: 'History CERT-2024-4025', query: "Show me the history of CERT-2024-4025" },
    { label: 'Who Approved?', query: "Who approved CERT-2024-4025?" },
    { label: 'Help', query: "What can you do?" }
  ];

  return (
    <div style={{ zIndex: 99999 }}>
      {/* Floating Action Button (FAB) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
            color: '#fff',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 28px rgba(37, 99, 235, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            zIndex: 99999
          }}
          title="Open Blockchain AI Assistant"
        >
          <MessageSquare size={26} />
          {/* Live Ping Indicator */}
          <span
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '13px',
              height: '13px',
              borderRadius: '50%',
              backgroundColor: sseConnected ? '#10b981' : '#f59e0b',
              border: '2px solid #0f172a',
              boxShadow: sseConnected ? '0 0 8px #10b981' : 'none'
            }}
          />
        </button>
      )}

      {/* Expandable Chat Modal Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '400px',
            maxWidth: 'calc(100vw - 32px)',
            height: '560px',
            maxHeight: 'calc(100vh - 48px)',
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '16px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif',
            zIndex: 99999
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 16px',
              background: '#1e293b',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  padding: '7px',
                  borderRadius: '10px',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Bot size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                  Consortium AI Assistant
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: sseConnected ? '#10b981' : '#f59e0b',
                      display: 'inline-block',
                      boxShadow: sseConnected ? '0 0 6px #10b981' : 'none'
                    }}
                  />
                  <span>{sseConnected ? 'Ledger Live Sync (SSE)' : 'Connecting to Ledger...'}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Minimize Chat"
            >
              <X size={20} />
            </button>
          </div>

          {/* Message List */}
          <div
            style={{
              flex: 1,
              padding: '14px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: '#090e1a'
            }}
          >
            {messages.map((msg) => {
              if (msg.sender === 'system') {
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      margin: '2px 0'
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        color: '#fbbf24',
                        fontSize: '11.5px',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        textAlign: 'center',
                        maxWidth: '92%',
                        lineHeight: 1.4,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      🔔 <strong>{msg.certId}</strong> transitioned to <strong>{msg.status}</strong>
                      <div style={{ opacity: 0.85, fontSize: '10.5px', marginTop: '2px' }}>
                        by <em>{msg.actor} ({msg.org})</em>
                      </div>
                      {msg.txShort && (
                        <code style={{ fontSize: '10px', opacity: 0.8, display: 'block', marginTop: '2px' }}>
                          tx: {msg.txShort}
                        </code>
                      )}
                    </div>
                  </div>
                );
              }

              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                    width: '100%'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      background: isUser
                        ? 'linear-gradient(135deg, #2563eb, #3b82f6)'
                        : '#1e293b',
                      color: isUser ? '#ffffff' : '#f1f5f9',
                      border: isUser ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                      borderBottomRightRadius: isUser ? '3px' : '12px',
                      borderBottomLeftRadius: isUser ? '12px' : '3px',
                      boxShadow: isUser
                        ? '0 4px 12px rgba(37, 99, 235, 0.25)'
                        : '0 2px 8px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '12.5px',
                    background: '#1e293b',
                    color: '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderBottomLeftRadius: '3px',
                    fontStyle: 'italic',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Activity size={14} className="spin-slow" />
                  🤖 Assistant is querying blockchain...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Prompt Chips */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              padding: '8px 12px',
              background: '#111827',
              overflowX: 'auto',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              scrollbarWidth: 'none'
            }}
          >
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip.query)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#93c5fd',
                  fontSize: '11.5px',
                  padding: '4px 10px',
                  borderRadius: '14px',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#2563eb';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.color = '#93c5fd';
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            style={{
              display: 'flex',
              padding: '10px 12px',
              background: '#1e293b',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              gap: '8px'
            }}
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about CERT-101 or type query..."
              autoComplete="off"
              style={{
                flex: 1,
                background: '#090e1a',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#fff',
                padding: '9px 12px',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isLoading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                opacity: isLoading || !inputMessage.trim() ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Send size={14} />
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
