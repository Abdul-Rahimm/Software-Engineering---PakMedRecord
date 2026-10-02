import { useCallback, useEffect, useState } from 'react';
import { FiFilePlus, FiTag, FiType, FiUser } from 'react-icons/fi';
import api from '../../api';
import { apiError, formatCNIC } from '../../lib/format';
import { RECORD_CATEGORIES } from '../../lib/constants';
import { Button } from '../../ui/Bits';
import Field from '../../ui/Field';
import Modal from '../../ui/Modal';
import { useFeedback } from '../../ui/Feedback';
import Uploader from '../../ui/Uploader';

// Doctor writes a record straight into an affiliated patient's history
const AddRecordModal = ({ open, onClose, patients, defaultPatient, onCreated }) => {
  const { toast } = useFeedback();
  const [patient, setPatient] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Diagnosis');
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState([]);
  const onUploads = useCallback((items) => setUploads(items), []);
  const usableFiles = uploads.filter((u) => u.attachment && (u.phase === 'done' || u.phase === 'unread'));
  const busy = uploads.some((u) => u.phase === 'uploading' || u.phase === 'reading');

  // Use the AI reading of the first file to fill empty fields
  useEffect(() => {
    const first = uploads.find((u) => u.phase === 'done')?.attachment?.ocr;
    if (!first) return;
    setTitle((t) => t || first.title);
    if (first.category) setCategory((c) => (c === 'Diagnosis' ? first.category : c));
  }, [uploads]);

  useEffect(() => {
    if (open) {
      setPatient(defaultPatient ? String(defaultPatient) : '');
      setText('');
      setTitle('');
      setCategory('Diagnosis');
      setUploads([]);
    }
  }, [open, defaultPatient]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post('/record/create', { patientCNIC: Number(patient), recordData: text.trim(), title: title.trim(), category, attachments: usableFiles.map((u) => u.attachment._id) });
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
        <div className="grid grid-2" style={{ gap: 14 }}>
          <Field label="Title" icon={FiType} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. Hypertension review" />
          <Field as="select" label="Category" icon={FiTag} value={category} onChange={(e) => setCategory(e.target.value)}>
            {RECORD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Field>
        </div>
        <Field as="textarea" label="Clinical notes" value={text} onChange={(e) => setText(e.target.value)} placeholder={usableFiles.length ? 'Optional: the attached files are saved with their extracted text' : 'Diagnosis, findings, prescriptions, follow-up…'} style={{ minHeight: 140 }} />
        {patient ? (
          <div className="field">
            <span className="field-label">Attach reports or scans (optional)</span>
            <Uploader key={`${open}-${patient}`} patientCNIC={patient} onChange={onUploads} compact />
          </div>
        ) : (
          <p className="subtle" style={{ fontSize: 13 }}>Select a patient to attach files.</p>
        )}
        <div className="row gap-12" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <Button className="btn btn-primary" loading={saving} disabled={!patient || busy || (!text.trim() && !usableFiles.length)}><FiFilePlus /> Add record</Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddRecordModal;
