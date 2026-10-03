import { useEffect, useState } from 'react';
import { FiCheckCircle, FiCopy, FiCreditCard, FiExternalLink, FiInfo, FiKey } from 'react-icons/fi';
import api from '../api';
import { apiError, formatDateTime } from '../lib/format';
import { Button, Skeleton } from './Bits';
import Field from './Field';
import Segmented from './Segmented';
import { useFeedback } from './Feedback';

// Connect a Safepay merchant account. Fees go straight to this account (the clinic's, or a solo doctor's).
// path: '/payments/account/doctor' or '/payments/account/clinic/<id>'
const PaymentAccountCard = ({ path, owner = 'your Safepay account' }) => {
  const { toast, confirm } = useFeedback();
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ environment: 'sandbox', publicKey: '', secretKey: '', webhookSecret: '' });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api.get(path).then((r) => {
    setData(r.data);
    const a = r.data.account;
    setForm({ environment: a?.environment || 'sandbox', publicKey: a?.publicKey || '', secretKey: '', webhookSecret: '' });
    setEditing(!a);
  }).catch(() => setData({ account: null }));
  useEffect(() => { load(); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { environment: form.environment, publicKey: form.publicKey.trim() };
      if (form.secretKey.trim()) body.secretKey = form.secretKey.trim();
      if (form.webhookSecret.trim()) body.webhookSecret = form.webhookSecret.trim();
      const { data: res } = await api.put(path, body);
      toast(res.message);
      await load();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!(await confirm({ title: 'Disconnect Safepay?', message: 'Patients will no longer be able to pay online. Payments already made are not affected.', confirmLabel: 'Disconnect', danger: true }))) return;
    try {
      await api.delete(path);
      toast('Safepay disconnected');
      await load();
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  const copy = (text) => navigator.clipboard.writeText(text).then(() => toast('Copied')).catch(() => {});

  if (!data) return <section className="glass card-pad-lg"><Skeleton height={140} /></section>;
  const acc = data.account;

  return (
    <section className="glass card-pad-lg stack gap-16 pay-account">
      <div className="row between wrap gap-12">
        <div className="row gap-12">
          <span className="empty-orb" style={{ width: 44, height: 44 }}><FiCreditCard size={20} /></span>
          <div>
            <h2 className="section-title">Online payments</h2>
            <p className="subtle" style={{ fontSize: 13.5 }}>Patients pay consultation fees by card, JazzCash, Easypaisa or bank through Safepay. The money goes straight into {owner}.</p>
          </div>
        </div>
        {acc && (
          <span className={`badge ${acc.environment === 'production' ? 'badge-green' : 'badge-amber'}`}>
            <FiCheckCircle /> {acc.environment === 'production' ? 'Live' : 'Sandbox (test)'}
          </span>
        )}
      </div>

      <div className="auth-notice" style={{ borderColor: 'var(--border)', background: 'var(--tint-1)' }}>
        <FiInfo /> <span>PakMedRecord charges a <strong>{data.commissionRate ?? 5}% platform fee</strong> on fees patients pay online. Fees reach your Safepay account in full; we email an invoice for the platform fee each month. No fee on cash payments or refunded visits.</span>
      </div>

      {data.clinicAccount && (
        <div className="auth-notice" style={{ borderColor: 'rgba(34,211,238,.35)', background: 'rgba(34,211,238,.07)' }}>
          <FiInfo /> <span>Your fees are paid into <strong>{data.clinicAccount.payee}</strong>&apos;s Safepay account. You only need your own if you also see patients outside the clinic.</span>
        </div>
      )}

      {acc && !editing ? (
        <div className="stack gap-12">
          <div className="summary-row"><span className="k">Public key</span><span className="mono" data-no-translate>{acc.publicKey}</span></div>
          <div className="summary-row"><span className="k">Secret key</span><span className="mono" data-no-translate>{acc.secretKeyHint} <span className="subtle">(encrypted)</span></span></div>
          <div className="summary-row"><span className="k">Payment updates</span><span>{acc.hasWebhookSecret ? 'On' : 'Off (add a webhook secret for instant confirmation)'}</span></div>
          <div className="summary-row"><span className="k">Checked</span><span>{formatDateTime(acc.verifiedAt)}</span></div>
          <div className="row gap-8 wrap">
            <button className="btn" onClick={() => setEditing(true)}><FiKey /> Update keys</button>
            <button className="btn btn-ghost" onClick={disconnect}>Disconnect</button>
          </div>
        </div>
      ) : (
        <form className="stack gap-16" onSubmit={save}>
          <ol className="setup-steps">
            <li>Create a Safepay merchant account at <a href="https://getsafepay.com" target="_blank" rel="noreferrer">getsafepay.com <FiExternalLink size={12} /></a> (start in sandbox to try it).</li>
            <li>In the Safepay dashboard open <strong>Developer → API</strong> and copy the public key and secret key here.</li>
            <li>Optional but recommended: in <strong>Developer → Webhooks</strong> add the address shown after saving, and paste its secret here.</li>
          </ol>
          <div className="field">
            <span className="field-label">Mode</span>
            <Segmented id={`env-${path}`} value={form.environment} onChange={(v) => setForm({ ...form, environment: v })} options={[{ value: 'sandbox', label: 'Sandbox (test)' }, { value: 'production', label: 'Live' }]} />
          </div>
          <Field label="Public key" value={form.publicKey} onChange={(e) => setForm({ ...form, publicKey: e.target.value })} placeholder="From Safepay: Developer → API" autoComplete="off" className="mono-input" />
          <Field label="Secret key" type="password" value={form.secretKey} onChange={(e) => setForm({ ...form, secretKey: e.target.value })} placeholder={acc ? `Saved (${acc.secretKeyHint}). Leave blank to keep` : ''} autoComplete="new-password" hint="Stored encrypted. Never shown again." />
          <Field label="Webhook secret (optional)" type="password" value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })} placeholder={acc?.hasWebhookSecret ? 'Saved. Leave blank to keep' : ''} autoComplete="new-password" />
          <div className="row gap-8 wrap">
            <Button className="btn btn-primary" loading={busy} disabled={!form.publicKey.trim() || (!acc && !form.secretKey.trim())}>{acc ? 'Save keys' : 'Connect Safepay'}</Button>
            {acc && <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); load(); }}>Cancel</button>}
          </div>
          <p className="subtle" style={{ fontSize: 12.5 }}>We check the keys with Safepay before saving. In sandbox mode no real money moves.</p>
        </form>
      )}

      {data.invoices?.length > 0 && (
        <div className="stack gap-8">
          <span className="field-label">Platform fee invoices</span>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Invoice</th><th>Month</th><th>Online fees</th><th>Platform fee</th><th>Status</th></tr></thead>
              <tbody>
                {data.invoices.map((i) => (
                  <tr key={i._id}>
                    <td className="mono">{i.number}</td>
                    <td>{new Date(`${i.period}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })}</td>
                    <td>Rs {i.grossAmount.toLocaleString('en-PK')}</td>
                    <td><strong>Rs {i.commissionAmount.toLocaleString('en-PK')}</strong></td>
                    <td>{i.status === 'paid' ? <span className="badge badge-green">Paid</span> : <span className="badge badge-amber">Due {new Date(i.dueAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {acc && (
        <div className="stack gap-8">
          <span className="field-label">Webhook address for Safepay</span>
          <div className="row gap-8">
            <code className="code-block grow" data-no-translate style={{ margin: 0, whiteSpace: 'nowrap', overflowX: 'auto' }}>{acc.webhookUrl}</code>
            <button className="btn btn-icon" onClick={() => copy(acc.webhookUrl)} aria-label="Copy webhook address"><FiCopy /></button>
          </div>
        </div>
      )}
    </section>
  );
};

export default PaymentAccountCard;
