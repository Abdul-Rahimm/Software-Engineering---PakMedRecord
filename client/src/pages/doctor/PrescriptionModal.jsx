import { useEffect, useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiDownload, FiPlus, FiShield, FiTrash2 } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { apiError } from '../../lib/format';
import { downloadPrescriptionPDF } from '../../lib/pdf';
import { Button, Spinner } from '../../ui/Bits';
import Field from '../../ui/Field';
import Modal from '../../ui/Modal';
import { useFeedback } from '../../ui/Feedback';

const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'At bedtime', 'As needed'];
const blank = () => ({ name: '', dose: '', frequency: 'Once daily', durationDays: '', instructions: '' });
const SEVERITY = { high: 'badge-rose', moderate: 'badge-amber', low: 'badge-cyan' };

// Structured e-prescription with allergy and interaction checks before it's issued
const PrescriptionModal = ({ open, onClose, patient, onCreated }) => {
  const { profile: doctor } = useShell();
  const { toast } = useFeedback();
  const [diagnosis, setDiagnosis] = useState('');
  const [items, setItems] = useState([blank()]);
  const [notes, setNotes] = useState('');
  const [check, setCheck] = useState(null); // { warnings, aiChecked } | 'loading'
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState(null);

  useEffect(() => {
    if (open) {
      setDiagnosis('');
      setItems([blank()]);
      setNotes('');
      setCheck(null);
      setIssued(null);
    }
  }, [open]);

  const valid = items.filter((i) => i.name.trim());
  const update = (n, patch) => {
    setItems((l) => l.map((x, i) => (i === n ? { ...x, ...patch } : x)));
    setCheck(null);
  };

  const runCheck = async () => {
    setCheck('loading');
    try {
      setCheck((await api.post('/prescriptions/check', { patientCNIC: patient.patientCNIC, items: valid })).data);
    } catch (err) {
      setCheck(null);
      toast(apiError(err), 'error');
    }
  };

  const issue = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/prescriptions', { patientCNIC: patient.patientCNIC, diagnosis, items: valid, notes });
      setIssued(data.prescription);
      onCreated?.(data);
      window.dispatchEvent(new Event('pakmed:prescriptions'));
      toast('Prescription issued. The patient was notified and their medicine list updated.');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (issued) {
    return (
      <Modal open={open} onClose={onClose} title="Prescription issued" width={480}>
        <div className="stack gap-16" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="inbox-orb"><FiCheckCircle size={30} /></div>
          <p className="muted">Code <strong className="mono">{issued.code}</strong>. Pharmacies can verify it by scanning the QR on the PDF.</p>
          <div className="row gap-8">
            <button className="btn btn-primary" onClick={() => downloadPrescriptionPDF({ prescription: issued, doctor, patient })}><FiDownload /> Download PDF</button>
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Write prescription" subtitle={patient && `${patient.firstName} ${patient.lastName}${patient.allergies?.length ? ` · Allergies: ${patient.allergies.join(', ')}` : ''}`} width={820}>
      <div className="stack gap-16">
        <Field label="Diagnosis" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Essential hypertension" />
        <div className="stack gap-12">
          {items.map((it, n) => (
            <div key={n} className="rx-item-edit">
              <input className="input" placeholder="Medicine" value={it.name} onChange={(e) => update(n, { name: e.target.value })} aria-label="Medicine" />
              <input className="input" placeholder="Dose (e.g. 5mg)" value={it.dose} onChange={(e) => update(n, { dose: e.target.value })} aria-label="Dose" />
              <select className="select" value={it.frequency} onChange={(e) => update(n, { frequency: e.target.value })} aria-label="Frequency">
                {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
              </select>
              <input className="input" type="number" min="0" max="365" placeholder="Days" value={it.durationDays} onChange={(e) => update(n, { durationDays: e.target.value })} aria-label="Duration in days" />
              <input className="input rx-instr" placeholder="Instructions (e.g. after meals)" value={it.instructions} onChange={(e) => update(n, { instructions: e.target.value })} aria-label="Instructions" />
              <button className="btn btn-ghost btn-icon" onClick={() => setItems((l) => (l.length > 1 ? l.filter((_, i) => i !== n) : [blank()]))} aria-label="Remove medicine"><FiTrash2 /></button>
            </div>
          ))}
          {items.length < 20 && <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setItems((l) => [...l, blank()])}><FiPlus /> Add medicine</button>}
        </div>
        <Field as="textarea" label="Notes for the patient (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 70 }} placeholder="e.g. Review in 4 weeks with BP readings" />

        {check === 'loading' && <div className="row gap-8 subtle"><Spinner /> Checking allergies and interactions…</div>}
        {check && check !== 'loading' && (
          <div className="stack gap-8">
            {!check.warnings.length ? (
              <div className="feed-item"><FiCheckCircle color="var(--emerald)" /> No allergy or interaction issues found{check.aiChecked ? '' : ' (AI interaction check unavailable; allergies and duplicates checked)'}.</div>
            ) : check.warnings.map((w, i) => (
              <div key={i} className="rx-warning">
                <FiAlertTriangle />
                <div className="grow"><span className={`badge badge-plain ${SEVERITY[w.severity]}`}>{w.severity}</span> <strong>{w.medicine}</strong>: {w.message}{w.source === 'ai' && <span className="subtle" style={{ fontSize: 12 }}> · AI</span>}</div>
              </div>
            ))}
            <p className="subtle" style={{ fontSize: 12 }}>Checks support your judgement; they are not exhaustive.</p>
          </div>
        )}

        <div className="row gap-12 wrap" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={runCheck} disabled={!valid.length || check === 'loading'}><FiShield /> Check safety</button>
          <Button className="btn btn-primary" loading={busy} disabled={!valid.length} onClick={issue}>
            {check?.warnings?.some((w) => w.severity === 'high') ? 'Issue anyway' : 'Issue prescription'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PrescriptionModal;
