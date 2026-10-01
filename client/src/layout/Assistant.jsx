import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiArrowUp, FiCheck, FiClock, FiMessageSquare, FiPlus, FiSquare, FiTrash2, FiX, FiAlertTriangle,
} from 'react-icons/fi';
import api from '../api';
import { streamAI } from '../lib/ai';
import Markdown from '../ui/Markdown';
import { Spinner } from '../ui/Bits';
import { useFeedback } from '../ui/Feedback';
import './assistant.css';

const SUGGESTIONS = {
  patient: [
    'Summarise my health records',
    'What do my latest lab results mean?',
    'How has my blood pressure been trending?',
    'Book a follow-up with my doctor next week',
    'What should I ask at my next appointment?',
    'Mera allergy record kya kehta hai?',
  ],
  doctor: [
    "What's on my schedule today?",
    'Which records are waiting for my review?',
    'Brief me on my next patient',
    'Do any of my patients have abnormal vitals?',
  ],
};

export const AssistantGlyph = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 2.5l1.9 5.1 5.1 1.9-5.1 1.9L12 16.5l-1.9-5.1L5 9.5l5.1-1.9L12 2.5z" fill="currentColor" />
    <path d="M18.5 14.5l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9.9-2.3z" fill="currentColor" opacity=".7" />
  </svg>
);

// Notify open pages that the assistant changed data (booking, vitals, notes)
const announceChange = () => window.dispatchEvent(new Event('pakmed:data-changed'));

