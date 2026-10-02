import { useRef, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiClock, FiUploadCloud } from 'react-icons/fi';
import { getSession } from '../session';
import { formatDate } from '../lib/format';
import { Button } from './Bits';
import { useFeedback } from './Feedback';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// Doctor uploads their PMDC certificate and registration number for admin review
const VerificationCard = ({ doctor, onChange }) => {
  const { toast } = useFeedback();
  const [pmdc, setPmdc] = useState(doctor?.verification?.pmdcNumber || '');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const v = doctor?.verification || {};
  const status = v.status || 'verified';

  const submit = async () => {
    if (file.size > 4 * 1024 * 1024) return toast('File is larger than 4 MB', 'error');
    setBusy(true);
    try {
      const res = await fetch(`${BASE}/doctor/${doctor.doctorCNIC}/verification`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getSession()?.token}`, 'Content-Type': file.type || 'application/octet-stream', 'X-PMDC-Number': pmdc.trim(), 'X-File-Name': encodeURIComponent(file.name) },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      toast(data.message);
      setFile(null);
      onChange?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'verified') {
    return (
      <section className="glass card-pad row gap-12 verify-card verified">
        <FiCheckCircle size={22} />
        <div><strong>PMDC verified</strong><div className="subtle" style={{ fontSize: 13 }}>{v.pmdcNumber ? `Registration ${v.pmdcNumber}` : 'Your account is verified'}{v.reviewedAt ? ` · ${formatDate(v.reviewedAt)}` : ''}</div></div>
      </section>
    );
  }

  return (
    <section className={`glass card-pad-lg stack gap-16 verify-card ${status}`}>
      <div className="row gap-12">
        {status === 'pending' ? <FiClock size={22} /> : <FiAlertTriangle size={22} />}
        <div>
          <h2 className="section-title">{status === 'pending' ? 'Verification in review' : status === 'rejected' ? 'Verification needs attention' : 'Verify your PMDC registration'}</h2>
          <p className="subtle" style={{ fontSize: 13.5 }}>
            {status === 'pending'
              ? `Submitted ${formatDate(v.submittedAt)}. We usually verify within one working day; you'll get an email and a notification.`
              : 'Patients can add you to their care team and you can see their records only after we check your PMDC registration.'}
          </p>
        </div>
      </div>
      {status === 'rejected' && v.note && <div className="auth-notice"><FiAlertTriangle /> <span>{v.note}</span></div>}
      {status !== 'pending' && (
        <div className="stack gap-12">
          <label className="field"><span className="field-label">PMDC registration number</span><input className="input mono" value={pmdc} onChange={(e) => setPmdc(e.target.value)} placeholder="e.g. 12345-P" /></label>
          <div className="row gap-12 wrap">
            <button type="button" className="btn" onClick={() => input.current?.click()}><FiUploadCloud /> {file ? file.name : 'Upload PMDC certificate'}</button>
            <span className="subtle" style={{ fontSize: 12.5 }}>PDF or photo, up to 4 MB</span>
            <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <Button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!file || pmdc.trim().length < 3} loading={busy} onClick={submit}>Submit for verification</Button>
        </div>
      )}
    </section>
  );
};

export default VerificationCard;
