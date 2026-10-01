import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiClock, FiEdit3, FiMaximize2, FiTrash2 } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, byNewest } from '../../lib/data';
import { apiError, formatDateTime } from '../../lib/format';
import { Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import TiltCard from '../../ui/TiltCard';
import Modal from '../../ui/Modal';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const ACCENTS = ['var(--emerald)', 'var(--cyan)', 'var(--violet)', 'var(--amber)'];

const Notes = () => {
  const { cnic } = useShell();
  const { toast, confirm } = useFeedback();
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(null);

  const { data: notes, loading, reload, setData } = useFetch(
    async () => [...(await api.get(`/patient/${cnic}/getnote`)).data.notes].sort(byNewest),
    [cnic]
  );

  const add = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await api.post(`/patient/${cnic}/addnote`, { note: draft.trim() });
      setDraft('');
      toast('Note saved');
      reload();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (n) => {
    const ok = await confirm({ title: 'Delete this note?', message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/patient/${cnic}/removenote/${n._id}`);
      setData((list) => list.filter((x) => x._id !== n._id));
      setOpen(null);
      toast('Note deleted');
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  return (
    <>
      <PageHeader eyebrow="Private" title="Notes" subtitle="Only you can see these. Use them for symptoms, questions for your doctor or medicine reminders." />

      <form className="glass card-pad stack gap-12" onSubmit={add} style={{ marginBottom: 28 }}>
        <textarea
          className="textarea"
          style={{ minHeight: 90, background: 'transparent', border: 0, boxShadow: 'none', padding: 0, fontSize: 16 }}
          placeholder="Write a note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && add(e)}
          aria-label="New note"
        />
        <div className="row between">
          <span className="subtle" style={{ fontSize: 12.5 }}><kbd>⌘</kbd> + <kbd>Enter</kbd> to save</span>
          <Button className="btn btn-primary btn-sm" loading={saving} disabled={!draft.trim()}><FiEdit3 /> Save note</Button>
        </div>
      </form>

      {loading ? (
        <div className="grid grid-3"><Skeleton height={140} /><Skeleton height={180} /><Skeleton height={120} /></div>
      ) : notes.length === 0 ? (
        <div className="glass"><EmptyState icon={FiEdit3} title="No notes yet">Your first note is one sentence away.</EmptyState></div>
      ) : (
        <div className="notes-grid">
          <AnimatePresence>
            {notes.map((n, i) => (
              <motion.div key={n._id} layout initial={{ opacity: 0, y: 30, rotateX: -20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, scale: 0.85, rotateZ: -4 }} transition={{ delay: Math.min(i, 8) * 0.04, type: 'spring', stiffness: 220, damping: 24 }}>
                <TiltCard className="note-card card-pad" style={{ borderTop: `2px solid ${ACCENTS[i % ACCENTS.length]}` }}>
                  <p className="depth-1">{n.note.length > 280 ? `${n.note.slice(0, 280)}…` : n.note}</p>
                  <div className="row between">
                    <span className="subtle row gap-8" style={{ fontSize: 12.5 }}><FiClock /> {formatDateTime(n.createdAt)}</span>
                    <div className="row gap-4 note-actions">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setOpen(n)} aria-label="Open note"><FiMaximize2 /></button>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(n)} aria-label="Delete note"><FiTrash2 /></button>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title="Note" subtitle={open && formatDateTime(open.createdAt)}>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 16 }}>{open?.note}</p>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
          <button className="btn btn-danger btn-sm" onClick={() => remove(open)}><FiTrash2 /> Delete</button>
        </div>
      </Modal>
    </>
  );
};

export default Notes;
