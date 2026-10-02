import { useCallback, useEffect, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiRefreshCw } from 'react-icons/fi';
import api from '../api';
import { AssistantGlyph } from '../layout/Assistant';
import { apiError, formatDateTime } from '../lib/format';
import { Skeleton } from './Bits';

const PRIORITY = { high: 'badge-rose', medium: 'badge-amber', low: 'badge-cyan' };

// Follow-ups that look due: rule-based reminders plus an AI review of the record.
// Cached for the browser session so the AI isn't called on every visit.
const FollowUps = ({ cnic, compact = false }) => {
  const key = `pakmed.followups.${cnic}`;
  const [state, setState] = useState(() => {
    try {
      return { data: JSON.parse(sessionStorage.getItem(key)), loading: false, error: null };
    } catch {
      return { data: null, loading: false, error: null };
    }
  });

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await api.get(`/followups/${cnic}`);
      try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
      setState({ data, loading: false, error: null });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: apiError(err) }));
    }
  }, [cnic, key]);

  useEffect(() => { if (!state.data) run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const items = state.data?.items || [];
  return (
    <section className="glass card-pad stack gap-12">
      <div className="row between wrap gap-8">
        <h2 className="section-title row gap-8"><AssistantGlyph size={16} /> Follow-ups</h2>
        <div className="row gap-8">
          {state.data && <span className="subtle" style={{ fontSize: 12 }}>Checked {formatDateTime(state.data.checkedAt)}</span>}
          <button className="btn btn-ghost btn-sm btn-icon" onClick={run} disabled={state.loading} aria-label="Check again"><FiRefreshCw className={state.loading ? 'spin' : ''} /></button>
        </div>
      </div>
      {state.loading && !state.data ? <Skeleton height={80} /> : state.error && !state.data ? <p className="subtle">{state.error}</p> : items.length === 0 ? (
        <div className="mini-empty"><FiCheckCircle size={20} color="var(--emerald)" /><span>Nothing looks overdue. We check your records, medicines, vaccines and lab results.</span></div>
      ) : (
        <div className="stack gap-8">
          {items.slice(0, compact ? 3 : 8).map((i) => (
            <div key={i.title} className="followup">
              <FiAlertCircle className="followup-icon" />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row gap-8 wrap"><strong>{i.title}</strong><span className={`badge badge-plain ${PRIORITY[i.priority]}`}>{i.priority}</span>{i.source === 'ai' && <span className="ai-badge" style={{ height: 20 }}>AI</span>}</div>
                {i.detail && <p className="muted" style={{ fontSize: 13.5, margin: '4px 0 0' }}>{i.detail}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {items.some((i) => i.source === 'ai') && <p className="subtle" style={{ fontSize: 12 }}>AI suggestions can be wrong. Discuss them with your doctor.</p>}
    </section>
  );
};

export default FollowUps;
