import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FiBell, FiCalendar, FiCheckCircle, FiFileText, FiUserPlus, FiXCircle, FiClipboard,
} from 'react-icons/fi';
import api from '../api';

const ICONS = {
  appointment: FiCalendar, cancelled: FiXCircle, record: FiFileText, approved: FiCheckCircle,
  rejected: FiXCircle, submission: FiClipboard, affiliation: FiUserPlus,
};

const ago = (date) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(date)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

// Bell with unread count and a dropdown; polls every 30 seconds
const NotificationBell = ({ placement = 'down' }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications');
      setItems(data.notifications);
      setUnread(data.unread);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    window.addEventListener('pakmed:data-changed', load);
    return () => { clearInterval(id); window.removeEventListener('pakmed:data-changed', load); };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.read) {
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api.patch(`/notifications/${n._id}/read`).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
    api.patch('/notifications/read-all').catch(() => {});
  };

  return (
    <div className="bell" ref={ref}>
      <button className="btn btn-ghost btn-icon bell-btn" onClick={() => { setOpen((o) => !o); if (!open) load(); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <FiBell size={18} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span className="bell-count" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`glass bell-panel ${placement}`}
            initial={{ opacity: 0, y: -8, rotateX: -15, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <div className="row between" style={{ padding: '14px 16px 10px' }}>
              <strong>Notifications</strong>
              {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}>Mark all read</button>}
            </div>
            <div className="bell-list">
              {items.length === 0 ? (
                <div className="subtle" style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13.5 }}>You&apos;re all caught up.</div>
              ) : items.map((n) => {
                const Icon = ICONS[n.type] || FiBell;
                return (
                  <button key={n._id} className={`bell-item ${n.read ? '' : 'unread'} t-${n.type}`} onClick={() => openItem(n)}>
                    <span className="bell-icon"><Icon size={15} /></span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="bell-title">{n.title}</span>
                      {n.body && <span className="bell-body">{n.body}</span>}
                      <span className="bell-time">{ago(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="bell-dot" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
