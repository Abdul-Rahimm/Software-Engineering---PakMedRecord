import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertTriangle, FiCamera, FiCheckCircle, FiChevronDown, FiFileText, FiRefreshCw, FiUploadCloud, FiX } from 'react-icons/fi';
import { ACCEPT, deleteUpload, formatBytes, isSupported, retryReading, uploadFile } from '../lib/files';
import Markdown from './Markdown';
import { Spinner } from './Bits';
import './uploader.css';

let seq = 0;

// Drag-and-drop / browse / camera upload with live status. Each uploaded file is read by the AI on the server.
// onChange receives the current items: { key, name, size, phase, attachment, error }
const Uploader = ({ patientCNIC, onChange, max = 5, compact = false }) => {
  const [items, setItems] = useState([]);
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState(null);
  const fileInput = useRef(null);
  const cameraInput = useRef(null);

  useEffect(() => { onChange?.(items); }, [items, onChange]);
  // free local previews when the component goes away
  useEffect(() => () => items.forEach((i) => i.preview && URL.revokeObjectURL(i.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (key, patch) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const start = async (item) => {
    update(item.key, { phase: 'uploading', progress: 0, error: '' });
    try {
      const attachment = await uploadFile(item.file, patientCNIC, (p) => update(item.key, { progress: p, ...(p >= 1 && { phase: 'reading' }) }));
      update(item.key, { attachment, phase: attachment.ocr.status === 'done' ? 'done' : 'unread' });
    } catch (err) {
      update(item.key, { phase: 'error', error: err.message });
    }
  };

  const addFiles = (fileList) => {
    const incoming = Array.from(fileList || []);
    const room = max - items.length;
    const accepted = [];
    const rejected = [];
    incoming.forEach((file) => {
      if (accepted.length >= room) rejected.push(`${file.name}: only ${max} files per record`);
      else if (!isSupported(file)) rejected.push(`${file.name}: use PDF, JPG, PNG or WebP`);
      else accepted.push({
        key: ++seq,
        file,
        name: file.name,
        size: file.size,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        phase: 'queued',
        progress: 0,
      });
    });
    if (rejected.length) {
      setItems((list) => [...list, ...rejected.map((r) => ({ key: ++seq, name: r.split(':')[0], size: 0, phase: 'error', error: r.split(': ')[1] }))]);
    }
    if (accepted.length) {
      setItems((list) => [...list, ...accepted]);
      accepted.forEach(start);
    }
  };

  const retry = async (item) => {
    if (!item.attachment) return start(item);
    update(item.key, { phase: 'reading', error: '' });
    try {
      const attachment = await retryReading(item.attachment._id);
      update(item.key, { attachment, phase: attachment.ocr.status === 'done' ? 'done' : 'unread' });
    } catch (err) {
      update(item.key, { phase: 'unread' });
    }
  };

  const remove = (item) => {
    setItems((list) => list.filter((i) => i.key !== item.key));
    if (item.preview) URL.revokeObjectURL(item.preview);
    if (item.attachment) deleteUpload(item.attachment._id).catch(() => {});
  };

  const busy = items.some((i) => i.phase === 'uploading' || i.phase === 'reading');

  return (
    <div className="stack gap-12">
      {items.filter((i) => i.phase !== 'error' || i.file).length < max && (
        <div
          className={`dropzone ${drag ? 'drag' : ''} ${compact ? 'compact' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          onClick={() => fileInput.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.current?.click())}
          aria-label="Upload documents"
        >
          <span className="dz-icon"><FiUploadCloud size={compact ? 20 : 26} /></span>
          <div className="stack gap-4" style={{ alignItems: 'center' }}>
            <strong>{drag ? 'Drop to upload' : 'Drag files here or click to browse'}</strong>
            <span className="subtle" style={{ fontSize: 13 }}>PDF, JPG, PNG or WebP · up to 4 MB each · max {max}</span>
          </div>
          <div className="row gap-8 wrap" style={{ justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="btn btn-sm" onClick={() => fileInput.current?.click()}><FiFileText /> Choose files</button>
            <button type="button" className="btn btn-sm dz-camera" onClick={() => cameraInput.current?.click()}><FiCamera /> Take a photo</button>
          </div>
          <input ref={fileInput} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        </div>
      )}

      <AnimatePresence initial={false}>
        {items.map((item) => {
          const ocr = item.attachment?.ocr;
          return (
            <motion.div key={item.key} className={`up-item ${item.phase}`} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }}>
              <div className="row gap-12">
                <div className="up-thumb">
                  {item.preview ? <img src={item.preview} alt="" /> : <FiFileText size={22} />}
                </div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="truncate" style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                  <div className="up-status">
                    {item.phase === 'uploading' && <><Spinner size={12} /> Uploading… {Math.round((item.progress || 0) * 100)}%</>}
                    {item.phase === 'reading' && <><Spinner size={12} /> Reading the document with AI…</>}
                    {item.phase === 'done' && <><FiCheckCircle /> Text extracted{ocr?.title ? ` · ${ocr.title}` : ''}</>}
                    {item.phase === 'unread' && <><FiAlertTriangle /> {ocr?.error || 'Could not read this file'}</>}
                    {item.phase === 'error' && <><FiAlertTriangle /> {item.error}</>}
                    {item.size > 0 && item.phase !== 'error' && <span className="subtle"> · {formatBytes(item.size)}</span>}
                  </div>
                </div>
                <div className="row gap-4">
                  {item.phase === 'done' && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(open === item.key ? null : item.key)} aria-expanded={open === item.key}>
                      Text <FiChevronDown style={{ transform: open === item.key ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                    </button>
                  )}
                  {(item.phase === 'unread' || (item.phase === 'error' && item.file)) && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => retry(item)}><FiRefreshCw /> Retry</button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(item)} aria-label={`Remove ${item.name}`} disabled={item.phase === 'uploading'}><FiX /></button>
                </div>
              </div>
              {item.phase === 'uploading' && <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${(item.progress || 0) * 100}%` }} /></div>}
              {item.phase === 'reading' && <div className="progress reading" style={{ marginTop: 10 }}><span /></div>}
              <AnimatePresence>
                {open === item.key && ocr?.text && (
                  <motion.div className="up-text" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <Markdown text={ocr.text} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {busy && <p className="subtle" style={{ fontSize: 12.5 }}>You can keep filling in the form while files are read.</p>}
    </div>
  );
};

export default Uploader;
