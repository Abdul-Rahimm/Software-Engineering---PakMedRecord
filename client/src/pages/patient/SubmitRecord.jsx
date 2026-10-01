import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiClock, FiSend, FiUploadCloud, FiUserCheck, FiUserPlus } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch, fetchCareTeam } from '../../lib/data';
import { apiError, doctorName } from '../../lib/format';
import { Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import Field from '../../ui/Field';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const TEMPLATES = {
  'Lab result': 'Test: \nDate: \nResult: \nReference range: \nLab: ',
  Prescription: 'Medicine: \nDose: \nFrequency: \nDuration: \nPrescribed by: ',
  Vaccination: 'Vaccine: \nDose number: \nDate given: \nCentre: ',
  Allergy: 'Allergen: \nReaction: \nSeverity: \nFirst noticed: ',
  'Past surgery': 'Procedure: \nDate: \nHospital: \nNotes: ',
};

const FLOW = [
  { icon: FiSend, title: 'You submit', text: 'Your record goes to the doctor you choose.' },
  { icon: FiClock, title: 'Doctor reviews', text: 'It waits in their review queue.' },
  { icon: FiCheckCircle, title: 'Added to history', text: 'Once approved, it joins your permanent record.' },
];

const SubmitRecord = () => {
  const { cnic } = useShell();
  const { toast } = useFeedback();
  const [doctor, setDoctor] = useState('');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: team, loading } = useFetch(() => fetchCareTeam(cnic), [cnic]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/tempRecords/submit/${cnic}`, { doctorCNIC: Number(doctor), recordData: text.trim() });
      toast('Sent for review. You’ll see it in your records once approved.');
      setText('');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Verification" title="Submit a record" subtitle="Add a past report, prescription or test result. Your doctor verifies it before it joins your history." />

      <div className="grid grid-3" style={{ marginBottom: 24 }}>
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
        <form className="glass card-pad-lg stack gap-20" onSubmit={submit}>
          <Field as="select" label="Reviewing doctor" icon={FiUserCheck} value={doctor} onChange={(e) => setDoctor(e.target.value)} required>
            <option value="" disabled>Choose a doctor from your care team</option>
            {team.map((d) => <option key={d.doctorCNIC} value={d.doctorCNIC}>{doctorName(d)} · {d.hospital}</option>)}
          </Field>

          <div className="field">
            <span className="field-label">Start from a template</span>
            <div className="chips">
              {Object.keys(TEMPLATES).map((t) => (
                <button key={t} type="button" className="chip" style={{ fontFamily: 'var(--font)' }} onClick={() => setText(TEMPLATES[t])}>{t}</button>
              ))}
            </div>
          </div>

          <Field as="textarea" label="Record details" hint={`${text.length} characters`} value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe the report: test names, results, dates, medicines…" style={{ minHeight: 200, fontFamily: text.includes(': \n') ? 'var(--font-mono)' : undefined }} required />

          <div className="row between wrap gap-12">
            <span className="subtle" style={{ fontSize: 13 }}>Submitted records stay pending until approved.</span>
            <Button className="btn btn-primary btn-lg" loading={saving} disabled={!doctor || !text.trim()}><FiUploadCloud /> Submit for review</Button>
          </div>
        </form>
      )}
    </>
  );
};

export default SubmitRecord;
