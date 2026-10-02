import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiClock, FiSend, FiTag, FiType, FiUploadCloud, FiUserCheck, FiUserPlus, FiXCircle, FiZap } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchCareTeam, indexBy } from '../../lib/data';
import { apiError, doctorName, formatDate } from '../../lib/format';
import { RECORD_CATEGORIES } from '../../lib/constants';
import { Button, EmptyState, PageHeader, Skeleton, StatusBadge } from '../../ui/Bits';
import Field from '../../ui/Field';
import { useFeedback } from '../../ui/Feedback';
import Uploader from '../../ui/Uploader';
import { AttachmentChips } from '../../ui/Attachments';
import '../dashboard.css';

const TEMPLATE_CATEGORY = { 'Lab result': 'Lab result', Prescription: 'Prescription', Vaccination: 'Vaccination', Allergy: 'Allergy', 'Past surgery': 'Surgery' };

const TEMPLATES = {
  'Lab result': 'Test: \nDate: \nResult: \nReference range: \nLab: ',
  Prescription: 'Medicine: \nDose: \nFrequency: \nDuration: \nPrescribed by: ',
  Vaccination: 'Vaccine: \nDose number: \nDate given: \nCentre: ',
  Allergy: 'Allergen: \nReaction: \nSeverity: \nFirst noticed: ',
  'Past surgery': 'Procedure: \nDate: \nHospital: \nNotes: ',
};

const FLOW = [
  { icon: FiUploadCloud, title: 'Upload or type', text: 'Add a photo or PDF. AI reads it and fills in the details.' },
  { icon: FiSend, title: 'You submit', text: 'Your record goes to the doctor you choose.' },
  { icon: FiClock, title: 'Doctor reviews', text: 'It waits in their review queue.' },
  { icon: FiCheckCircle, title: 'Added to history', text: 'Once approved, it joins your record with the original file.' },
];

