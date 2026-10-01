import { useEffect, useState } from 'react';
import { FiFilePlus, FiUser } from 'react-icons/fi';
import api from '../../api';
import { apiError, formatCNIC } from '../../lib/format';
import { Button } from '../../ui/Bits';
import Field from '../../ui/Field';
import Modal from '../../ui/Modal';
import { useFeedback } from '../../ui/Feedback';

// Doctor writes a record straight into an affiliated patient's history
const AddRecordModal = ({ open, onClose, patients, defaultPatient, onCreated }) => {
  const { toast } = useFeedback();
  const [patient, setPatient] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPatient(defaultPatient ? String(defaultPatient) : '');
      setText('');
    }
  }, [open, defaultPatient]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/record/create', { patientCNIC: Number(patient), recordData: text.trim() });
      toast('Record added to patient history');
      onCreated?.(data.medicalRecord);
      onClose();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New medical record" subtitle="Added directly to the patient's verified history." width={600}>
      <form className="stack gap-16" onSubmit={submit}>
        <Field as="select" label="Patient" icon={FiUser} value={patient} onChange={(e) => setPatient(e.target.value)} required disabled={Boolean(defaultPatient)}>
          <option value="" disabled>Select a patient</option>
          {patients.map((p) => (
            <option key={p.patientCNIC} value={p.patientCNIC}>{p.firstName} {p.lastName} · {formatCNIC(p.patientCNIC)}</option>
          ))}
        </Field>
        <Field as="textarea" label="Clinical notes" value={text} onChange={(e) => setText(e.target.value)} placeholder="Diagnosis, findings, prescriptions, follow-up…" style={{ minHeight: 180 }} required />
        <div className="row gap-12" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <Button className="btn btn-primary" loading={saving} disabled={!patient || !text.trim()}><FiFilePlus /> Add record</Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddRecordModal;