const Assistant = ({ role, open, onOpen, onClose }) => {
  const { toast } = useFeedback();
  const [enabled, setEnabled] = useState(null);
  const [keyName, setKeyName] = useState('MISTRAL_API_KEY');
  const [messages, setMessages] = useState([]);
  const [threadId, setThreadId] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showThreads, setShowThreads] = useState(false);
  const [threads, setThreads] = useState([]);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get('/ai/status').then((r) => {
      setEnabled(r.data.enabled);
      if (r.data.keyName) setKeyName(r.data.keyName);
    }).catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  // keep the newest message in view while streaming
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const loadThreads = useCallback(async () => {
    try {
      setThreads((await api.get('/ai/threads')).data.threads);
    } catch {
      /* ignore */
    }
  }, []);

  const openThread = async (id) => {
    try {
      const { data } = await api.get(`/ai/threads/${id}`);
      setThreadId(id);
      setMessages(data.thread.messages.map((m) => ({ ...m, tools: [] })));
      setShowThreads(false);
    } catch {
      toast('Could not open that conversation', 'error');
    }
  };

  const deleteThread = async (id) => {
    await api.delete(`/ai/threads/${id}`).catch(() => {});
    setThreads((t) => t.filter((x) => x._id !== id));
    if (id === threadId) newChat();
  };

  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setThreadId(null);
    setShowThreads(false);
    setInput('');
  };

  const stop = () => abortRef.current?.abort();

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput('');
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text: message }, { role: 'assistant', text: '', tools: [], streaming: true }]);

    const controller = new AbortController();
    abortRef.current = controller;
    // Accumulate the reply outside React state, then publish snapshots (keeps updaters pure)
    const reply = { role: 'assistant', text: '', tools: [], streaming: true };
    let turnStart = 0;
    let newTurn = false;
    const publish = () =>
      setMessages((m) => [...m.slice(0, -1), { ...reply, tools: reply.tools.map((t) => ({ ...t })) }]);

    try {
      await streamAI('/ai/chat', { message, threadId }, (ev) => {
        switch (ev.type) {
          case 'thread':
            setThreadId(ev.threadId);
            return;
          case 'turn':
            newTurn = true;
            turnStart = reply.text.length;
            return;
          case 'reset':
            reply.text = reply.text.slice(0, turnStart);
            break;
          case 'text':
            // blank line between text from separate model turns (before/after a tool call)
            if (newTurn && reply.text && !reply.text.endsWith('\n')) reply.text += '\n\n';
            newTurn = false;
            reply.text += ev.text;
            break;
          case 'tool':
            reply.tools.push({ name: ev.name, label: ev.label, done: false });
            break;
          case 'tool_done': {
            const t = reply.tools.find((x) => x.name === ev.name && !x.done);
            if (t) Object.assign(t, { done: true, ok: ev.ok });
            if (ev.mutated) announceChange();
            break;
          }
          case 'error':
            if (ev.status === 503) setEnabled(false);
            reply.error = ev.error;
            break;
          default:
            return;
        }
        publish();
      }, controller.signal);
    } catch (err) {
      if (err.name !== 'AbortError') reply.error = 'Connection lost. Please try again.';
    } finally {
      reply.streaming = false;
      reply.stopped = controller.signal.aborted;
      publish();
      setBusy(false);
      abortRef.current = null;
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const panel = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="asst-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="asst glass"
            role="dialog"
            aria-label="PakMed Assistant"
            initial={{ x: '105%', rotateY: -18, opacity: 0.4 }}
            animate={{ x: 0, rotateY: 0, opacity: 1 }}
            exit={{ x: '105%', rotateY: -12, opacity: 0.4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          >
            <header className="asst-head">
              <div className="row gap-12">
                <span className="asst-avatar"><AssistantGlyph size={18} /></span>
                <div>
                  <div style={{ fontWeight: 650 }}>PakMed Assistant</div>
                  <div className="subtle" style={{ fontSize: 12 }}>{role === 'doctor' ? 'Clinical co-pilot' : 'Your health companion'} · AI</div>
                </div>
              </div>
              <div className="row gap-4">
                <button className="btn btn-ghost btn-sm btn-icon" title="Conversations" aria-label="Conversations" onClick={() => { setShowThreads((s) => !s); loadThreads(); }}><FiClock /></button>
                <button className="btn btn-ghost btn-sm btn-icon" title="New chat" aria-label="New chat" onClick={newChat}><FiPlus /></button>
                <button className="btn btn-ghost btn-sm btn-icon" title="Close" aria-label="Close assistant" onClick={onClose}><FiX /></button>
              </div>
            </header>

            <AnimatePresence>
              {showThreads && (
                <motion.div className="asst-threads" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {threads.length === 0 ? (
                    <div className="subtle" style={{ padding: 16, fontSize: 13 }}>No saved conversations yet.</div>
                  ) : threads.map((t) => (
                    <div key={t._id} className={`asst-thread ${t._id === threadId ? 'active' : ''}`}>
                      <button className="grow truncate" onClick={() => openThread(t._id)}><FiMessageSquare size={13} /> {t.title}</button>
                      <button className="btn btn-ghost btn-sm btn-icon" aria-label="Delete conversation" onClick={() => deleteThread(t._id)}><FiTrash2 size={13} /></button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="asst-body" ref={scrollRef}>
              {enabled === false ? (
                <div className="asst-empty">
                  <div className="asst-orb disabled"><FiAlertTriangle size={26} /></div>
                  <h3>Assistant not configured</h3>
                  <p className="muted">
                    The AI assistant needs an API key. Add <code>{keyName}</code> to <code>server/.env</code> and restart the server.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="asst-empty">
                  <div className="asst-orb"><AssistantGlyph size={34} /></div>
                  <h3>{role === 'doctor' ? 'How can I help with your clinic?' : 'Ask me about your health record'}</h3>
                  <p className="muted">
                    {role === 'doctor'
                      ? 'I can look up your schedule, review queue and the history of your patients.'
                      : 'I can read your records, appointments and vitals, explain them in plain language, and book or log things for you.'}
                  </p>
                  <div className="asst-suggest">
                    {SUGGESTIONS[role].map((s) => (
                      <button key={s} className="asst-chip" onClick={() => send(s)} disabled={!enabled}>{s}</button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <motion.div key={i} className={`asst-msg ${m.role}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                    {m.role === 'user' ? (
                      <div className="asst-bubble">{m.text}</div>
                    ) : (
                      <div className="asst-reply">
                        {m.tools?.length > 0 && (
                          <div className="asst-tools">
                            {m.tools.map((t, j) => (
                              <span key={j} className={`asst-tool ${t.done ? (t.ok ? 'ok' : 'fail') : ''}`}>
                                {t.done ? (t.ok ? <FiCheck size={12} /> : <FiX size={12} />) : <Spinner size={11} />}
                                {t.label}
                              </span>
                            ))}
                          </div>
                        )}
                        {m.text ? <Markdown text={m.text} /> : m.streaming && !m.error && (
                          <div className="asst-typing" aria-label="Thinking"><span /><span /><span /></div>
                        )}
                        {m.error && <div className="asst-error"><FiAlertTriangle size={14} /> {m.error}</div>}
                        {m.stopped && !m.error && <div className="subtle" style={{ fontSize: 12, marginTop: 6 }}>Stopped</div>}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </div>

            <form className="asst-composer" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={enabled === false ? 'Assistant unavailable' : 'Ask anything… (Urdu or English)'}
                disabled={enabled === false}
                aria-label="Message the assistant"
              />
              {busy ? (
                <button type="button" className="asst-send stop" onClick={stop} aria-label="Stop generating"><FiSquare size={14} /></button>
              ) : (
                <button type="submit" className="asst-send" disabled={!input.trim() || enabled === false} aria-label="Send"><FiArrowUp size={18} /></button>
              )}
            </form>
            <p className="asst-disclaimer">AI can make mistakes and isn&apos;t a substitute for a doctor. In an emergency call <strong>1122</strong>.</p>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <motion.button
        className="asst-launcher"
        onClick={onOpen}
        aria-label="Open PakMed Assistant"
        title="PakMed Assistant (⌘J)"
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: open ? 0 : 1, rotate: 0 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      >
        <span className="asst-launcher-ring" />
        <AssistantGlyph size={24} />
      </motion.button>
      {createPortal(panel, document.body)}
    </>
  );
};

export default Assistant;
