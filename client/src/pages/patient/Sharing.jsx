import { useState } from 'react';
import { FiAlertTriangle, FiClock, FiCopy, FiCreditCard, FiEye, FiLink, FiPlus, FiRefreshCw, FiShare2, FiSlash } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch } from '../../lib/data';
import { apiError, formatDateTime } from '../../lib/format';
import { downloadEmergencyCard } from '../../lib/pdf';
import { Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import Field from '../../ui/Field';
import Modal from '../../ui/Modal';
import QRCode from '../../ui/QRCode';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const DURATIONS = [[1, '1 hour'], [24, '24 hours'], [72, '3 days'], [168, '7 days']];
const origin = () => window.location.origin;

const copy = async (text, toast) => {
  try {
    await navigator.clipboard.writeText(text);
    toast('Link copied');
  } catch {
    toast('Could not copy', 'error');
  }
};

const EmergencyCard = () => {
  const { profile } = useShell();
  const { toast } = useFeedback();
  const { data, setData } = useFetch(async () => (await api.get('/share/emergency')).data.emergencyAccess, []);
  const url = data?.token ? `${origin()}/e/${data.token}` : null;

  const update = async (body) => {
    try {
      setData((await api.put('/share/emergency', body)).data.emergencyAccess);
      if (body.regenerate) toast('New QR code created. Print a new card; the old one no longer works.');
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  return (
    <section className="glass card-pad-lg stack gap-16">
      <div className="row between wrap gap-12">
        <div className="row gap-12">
          <span className="empty-orb" style={{ width: 44, height: 44, color: 'var(--rose-text)' }}><FiAlertTriangle size={20} /></span>
          <div>
            <h2 className="section-title">Emergency QR card</h2>
            <p className="subtle" style={{ fontSize: 13.5 }}>Paramedics and ER staff scan it to see your blood group, allergies, conditions, medicines and emergency contact. Nothing else.</p>
          </div>
        </div>
        {data && <label className="row gap-8"><span className="subtle" style={{ fontSize: 13 }}>{data.enabled ? 'On' : 'Off'}</span><input type="checkbox" className="switch" checked={Boolean(data.enabled)} onChange={(e) => update({ enabled: e.target.checked })} aria-label="Emergency QR on or off" /></label>}
      </div>
      {data?.enabled && url ? (
        <div className="row gap-20 wrap">
          <QRCode value={url} size={150} label="Emergency QR code" />
          <div className="stack gap-12 grow" style={{ minWidth: 220 }}>
            <p className="muted" style={{ fontSize: 14 }}>Print the wallet card and keep it with your CNIC, or save the QR as your phone&apos;s lock-screen image.</p>
            <div className="row gap-8 wrap">
              <button className="btn btn-primary" onClick={() => downloadEmergencyCard(profile, url)}><FiCreditCard /> Download wallet card</button>
              <a className="btn" href={url} target="_blank" rel="noreferrer"><FiEye /> Preview page</a>
              <button className="btn btn-ghost" onClick={() => update({ regenerate: true })}><FiRefreshCw /> New code</button>
            </div>
            {(!profile?.bloodGroup || !profile?.emergencyContact?.phone) && (
              <p className="subtle" style={{ fontSize: 12.5 }}><FiAlertTriangle size={12} /> Add your blood group and an emergency contact in your health profile so the card is useful.</p>
            )}
          </div>
        </div>
      ) : data && <p className="subtle" style={{ fontSize: 13.5 }}>Turn it on to get your QR code. You can turn it off at any time and the code stops working immediately.</p>}
    </section>
  );
};

const ShareLinks = () => {
  const { toast } = useFeedback();
  const { data, loading, reload } = useFetch(async () => (await api.get('/share')).data, []);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ label: '', hours: 24, includeProfile: true, includeVitals: true });
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const { data: res } = await api.post('/share', form);
      setCreated(`${origin()}/s/${res.token}`);
      setCreating(false);
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (l) => {
    try {
      await api.delete(`/share/${l._id}`);
      toast('Link revoked');
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };
  const active = (l) => !l.revokedAt && new Date(l.expiresAt) > new Date();

  return (
    <section className="glass card-pad-lg stack gap-16">
      <div className="row between wrap gap-12">
        <div className="row gap-12">
          <span className="empty-orb" style={{ width: 44, height: 44 }}><FiShare2 size={20} /></span>
          <div>
            <h2 className="section-title">Share with any doctor</h2>
            <p className="subtle" style={{ fontSize: 13.5 }}>A read-only link to your history for a one-off visit or a second opinion. No account needed, and it expires on its own.</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ label: '', hours: 24, includeProfile: true, includeVitals: true }); setCreating(true); }}><FiPlus /> New link</button>
      </div>
      {loading ? <Skeleton height={100} /> : !data.length ? <EmptyState icon={FiLink} title="No links yet">Create one before your next visit and show the QR code to the doctor.</EmptyState> : (
        <div className="stack gap-8">
          {data.map((l) => (
            <div key={l._id} className={`share-row ${active(l) ? '' : 'inactive'}`}>
              <FiLink />
              <div className="grow" style={{ minWidth: 0 }}>
                <strong className="truncate">{l.label}</strong>
                <div className="subtle" style={{ fontSize: 12.5 }}>
                  {l.revokedAt ? 'Revoked' : active(l) ? <><FiClock size={11} /> Expires {formatDateTime(l.expiresAt)}</> : 'Expired'} · {l.views} view{l.views === 1 ? '' : 's'}{l.lastViewedAt ? `, last ${formatDateTime(l.lastViewedAt)}` : ''}
                </div>
              </div>
              {active(l) && <button className="btn btn-sm btn-ghost" onClick={() => revoke(l)}><FiSlash /> Revoke</button>}
            </div>
          ))}
        </div>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="New share link" subtitle="Anyone with the link can view, so share it only with the doctor." width={500}>
        <div className="stack gap-16">
          <Field label="Who is it for?" placeholder="e.g. Dr. Rehman, Liaquat National" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <div className="field">
            <span className="field-label">Expires after</span>
            <div className="chips">{DURATIONS.map(([h, label]) => <button key={h} type="button" className="chip" aria-pressed={form.hours === h} onClick={() => setForm({ ...form, hours: h })}>{label}</button>)}</div>
          </div>
          <label className="pref-row"><div className="grow">Include health profile (allergies, conditions, medicines)</div><input type="checkbox" className="switch" checked={form.includeProfile} onChange={(e) => setForm({ ...form, includeProfile: e.target.checked })} /></label>
          <label className="pref-row"><div className="grow">Include vitals</div><input type="checkbox" className="switch" checked={form.includeVitals} onChange={(e) => setForm({ ...form, includeVitals: e.target.checked })} /></label>
          <p className="subtle" style={{ fontSize: 12.5 }}>All your verified records and their documents are included.</p>
          <Button className="btn btn-primary btn-block" loading={busy} onClick={create}>Create link</Button>
        </div>
      </Modal>
      <Modal open={Boolean(created)} onClose={() => setCreated(null)} title="Your link is ready" subtitle="The doctor can scan the QR code or open the link." width={460}>
        {created && (
          <div className="stack gap-16" style={{ alignItems: 'center' }}>
            <QRCode value={created} size={200} label="Share link QR code" />
            <code className="code-block" data-no-translate style={{ wordBreak: 'break-all', width: '100%' }}>{created}</code>
            <div className="row gap-8">
              <button className="btn btn-primary" onClick={() => copy(created, toast)}><FiCopy /> Copy link</button>
              {navigator.share && <button className="btn" onClick={() => navigator.share({ title: 'My medical record', url: created }).catch(() => {})}><FiShare2 /> Share</button>}
            </div>
            <p className="subtle" style={{ fontSize: 12.5, textAlign: 'center' }}>For your safety we won&apos;t show this link again. Create a new one if you lose it.</p>
          </div>
        )}
      </Modal>
    </section>
  );
};

const Sharing = () => (
  <>
    <PageHeader eyebrow="Sharing" title="Sharing & emergency" subtitle="Give a doctor temporary access to your history, and make sure emergency responders can see what matters." />
    <div className="stack gap-20" style={{ maxWidth: 900 }}>
      <EmergencyCard />
      <ShareLinks />
    </div>
  </>
);

export default Sharing;