const SubmitRecord = () => {
  const { cnic } = useShell();
  const { toast } = useFeedback();
  const [doctor, setDoctor] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [saving, setSaving] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [touched, setTouched] = useState({}); // fields the user edited: don't overwrite them with AI suggestions
  const [formKey, setFormKey] = useState(0);
  const { data: team, loading } = useFetch(() => fetchCareTeam(cnic), [cnic]);
  const { data: submissions, reload: reloadSubs } = useFetch(
    async () => (await api.get(`/tempRecords/mine/${cnic}`)).data.submissions,
    [cnic]
  );
  const doctorsById = indexBy(team, 'doctorCNIC');

  const readFiles = uploads.filter((u) => u.phase === 'done');
  const usableFiles = uploads.filter((u) => u.attachment && (u.phase === 'done' || u.phase === 'unread'));
  const busy = uploads.some((u) => u.phase === 'uploading' || u.phase === 'reading');

  // Pre-fill the form from what the AI read, unless the user already typed there
  useEffect(() => {
    if (!readFiles.length) return;
    const first = readFiles[0].attachment.ocr;
    if (!touched.title && first.title) setTitle(first.title);
    if (!touched.category && first.category) setCategory(first.category);
    if (!touched.text) {
      setText(readFiles.length === 1
        ? first.summary
        : readFiles.map((u) => `${u.attachment.ocr.title || u.name}: ${u.attachment.ocr.summary}`).join('\n\n'));
    }
  }, [readFiles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const onUploads = useCallback((items) => setUploads(items), []);
  const edit = (key, setter) => (e) => { setter(e.target.value); setTouched((t) => ({ ...t, [key]: true })); };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/tempRecords/submit/${cnic}`, {
        doctorCNIC: Number(doctor), recordData: text.trim(), title: title.trim(), category,
        attachments: usableFiles.map((u) => u.attachment._id),
      });
      toast('Sent for review. You’ll be notified when your doctor responds.');
      setText('');
      setTitle('');
      setCategory('General');
      setTouched({});
      setFormKey((k) => k + 1); // fresh uploader
      reloadSubs(true);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Verification" title="Submit a record" subtitle="Add a past report, prescription or test result. Your doctor verifies it before it joins your history." />

      <div className="grid grid-4" style={{ marginBottom: 24 }}>
        {FLOW.map((f, i) => (
          <motion.div key={f.title} className="glass card-pad row gap-16" initial={{ opacity: 0, y: 20, rotateX: -20 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: i * 0.1 }}>
            <span className="stat-icon"><f.icon size={18} /></span>
            <div>
              <div style={{ fontWeight: 600 }}><span className="mono subtle" style={{ marginRight: 8 }}>0{i + 1}</span>{f.title}</div>
              <div className="subtle" style={{ fontSize: 13.5 }}>{f.text}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {loading ? (
        <Skeleton height={360} />
      ) : team.length === 0 ? (
        <div className="glass">
          <EmptyState icon={FiUserPlus} title="Add a doctor first" action={<Link to="/doctor/doctors" className="btn btn-primary">Find doctors</Link>}>
            Records are reviewed by a doctor in your care team.
          </EmptyState>
        </div>
      ) : (
        <form className="glass card-pad-lg stack gap-24" onSubmit={submit} key={formKey}>
          <section className="stack gap-12">
            <div className="step-head"><span className="step-num">1</span><div><h2 className="section-title">Upload the document</h2><p className="subtle" style={{ fontSize: 13.5 }}>Optional. A photo of a prescription or a lab report PDF works. AI reads it and fills in step 2.</p></div></div>
            <Uploader patientCNIC={cnic} onChange={onUploads} />
          </section>

          <section className="stack gap-16">
            <div className="step-head">
              <span className="step-num">2</span>
              <div className="grow"><h2 className="section-title">Check the details</h2><p className="subtle" style={{ fontSize: 13.5 }}>{readFiles.length ? 'Filled in from your document. Edit anything that looks wrong.' : 'Describe the record, or upload a file above.'}</p></div>
              {readFiles.length > 0 && <span className="ai-badge"><FiZap size={11} /> AI filled</span>}
            </div>
            <div className="grid grid-2" style={{ gap: 16 }}>
              <Field label="Title" icon={FiType} value={title} onChange={edit('title', setTitle)} maxLength={120} placeholder="e.g. HbA1c test, March 2026" />
              <Field as="select" label="Category" icon={FiTag} value={category} onChange={edit('category', setCategory)}>
                {RECORD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Field>
            </div>
            <Field as="textarea" label="Record details" hint={usableFiles.length ? 'The full text of each file is saved with the record too.' : `${text.length} characters`} value={text} onChange={edit('text', setText)} placeholder="Test names and results, medicines and doses, dates…" style={{ minHeight: 150, fontFamily: text.includes(': \n') ? 'var(--font-mono)' : undefined }} />
            {!usableFiles.length && (
              <div className="field">
                <span className="field-label">No file? Start from a template</span>
                <div className="chips">
                  {Object.keys(TEMPLATES).map((t) => (
                    <button key={t} type="button" className="chip" style={{ fontFamily: 'var(--font)' }} onClick={() => { setText(TEMPLATES[t]); setCategory(TEMPLATE_CATEGORY[t]); setTouched({ text: true, category: true }); }}>{t}</button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="stack gap-16">
            <div className="step-head"><span className="step-num">3</span><div><h2 className="section-title">Send to your doctor</h2><p className="subtle" style={{ fontSize: 13.5 }}>They review it before it joins your permanent record.</p></div></div>
            <Field as="select" label="Reviewing doctor" icon={FiUserCheck} value={doctor} onChange={(e) => setDoctor(e.target.value)} required>
              <option value="" disabled>Choose a doctor from your care team</option>
              {team.map((d) => <option key={d.doctorCNIC} value={d.doctorCNIC}>{doctorName(d)} · {d.hospital}</option>)}
            </Field>
            <div className="row between wrap gap-12">
              <span className="subtle" style={{ fontSize: 13 }}>
                {busy ? 'Waiting for your files to finish…' : usableFiles.length ? `${usableFiles.length} file${usableFiles.length > 1 ? 's' : ''} attached` : 'Submitted records stay pending until approved.'}
              </span>
              <Button className="btn btn-primary btn-lg" loading={saving} disabled={!doctor || busy || (!text.trim() && !usableFiles.length)}><FiSend /> Submit for review</Button>
            </div>
          </section>
        </form>
      )}

      {submissions?.length > 0 && (
        <section className="glass card-pad stack gap-12" style={{ marginTop: 24 }}>
          <h2 className="section-title">My submissions</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Submitted</th><th>Record</th><th>Files</th><th>Doctor</th><th>Status</th></tr></thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s._id}>
                    <td className="subtle" style={{ whiteSpace: 'nowrap' }}>{formatDate(s.createdAt)}</td>
                    <td style={{ maxWidth: 340 }}>
                      <div style={{ fontWeight: 600 }} className="truncate">{s.title || s.recordData}</div>
                      <div className="subtle" style={{ fontSize: 12.5 }}>{s.category}</div>
                      {s.status === 'rejected' && s.reviewNote && (
                        <div className="row gap-8" style={{ fontSize: 12.5, color: 'var(--rose-text)', marginTop: 4 }}><FiXCircle /> {s.reviewNote}</div>
                      )}
                    </td>
                    <td style={{ maxWidth: 260 }}>{s.attachments?.length ? <AttachmentChips attachments={s.attachments} /> : <span className="subtle">—</span>}</td>
                    <td className="subtle">{doctorName(doctorsById[s.doctorCNIC])}</td>
                    <td>
                      <span className="row gap-8">
                        {s.status === 'pending' && <FiClock style={{ color: 'var(--amber)' }} />}
                        {s.status === 'approved' && <FiCheckCircle style={{ color: 'var(--emerald)' }} />}
                        <StatusBadge status={s.status} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
};

export default SubmitRecord;
