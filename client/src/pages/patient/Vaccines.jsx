import { useState } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiClock, FiShield } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch } from '../../lib/data';
import { apiError, formatDate } from '../../lib/format';
import { Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import Modal from '../../ui/Modal';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

const STATUS = {
  given: { cls: 'badge-green', label: 'Given', icon: FiCheckCircle },
  due: { cls: 'badge-amber', label: 'Due now', icon: FiClock },
  overdue: { cls: 'badge-rose', label: 'Overdue', icon: FiAlertTriangle },
  upcoming: { cls: '', label: 'Upcoming', icon: FiClock },
};

// Pakistan EPI childhood schedule, grouped by age; also used inside the doctor's patient view
export const VaccineSchedule = ({ cnic, canEdit = true }) => {
  const { toast } = useFeedback();
  const { data, loading, setData } = useFetch(async () => (await api.get(`/vaccines/${cnic}`)).data, [cnic]);
  const [marking, setMarking] = useState(null);
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <Skeleton height={240} />;
  if (!data.applicable) {
    return (
      <EmptyState icon={FiShield} title={data.reason === 'no-dob' ? 'Add a date of birth' : 'Childhood schedule complete'}>
        {data.reason === 'no-dob' ? 'Add the date of birth in the health profile to see the vaccination schedule.' : 'The EPI schedule covers children under 6. Adult vaccinations are listed in the health profile.'}
      </EmptyState>
    );
  }

  const save = async () => {
    setBusy(true);
    try {
      setData({ ...data, ...(await api.post(`/vaccines/${cnic}`, { code: marking.code, date })).data });
      toast(`${marking.name} recorded`);
      setMarking(null);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  const undo = async (v) => {
    try {
      setData({ ...data, ...(await api.delete(`/vaccines/${cnic}/${v.code}`)).data });
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  const groups = [];
  data.items.forEach((v) => {
    const g = groups.find((x) => x.label === v.label);
    if (g) g.items.push(v);
    else groups.push({ label: v.label, dueDate: v.dueDate, items: [v] });
  });
  const given = data.items.filter((v) => v.status === 'given').length;
  const attention = data.items.filter((v) => v.status === 'due' || v.status === 'overdue');

  return (
    <div className="stack gap-20">
      <div className="row gap-20 wrap">
        <div className="stack"><strong style={{ fontSize: 36, lineHeight: 1 }}>{given}/{data.items.length}</strong><span className="subtle" style={{ fontSize: 13 }}>vaccines recorded</span></div>
        <div className="progress grow" style={{ minWidth: 200, alignSelf: 'center' }}><span style={{ width: `${(given / data.items.length) * 100}%` }} /></div>
      </div>
      {attention.length > 0 && (
        <div className="auth-notice"><FiAlertTriangle /> <span>{attention.map((v) => v.name).join(', ')} {attention.length > 1 ? 'are' : 'is'} due. Visit your nearest EPI centre or paediatrician. Routine EPI vaccines are free at government centres.</span></div>
      )}
      <div className="vaccine-timeline">
        {groups.map((g) => (
          <div key={g.label} className="vaccine-group">
            <div className="vaccine-age"><strong>{g.label}</strong><span className="subtle">{formatDate(g.dueDate)}</span></div>
            <div className="stack gap-8 grow">
              {g.items.map((v) => {
                const s = STATUS[v.status];
                return (
                  <div key={v.code} className={`vaccine-row ${v.status}`}>
                    <s.icon className="vaccine-icon" />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <strong>{v.name}</strong>
                      <div className="subtle" style={{ fontSize: 12.5 }}>{v.protects}{v.givenOn ? ` · given ${formatDate(v.givenOn)}` : ''}</div>
                    </div>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                    {canEdit && (v.status === 'given'
                      ? <button className="btn btn-ghost btn-sm" onClick={() => undo(v)}>Undo</button>
                      : <button className="btn btn-sm" onClick={() => { setMarking(v); setDate(new Date().toISOString().slice(0, 10)); }}>Mark given</button>)}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="subtle" style={{ fontSize: 12.5 }}>Based on Pakistan&apos;s Expanded Programme on Immunization routine schedule. Your doctor may advise a different timing; polio campaign drops are given in addition.</p>
      <Modal open={Boolean(marking)} onClose={() => setMarking(null)} title={marking && `Record ${marking.name}`} subtitle="When was it given?" width={420}>
        <div className="stack gap-16">
          <input type="date" className="input" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} aria-label="Date given" />
          <Button className="btn btn-primary btn-block" disabled={!date} loading={busy} onClick={save}>Save</Button>
        </div>
      </Modal>
    </div>
  );
};

const Vaccines = () => {
  const { cnic, profile } = useShell();
  return (
    <>
      <PageHeader eyebrow="Vaccinations" title={profile ? `${profile.firstName}'s vaccines` : 'Vaccines'} subtitle="The national childhood schedule with due dates worked out from the date of birth. We remind you a week before each one." />
      <section className="glass card-pad-lg"><VaccineSchedule cnic={cnic} /></section>
    </>
  );
};

export default Vaccines;
