import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCornerDownLeft, FiLogOut, FiSearch } from 'react-icons/fi';

// ⌘K quick navigation
const CommandPalette = ({ open, onClose, items, onLogout }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(() => {
    const all = [...items.map((i) => ({ ...i, run: () => navigate(i.to) })), { label: 'Sign out', icon: FiLogOut, run: onLogout }];
    const q = query.trim().toLowerCase();
    return q ? all.filter((i) => i.label.toLowerCase().includes(q)) : all;
  }, [items, query, navigate, onLogout]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setIndex(0), [query]);

  const run = (item) => {
    onClose();
    item?.run();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); run(results[index]); }
    if (e.key === 'Escape') onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" style={{ placeItems: 'start center', paddingTop: '14vh' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div
            className="glass palette"
            role="dialog"
            aria-label="Command palette"
            initial={{ opacity: 0, scale: 0.94, rotateX: -20, y: -20 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="palette-input">
              <FiSearch size={18} />
              <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKeyDown} placeholder="Where to?" aria-label="Search pages" />
              <kbd>esc</kbd>
            </div>
            <div className="palette-list" role="listbox">
              {results.length === 0 && <div className="subtle" style={{ padding: 18, textAlign: 'center' }}>No matches</div>}
              {results.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button key={item.label} role="option" aria-selected={i === index} className={`palette-item ${i === index ? 'active' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => run(item)}>
                    <Icon size={17} />
                    <span className="grow">{item.label}</span>
                    {i === index && <FiCornerDownLeft size={14} className="subtle" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default CommandPalette;
