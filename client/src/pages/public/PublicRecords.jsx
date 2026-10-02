import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiAlertTriangle, FiCheckCircle, FiClock, FiDroplet, FiFileText, FiPhone, FiShield, FiUser, FiXCircle } from 'react-icons/fi';
import api from '../../api';
import { PublicPage } from '../../ui/Layouts';
import { EmptyState, Skeleton } from '../../ui/Bits';
import Modal from '../../ui/Modal';
import Markdown from '../../ui/Markdown';
import PdfPreview from '../../ui/PdfPreview';
import { apiError, formatDate, formatDateTime } from '../../lib/format';
import { VITAL_TYPES, formatVitalValue } from '../../lib/constants';
import '../dashboard.css';

const useLoad = (path) => {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    api.get(path).then((r) => setState({ data: r.data, error: null })).catch((err) => setState({ data: null, error: apiError(err, 'Not found') }));
  }, [path]);
  return state;
};

const List = ({ items }) => (items?.length ? items.join(', ') : <span className="subtle">None recorded</span>);

// What a paramedic sees after scanning a patient's emergency card
export const EmergencyPage = () => {
  const { token } = useParams();
  const { data, error } = useLoad(`/public/emergency/${token}`);
  if (error) return <PublicPage nav={false}><div className="glass"><EmptyState icon={FiShield} title="Card not active">{error}</EmptyState></div></PublicPage>;
  if (!data) return <PublicPage nav={false}><Skeleton height={360} /></PublicPage>;
  return (
    <PublicPage nav={false}>
      <section className="glass card-pad-lg stack gap-20 emergency">
        <div className="emergency-head">
          <FiAlertTriangle size={22} />
          <span>Emergency medical information</span>
        </div>
        <div className="stack gap-4">
          <h1 style={{ fontSize: 32 }}>{data.name}</h1>
          <span className="muted">{[data.gender, data.age != null ? `${data.age} years` : null].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="grid grid-2">
          <div className="emergency-fact"><FiDroplet /><div><span className="k">Blood group</span><strong className="blood">{data.bloodGroup || 'Unknown'}</strong></div></div>
          <div className="emergency-fact alert"><FiAlertTriangle /><div><span className="k">Allergies</span><strong><List items={data.allergies} /></strong></div></div>
          <div className="emergency-fact"><FiFileText /><div><span className="k">Conditions</span><span><List items={data.chronicConditions} /></span></div></div>
          <div className="emergency-fact"><FiFileText /><div><span className="k">Medicines</span><span><List items={data.medications.map((m) => [m.name, m.dose].filter(Boolean).join(' '))} /></span></div></div>
        </div>
        {data.emergencyContact && (
          <a className="btn btn-primary btn-lg btn-block" href={`tel:${data.emergencyContact.phone}`}>
            <FiPhone /> Call {data.emergencyContact.name || 'emergency contact'}{data.emergencyContact.relation ? ` (${data.emergencyContact.relation})` : ''}: {data.emergencyContact.phone}
          </a>
        )}
        <a className="btn btn-lg btn-block" href="tel:1122"><FiPhone /> Rescue 1122</a>
        <p className="subtle" style={{ fontSize: 12.5 }}>Provided by the patient through PakMedRecord. Last updated {formatDateTime(data.updatedAt)}. This view is logged for the patient.</p>
      </section>
    </PublicPage>
  );
};

const API = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// A record shared through a time-limited link (no account needed)
export const SharedRecordPage = () => {
  const { token } = useParams();
  const { data, error } = useLoad(`/public/share/${token}`);
  const [file, setFile] = useState(null);

  if (error) return <PublicPage><div className="glass"><EmptyState icon={FiClock} title="Link expired">{error}</EmptyState></div></PublicPage>;
  if (!data) return <PublicPage><Skeleton height={400} /></PublicPage>;
  const p = data.patient;
  const fileUrl = (f) => `${API}/public/share/${token}/files/${f._id}`;
  return (
    <PublicPage wide>
      <div className="share-banner"><FiShield /> Shared by the patient · read-only · expires {formatDateTime(data.expiresAt)}</div>
      <section className="glass card-pad-lg stack gap-16" style={{ marginBottom: 20 }}>
        <span className="eyebrow">{data.label}</span>
        <h1 style={{ fontSize: 30 }}>{p.name}</h1>
        {p.gender && (
          <>
            <span className="muted">{[p.gender, p.age != null ? `${p.age} years` : null, p.bloodGroup ? `Blood ${p.bloodGroup}` : null].filter(Boolean).join(' · ')}</span>
            <div className="grid grid-2">
              <div><span className="field-label">Allergies</span><p className={p.allergies?.length ? 'allergy-text' : ''}><List items={p.allergies} /></p></div>
              <div><span className="field-label">Conditions</span><p><List items={p.chronicConditions} /></p></div>
              <div><span className="field-label">Current medicines</span><p><List items={(p.medications || []).map((m) => [m.name, m.dose, m.frequency].filter(Boolean).join(' '))} /></p></div>
              <div><span className="field-label">Family history</span><p><List items={p.familyHistory} /></p></div>
            </div>
          </>
        )}
      </section>

      <h2 className="section-title" style={{ marginBottom: 12 }}>Records ({data.records.length})</h2>
      <div className="stack gap-12">
        {data.records.map((r) => (
          <article key={r._id} className="glass card-pad stack gap-8">
            <div className="row between wrap gap-8">
              <div className="row gap-8 wrap"><span className="badge cat-badge">{r.category}</span><strong>{r.title || 'Record'}</strong></div>
              <span className="subtle" style={{ fontSize: 13 }}>{formatDate(r.createdAt)} · {r.author}</span>
            </div>
            <p className="tl-body" style={{ margin: 0 }}>{r.recordData}</p>
            {r.attachments.length > 0 && (
              <div className="att-chips">
                {r.attachments.map((a) => <button key={a._id} type="button" className="att-chip" onClick={() => setFile(a)}><FiFileText size={15} /> <span className="truncate">{a.name}</span></button>)}
              </div>
            )}
          </article>
        ))}
        {!data.records.length && <p className="subtle">No records shared.</p>}
      </div>

      {data.vitals?.length > 0 && (
        <>
          <h2 className="section-title" style={{ margin: '24px 0 12px' }}>Recent vitals</h2>
          <div className="glass table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Reading</th><th>Value</th></tr></thead>
              <tbody>
                {data.vitals.slice(0, 30).map((v) => (
                  <tr key={v._id}><td>{formatDateTime(v.recordedAt)}</td><td>{VITAL_TYPES[v.type]?.label}</td><td className="mono">{formatVitalValue(v)} {VITAL_TYPES[v.type]?.unit}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={Boolean(file)} onClose={() => setFile(null)} title={file?.name} width={1000}>
        {file && (
          <div className="viewer">
            <div className="viewer-doc">{file.mime === 'application/pdf' ? <PdfPreview url={fileUrl(file)} /> : <img src={fileUrl(file)} alt={file.name} />}</div>
            <div className="viewer-text">{file.text ? <Markdown text={file.text} /> : <p className="subtle">{file.summary || 'No extracted text.'}</p>}</div>
          </div>
        )}
      </Modal>
    </PublicPage>
  );
};

// Pharmacist / anyone checks that a prescription is genuine
export const RxVerifyPage = () => {
  const { code } = useParams();
  const { data, error } = useLoad(`/public/rx/${code}`);
  if (error) return <PublicPage><div className="glass"><EmptyState icon={FiXCircle} title="Not a valid prescription">{error}. Check the code and try again.</EmptyState></div></PublicPage>;
  if (!data) return <PublicPage><Skeleton height={360} /></PublicPage>;
  const statusBadge = { active: ['badge-green', 'Valid · not yet dispensed'], dispensed: ['badge-amber', `Dispensed${data.dispensed?.by ? ` by ${data.dispensed.by}` : ''} on ${formatDate(data.dispensed?.at)}`], cancelled: ['badge-rose', 'Cancelled by the doctor'] }[data.status];
  return (
    <PublicPage>
      <section className="glass card-pad-lg stack gap-20">
        <div className="row between wrap gap-12">
          <div className="stack gap-4">
            <span className="eyebrow">E-prescription</span>
            <h1 style={{ fontSize: 28 }} className="mono">{data.code}</h1>
          </div>
          <span className={`badge ${statusBadge[0]}`} style={{ height: 32, fontSize: 13 }}>{data.status === 'active' ? <FiCheckCircle /> : <FiAlertTriangle />} {statusBadge[1]}</span>
        </div>
        <div className="grid grid-2">
          <div className="stack gap-4">
            <span className="field-label">Prescribed by</span>
            <strong>{data.doctor?.name}</strong>
            <span className="subtle">{[data.doctor?.specialization, data.doctor?.hospital].filter(Boolean).join(' · ')}</span>
            <span className="row gap-8" style={{ fontSize: 13 }}>{data.doctor?.verified ? <><FiCheckCircle color="var(--emerald)" /> PMDC verified {data.doctor.pmdcNumber ? `(${data.doctor.pmdcNumber})` : ''}</> : <><FiAlertTriangle color="var(--amber)" /> Doctor not verified</>}</span>
          </div>
          <div className="stack gap-4">
            <span className="field-label">Patient</span>
            <strong className="row gap-8"><FiUser /> {data.patient?.initials}</strong>
            <span className="subtle">{[data.patient?.gender, data.patient?.age != null ? `${data.patient.age} years` : null].filter(Boolean).join(' · ')}</span>
            <span className="subtle" style={{ fontSize: 13 }}>Issued {formatDateTime(data.issuedAt)}</span>
          </div>
        </div>
        {data.diagnosis && <p><span className="field-label">Diagnosis</span><br />{data.diagnosis}</p>}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Medicine</th><th>Dose</th><th>How often</th><th>Duration</th></tr></thead>
            <tbody>
              {data.items.map((i) => (
                <tr key={i.name}><td><strong>{i.name}</strong>{i.instructions && <div className="subtle" style={{ fontSize: 12.5 }}>{i.instructions}</div>}</td><td>{i.dose || '—'}</td><td>{i.frequency || '—'}</td><td>{i.durationDays ? `${i.durationDays} days` : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.notes && <p className="muted">{data.notes}</p>}
        <p className="subtle" style={{ fontSize: 12.5 }}>Pharmacies with a PakMedRecord partner key can mark this prescription as dispensed through the partner API.</p>
      </section>
    </PublicPage>
  );
};
