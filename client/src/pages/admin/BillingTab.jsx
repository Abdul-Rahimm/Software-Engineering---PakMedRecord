import { useState } from 'react';
import { FiCheck, FiDollarSign, FiFileText, FiSearch, FiSlash } from 'react-icons/fi';
import api from '../../api';
import { useFetch } from '../../lib/data';
import { apiError, formatCNIC, formatDate, formatDateTime } from '../../lib/format';
import { Button, EmptyState, Skeleton } from '../../ui/Bits';
import { useFeedback } from '../../ui/Feedback';

const rs = (n) => `Rs ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
const thisMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' }).slice(0, 7);
const monthLabel = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shiftMonth = (m, n) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

const METHOD = { safepay: 'Safepay', clinic: 'At clinic', test: 'Test', jazzcash: 'JazzCash' };
const STATUS = {
  paid: ['badge-green', 'Paid'], initiated: ['badge-amber', 'Pending'], failed: ['badge-rose', 'Failed'], cancelled: ['', 'Cancelled'],
  refund_due: ['badge-amber', 'Refund due'], refunded: ['', 'Refunded'], open: ['badge-amber', 'Open'], void: ['', 'Void'],
};
const Badge = ({ s }) => <span className={`badge ${(STATUS[s] || [''])[0]}`}>{(STATUS[s] || ['', s])[1]}</span>;

const Kpi = ({ label, value, note }) => (
  <div className="kpi"><span>{label}</span><strong>{value}</strong>{note && <em>{note}</em>}</div>
);

// Admin: platform payments, commission earned and monthly invoices to clinics
const BillingTab = () => {
  const { toast, confirm } = useFeedback();
  const [month, setMonth] = useState(thisMonth());
  const [env, setEnv] = useState('all');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);
  const sum = useFetch(async () => (await api.get('/admin/billing/summary', { params: { month, env } })).data, [month, env]);
  const pays = useFetch(async () => (await api.get('/admin/billing/payments', { params: { month, env, status: status || undefined, q: q || undefined } })).data, [month, env, status, q]);
  const invs = useFetch(async () => (await api.get('/admin/billing/invoices', { params: { env } })).data, [env]);
  const reloadAll = () => { sum.reload(true); pays.reload(true); invs.reload(true); };

  const invoice = async (p) => {
    setBusy(`${p.type}${p.id}${p.environment}`);
    try {
      const { data } = await api.post('/admin/billing/invoices', { payeeType: p.type, payeeId: p.id, period: month, environment: p.environment });
      toast(data.message);
      reloadAll();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(null);
    }
  };
  const act = async (inv, action) => {
    if (action === 'void' && !(await confirm({ title: `Void invoice ${inv.number}?`, message: 'Its payments go back to "not invoiced" so you can bill them again.', confirmLabel: 'Void', danger: true }))) return;
    const note = action === 'paid' ? window.prompt('How was it paid? (optional, e.g. bank transfer ref)', '') : '';
    if (note === null) return;
    try {
      const { data } = await api.post(`/admin/billing/invoices/${inv._id}`, { action, note });
      toast(data.message);
      reloadAll();
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  const s = sum.data;
  return (
    <div className="stack gap-20">
      <div className="row between wrap gap-12">
        <div className="row gap-8">
          <button className="btn btn-icon btn-sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
          <strong style={{ minWidth: 150, textAlign: 'center' }}>{monthLabel(month)}</strong>
          <button className="btn btn-icon btn-sm" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth()} aria-label="Next month">›</button>
        </div>
        <div className="chips">
          {[['all', 'All'], ['production', 'Live'], ['sandbox', 'Sandbox']].map(([v, l]) => <button key={v} className="chip" aria-pressed={env === v} onClick={() => setEnv(v)}>{l}</button>)}
        </div>
      </div>

      {!s ? <Skeleton height={120} /> : (
        <section className="glass card-pad-lg stack gap-16">
          <div className="row between wrap gap-8">
            <h2 className="section-title">Platform revenue</h2>
            <span className="subtle" style={{ fontSize: 13 }}>{s.commissionRate}% of every online consultation fee, invoiced monthly</span>
          </div>
          <div className="kpi-grid">
            <Kpi label="Online fees processed" value={rs(s.online.gross)} note={`${s.online.count} payment${s.online.count === 1 ? '' : 's'}`} />
            <Kpi label="Commission earned" value={rs(s.online.commission)} note={monthLabel(month)} />
            <Kpi label="Outstanding invoices" value={rs(s.invoices.open.amount)} note={`${s.invoices.open.count} open`} />
            <Kpi label="Collected" value={rs(s.invoices.paid.amount)} note={`${s.invoices.paid.count} paid invoice${s.invoices.paid.count === 1 ? '' : 's'}`} />
            <Kpi label="Refunded fees" value={rs(s.refunded.amount)} note={`${s.refunded.count} · no commission`} />
          </div>
          {s.byMethod.length > 0 && <p className="subtle" style={{ fontSize: 13 }}>All fees this month: {s.byMethod.map((m) => `${METHOD[m.method] || m.method} ${rs(m.amount)} (${m.count})`).join(' · ')}</p>}
        </section>
      )}

      <section className="glass card-pad-lg stack gap-16">
        <h2 className="section-title">Commission by clinic · {monthLabel(month)}</h2>
        {!s ? <Skeleton height={100} /> : !s.payees.length ? <EmptyState icon={FiDollarSign} title="No online payments this month">Commission appears once patients pay clinics through Safepay.</EmptyState> : (
          <div className="table-wrap">
            <table className="table stack-sm">
              <thead><tr><th>Clinic / doctor</th><th>Payments</th><th>Fees received</th><th>Commission</th><th>Not yet invoiced</th><th /></tr></thead>
              <tbody>
                {s.payees.map((p) => (
                  <tr key={`${p.type}${p.id}${p.environment}`}>
                    <td><strong>{p.name}</strong><div className="subtle" style={{ fontSize: 12 }}>{p.type === 'clinic' ? 'Clinic' : 'Solo doctor'}{p.environment === 'sandbox' ? ' · sandbox' : ''}</div></td>
                    <td>{p.count}</td>
                    <td>{rs(p.gross)}</td>
                    <td><strong>{rs(p.commission)}</strong></td>
                    <td>{p.uninvoiced > 0 ? rs(p.uninvoiced) : <span className="subtle">—</span>}</td>
                    <td>{p.uninvoiced > 0 && <Button className="btn btn-sm btn-primary" loading={busy === `${p.type}${p.id}${p.environment}`} onClick={() => invoice(p)}><FiFileText /> Create invoice</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass card-pad-lg stack gap-16">
        <h2 className="section-title">Invoices</h2>
        {invs.loading ? <Skeleton height={100} /> : !invs.data.length ? <p className="subtle">No invoices yet. Create one from the table above.</p> : (
          <div className="table-wrap">
            <table className="table stack-sm">
              <thead><tr><th>Invoice</th><th>To</th><th>Month</th><th>Fees</th><th>Amount due</th><th>Status</th><th /></tr></thead>
              <tbody>
                {invs.data.map((i) => (
                  <tr key={i._id} style={i.status === 'void' ? { opacity: 0.5 } : undefined}>
                    <td className="mono">{i.number}{i.environment === 'sandbox' && <div className="subtle" style={{ fontSize: 11 }}>sandbox</div>}</td>
                    <td><strong>{i.payee.name}</strong>{i.payee.email && <div className="subtle" style={{ fontSize: 12 }}>{i.payee.email}</div>}</td>
                    <td>{monthLabel(i.period)}</td>
                    <td>{rs(i.grossAmount)}<div className="subtle" style={{ fontSize: 12 }}>{i.paymentCount} payment{i.paymentCount === 1 ? '' : 's'}</div></td>
                    <td><strong>{rs(i.commissionAmount)}</strong><div className="subtle" style={{ fontSize: 12 }}>{i.status === 'paid' ? `paid ${formatDate(i.paidAt)}` : `due ${formatDate(i.dueAt)}`}</div></td>
                    <td><Badge s={i.status} /></td>
                    <td>
                      <div className="row gap-4">
                        {i.status === 'open' && <button className="btn btn-sm" onClick={() => act(i, 'paid')}><FiCheck /> Mark paid</button>}
                        {i.status === 'paid' && <button className="btn btn-sm btn-ghost" onClick={() => act(i, 'reopen')}>Reopen</button>}
                        {i.status !== 'void' && <button className="btn btn-sm btn-ghost btn-icon" onClick={() => act(i, 'void')} aria-label="Void invoice" title="Void"><FiSlash /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass card-pad-lg stack gap-16">
        <div className="row between wrap gap-12">
          <h2 className="section-title">All payments · {monthLabel(month)}</h2>
          <div className="row gap-8 wrap">
            <select className="select" style={{ width: 160 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="">Any status</option>
              {['paid', 'initiated', 'refund_due', 'refunded', 'cancelled', 'failed'].map((v) => <option key={v} value={v}>{STATUS[v][1]}</option>)}
            </select>
            <div className="search input-wrap"><FiSearch size={16} /><input className="input" placeholder="Receipt no., clinic or CNIC" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          </div>
        </div>
        {pays.loading ? <Skeleton height={160} /> : !pays.data.length ? <p className="subtle">No payments match.</p> : (
          <div className="table-wrap">
            <table className="table stack-sm">
              <thead><tr><th>When</th><th>Patient</th><th>Doctor · paid to</th><th>Method</th><th>Amount</th><th>Commission</th><th>Status</th></tr></thead>
              <tbody>
                {pays.data.map((p) => (
                  <tr key={p._id}>
                    <td>{formatDateTime(p.paidAt || p.createdAt)}<div className="subtle mono" style={{ fontSize: 11 }}>{p.txnRef}</div></td>
                    <td>{p.patientName}<div className="subtle mono" style={{ fontSize: 11 }}>{formatCNIC(p.patientCNIC)}</div></td>
                    <td>{p.doctorName}{p.payee?.name && <div className="subtle" style={{ fontSize: 12 }}>→ {p.payee.name}</div>}</td>
                    <td>{METHOD[p.provider] || p.provider}{p.environment === 'sandbox' && <div className="subtle" style={{ fontSize: 11 }}>sandbox</div>}</td>
                    <td>{rs(p.amount)}</td>
                    <td>{p.commissionAmount != null ? rs(p.commissionAmount) : <span className="subtle">—</span>}{p.invoiceId && <div className="subtle" style={{ fontSize: 11 }}>invoiced</div>}</td>
                    <td><Badge s={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default BillingTab;
