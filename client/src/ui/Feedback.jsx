import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCheckCircle, FiAlertTriangle, FiInfo } from 'react-icons/fi';
import Modal from './Modal';

// App-wide toasts and confirm dialogs (replaces alert / window.confirm)
const FeedbackContext = createContext(null);

const ICONS = { success: FiCheckCircle, error: FiAlertTriangle, info: FiInfo };

export const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const idRef = useRef(0);

  const toast = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const confirm = useCallback(
    (options) => new Promise((resolve) => setConfirmState({ ...options, resolve })),
    []
  );

  const closeConfirm = (result) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {toasts.map(({ id, message, type }) => {
            const Icon = ICONS[type] || FiInfo;
            return (
              <motion.div
                key={id}
                layout
                className={`toast ${type}`}
                initial={{ opacity: 0, x: 60, rotateY: -30 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                exit={{ opacity: 0, x: 60, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              >
                <Icon className="toast-icon" size={18} />
                <span>{message}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <Modal
        open={Boolean(confirmState)}
        onClose={() => closeConfirm(false)}
        title={confirmState?.title}
        subtitle={confirmState?.message}
        width={440}
      >
        <div className="row gap-12" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={() => closeConfirm(false)}>Cancel</button>
          <button
            className={`btn ${confirmState?.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => closeConfirm(true)}
            autoFocus
          >
            {confirmState?.confirmLabel || 'Confirm'}
          </button>
        </div>
      </Modal>
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => useContext(FeedbackContext);
