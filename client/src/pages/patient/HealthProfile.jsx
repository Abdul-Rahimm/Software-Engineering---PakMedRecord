import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiAlertTriangle, FiCreditCard, FiDroplet, FiHeart, FiPhone, FiPlus, FiSave, FiShield, FiTrash2, FiUser, FiUsers,
} from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { apiError } from '../../lib/format';
import { BLOOD_GROUPS } from '../../lib/constants';
import { downloadEmergencyCard } from '../../lib/pdf';
import { Button, PageHeader, Skeleton } from '../../ui/Bits';
import Field from '../../ui/Field';
import TagInput from '../../ui/TagInput';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const COMMON_ALLERGIES = ['Penicillin', 'Sulfa drugs', 'Aspirin', 'Peanuts', 'Dust', 'Pollen', 'Latex', 'Shellfish'];
const COMMON_CONDITIONS = ['Hypertension', 'Type 2 diabetes', 'Asthma', 'Hypothyroidism', 'Anaemia', 'Migraine'];
const COMMON_FAMILY = ['Diabetes', 'Heart disease', 'Hypertension', 'Stroke', 'Cancer', 'Asthma'];

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

const fromProfile = (p) => ({
  bloodGroup: p?.bloodGroup || '',
  dateOfBirth: toDateInput(p?.dateOfBirth),
  heightCm: p?.heightCm ?? '',
  weightKg: p?.weightKg ?? '',
  allergies: p?.allergies || [],
  chronicConditions: p?.chronicConditions || [],
  familyHistory: p?.familyHistory || [],
  medications: (p?.medications || []).map((m) => ({ ...m })),
  vaccinations: (p?.vaccinations || []).map((v) => ({ ...v, date: toDateInput(v.date) })),
  emergencyContact: { name: '', relation: '', phone: '', ...(p?.emergencyContact || {}) },
});

const bmiInfo = (h, w) => {
  if (!h || !w) return null;
  const bmi = w / (h / 100) ** 2;
  // WHO Asian cut-offs
  const label = bmi < 18.5 ? 'Underweight' : bmi < 23 ? 'Healthy' : bmi < 27.5 ? 'Overweight' : 'Obese';
  return { bmi: bmi.toFixed(1), label };
};

const Section = ({ icon: Icon, title, hint, children, delay = 0 }) => (
  <motion.section className="glass card-pad-lg stack gap-20" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
    <div className="row gap-12">
      <span className="stat-icon" style={{ width: 38, height: 38 }}><Icon size={17} /></span>
      <div>
        <h2 className="section-title">{title}</h2>
        {hint && <p className="subtle" style={{ fontSize: 13 }}>{hint}</p>}
      </div>
    </div>
    {children}
  </motion.section>
);

const HealthProfile = () => {
  const { cnic, profile, reloadProfile } = useShell();
  const { toast } = useFeedback();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (profile && !dirty) setForm(fromProfile(profile));
  }, [profile, dirty]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };
  const bmi = useMemo(() => form && bmiInfo(Number(form.heightCm), Number(form.weightKg)), [form]);
  const age = form?.dateOfBirth ? Math.floor((Date.now() - new Date(form.dateOfBirth)) / 3.15576e10) : null;

  const listUpdate = (key, i, patch) => set(key, form[key].map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const listRemove = (key, i) => set(key, form[key].filter((_, j) => j !== i));

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      await api.put(`/patient/${cnic}/health`, form);
      await reloadProfile();
      setDirty(false);
      toast('Health profile saved');
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return <><PageHeader eyebrow="Medical" title="Health profile" /><div className="stack gap-20"><Skeleton height={220} /><Skeleton height={220} /></div></>;
  }

  return (
    <form onSubmit={save}>
      <PageHeader
        eyebrow="Medical"
        title="Health profile"
        subtitle="The essentials every doctor should know. Your care team sees this, and it powers your emergency card."
        actions={
          <>
            <button type="button" className="btn" onClick={() => profile && downloadEmergencyCard({ ...profile, ...form })}><FiCreditCard /> Emergency card</button>
            <Button className="btn btn-primary" loading={saving} disabled={!dirty}><FiSave /> Save changes</Button>
          </>
        }
      />

      <div className="stack gap-20">
        <Section icon={FiDroplet} title="Vitals at a glance">
          <div className="grid grid-4" style={{ gap: 16 }}>
            <Field as="select" label="Blood group" value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}>
              <option value="">Unknown</option>
              {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Field>
            <Field label="Date of birth" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} hint={age != null ? `${age} years old` : undefined} />
            <Field label="Height (cm)" type="number" min="30" max="260" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} />
            <Field label="Weight (kg)" type="number" min="1" max="400" step="0.1" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} hint={bmi ? `BMI ${bmi.bmi} · ${bmi.label}` : undefined} />
          </div>
        </Section>

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Section icon={FiAlertTriangle} title="Allergies" hint="Medicines, foods or anything else you react to." delay={0.05}>
            <TagInput value={form.allergies} onChange={(v) => set('allergies', v)} placeholder="Type an allergy and press Enter" suggestions={COMMON_ALLERGIES} />
          </Section>
          <Section icon={FiHeart} title="Chronic conditions" hint="Long-term conditions you're managing." delay={0.08}>
            <TagInput value={form.chronicConditions} onChange={(v) => set('chronicConditions', v)} placeholder="e.g. Hypertension" suggestions={COMMON_CONDITIONS} />
          </Section>
        </div>

        <Section icon={FiPlus} title="Current medications" hint="What you take regularly, including supplements." delay={0.1}>
          <div className="stack gap-12">
            {form.medications.length === 0 && <p className="subtle" style={{ fontSize: 14 }}>No medications added.</p>}
            {form.medications.map((m, i) => (
              <div key={i} className="med-row">
                <input className="input" placeholder="Medicine" value={m.name} onChange={(e) => listUpdate('medications', i, { name: e.target.value })} aria-label="Medicine name" />
                <input className="input" placeholder="Dose (e.g. 500mg)" value={m.dose || ''} onChange={(e) => listUpdate('medications', i, { dose: e.target.value })} aria-label="Dose" />
                <input className="input" placeholder="How often" value={m.frequency || ''} onChange={(e) => listUpdate('medications', i, { frequency: e.target.value })} aria-label="Frequency" />
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => listRemove('medications', i)} aria-label="Remove medication"><FiTrash2 /></button>
              </div>
            ))}
            <div><button type="button" className="btn btn-sm" onClick={() => set('medications', [...form.medications, { name: '', dose: '', frequency: '' }])}><FiPlus /> Add medication</button></div>
          </div>
        </Section>

        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <Section icon={FiShield} title="Vaccinations" hint="Including childhood vaccines like polio and boosters." delay={0.12}>
            <div className="stack gap-12">
              {form.vaccinations.length === 0 && <p className="subtle" style={{ fontSize: 14 }}>No vaccinations added.</p>}
              {form.vaccinations.map((v, i) => (
                <div key={i} className="med-row vac">
                  <input className="input" placeholder="Vaccine" value={v.name} onChange={(e) => listUpdate('vaccinations', i, { name: e.target.value })} aria-label="Vaccine" />
                  <input className="input" placeholder="Dose" value={v.dose || ''} onChange={(e) => listUpdate('vaccinations', i, { dose: e.target.value })} aria-label="Dose" />
                  <input className="input" type="date" value={v.date || ''} max={new Date().toISOString().slice(0, 10)} onChange={(e) => listUpdate('vaccinations', i, { date: e.target.value })} aria-label="Date given" />
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => listRemove('vaccinations', i)} aria-label="Remove vaccination"><FiTrash2 /></button>
                </div>
              ))}
              <div><button type="button" className="btn btn-sm" onClick={() => set('vaccinations', [...form.vaccinations, { name: '', dose: '', date: '' }])}><FiPlus /> Add vaccination</button></div>
            </div>
          </Section>
          <Section icon={FiUsers} title="Family history" hint="Conditions in parents, siblings or grandparents." delay={0.14}>
            <TagInput value={form.familyHistory} onChange={(v) => set('familyHistory', v)} placeholder="e.g. Diabetes (father)" suggestions={COMMON_FAMILY} />
          </Section>
        </div>

        <Section icon={FiPhone} title="Emergency contact" hint="Shown on your emergency card." delay={0.16}>
          <div className="grid grid-3" style={{ gap: 16 }}>
            <Field label="Name" icon={FiUser} value={form.emergencyContact.name} onChange={(e) => set('emergencyContact', { ...form.emergencyContact, name: e.target.value })} />
            <Field label="Relation" value={form.emergencyContact.relation} onChange={(e) => set('emergencyContact', { ...form.emergencyContact, relation: e.target.value })} placeholder="e.g. Sister" />
            <Field label="Phone" icon={FiPhone} type="tel" value={form.emergencyContact.phone} onChange={(e) => set('emergencyContact', { ...form.emergencyContact, phone: e.target.value })} placeholder="03xx-xxxxxxx" />
          </div>
        </Section>
      </div>

      {dirty && (
        <motion.div className="glass action-bar" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <span className="muted">You have unsaved changes</span>
          <div className="row gap-8">
            <button type="button" className="btn btn-ghost" onClick={() => { setDirty(false); setForm(fromProfile(profile)); }}>Discard</button>
            <Button className="btn btn-primary" loading={saving}><FiSave /> Save</Button>
          </div>
        </motion.div>
      )}
    </form>
  );
};

export default HealthProfile;
