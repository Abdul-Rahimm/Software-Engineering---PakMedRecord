import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';
import { FiActivity, FiArrowDownRight, FiArrowUpRight, FiMinus, FiPlus, FiTrash2 } from 'react-icons/fi';
import api from '../../api';
import { useShell } from '../../layout/ShellContext';
import { useFetch } from '../../lib/data';
import { apiError, formatDateTime } from '../../lib/format';
import { VITAL_TYPES, formatVitalValue, vitalFlag } from '../../lib/constants';
import { Button, EmptyState, PageHeader, Skeleton } from '../../ui/Bits';
import TiltCard from '../../ui/TiltCard';
import { useFeedback } from '../../ui/Feedback';
import '../dashboard.css';

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Filler, Tooltip);

// Same validated pair as the insights charts
const SERIES = ['#12a877', '#8a78ff'];
const SURFACE = '#0d1526';
const FLAG_LABEL = { high: 'High', low: 'Low', elevated: 'Elevated' };

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(12,20,36,0.95)', borderColor: 'rgba(148,197,255,0.2)', borderWidth: 1,
      titleColor: '#e8eef9', bodyColor: '#a3b1c6', padding: 12, cornerRadius: 10, usePointStyle: true, boxPadding: 6,
    },
  },
  scales: {
    x: { grid: { display: false }, border: { display: false }, ticks: { color: '#6b7a92', maxTicksLimit: 7, font: { family: 'JetBrains Mono', size: 11 } } },
    y: { grid: { color: 'rgba(148,197,255,0.07)' }, border: { display: false }, ticks: { color: '#6b7a92', font: { family: 'JetBrains Mono', size: 11 } } },
  },
};

// Shared by the patient's page (editable) and the doctor's patient file (read-only)
export const VitalsView = ({ patientCNIC, readOnly = false }) => {
  const { toast, confirm } = useFeedback();
  const [type, setType] = useState('bloodPressure');
  const [form, setForm] = useState({ value: '', value2: '', recordedAt: nowLocal(), note: '' });
  const [saving, setSaving] = useState(false);

  const { data, loading, reload, setData } = useFetch(
    async () => (await api.get(`/vitals/${patientCNIC}`)).data.vitals,
    [patientCNIC]
  );

  const byType = useMemo(() => {
    const map = Object.fromEntries(Object.keys(VITAL_TYPES).map((k) => [k, []]));
    (data || []).forEach((v) => map[v.type]?.push(v)); // newest first
    return map;
  }, [data]);

  const meta = VITAL_TYPES[type];
  const readings = byType[type] || [];
  const chrono = [...readings].reverse().slice(-30);

  const chartData = {
    labels: chrono.map((v) => new Date(v.recordedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
    datasets: [
      {
        label: meta.paired ? 'Systolic' : meta.label,
        data: chrono.map((v) => v.value),
        borderColor: SERIES[0],
        backgroundColor: 'rgba(18,168,119,0.15)',
        fill: !meta.paired,
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: SERIES[0],
        pointBorderColor: SURFACE,
        pointBorderWidth: 2,
      },
      ...(meta.paired ? [{
        label: 'Diastolic',
        data: chrono.map((v) => v.value2),
        borderColor: SERIES[1],
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: SERIES[1],
        pointBorderColor: SURFACE,
        pointBorderWidth: 2,
      }] : []),
    ],
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/vitals/${patientCNIC}`, {
        type,
        value: Number(form.value),
        ...(meta.paired && { value2: Number(form.value2) }),
        recordedAt: new Date(form.recordedAt).toISOString(),
        note: form.note,
      });
      toast(`${meta.label} logged`);
      setForm({ value: '', value2: '', recordedAt: nowLocal(), note: '' });
      reload(true);
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (v) => {
    const ok = await confirm({ title: 'Delete this reading?', message: `${meta.label} ${formatVitalValue(v)} ${meta.unit} on ${formatDateTime(v.recordedAt)}`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/vitals/${patientCNIC}/${v._id}`);
      setData((list) => list.filter((x) => x._id !== v._id));
    } catch (err) {
      toast(apiError(err), 'error');
    }
  };

  if (loading) return <div className="stack gap-20"><div className="grid grid-3">{[0, 1, 2].map((i) => <Skeleton key={i} height={120} />)}</div><Skeleton height={320} /></div>;

  const trend = (list) => {
    if (list.length < 2) return null;
    const d = list[0].value - list[1].value;
    if (Math.abs(d) < 0.01) return { Icon: FiMinus, text: 'No change' };
    return { Icon: d > 0 ? FiArrowUpRight : FiArrowDownRight, text: `${d > 0 ? '+' : ''}${Number(d.toFixed(1))} since last` };
  };

  return (
    <div className="stack gap-20">
      <div className="grid grid-3">
        {Object.entries(VITAL_TYPES).map(([key, m]) => {
          const latest = byType[key][0];
          const flag = latest && vitalFlag(key, latest.value, latest.value2);
          const t = trend(byType[key]);
          return (
            <TiltCard key={key} as="button" type="button" className={`vital-tile card-pad ${type === key ? 'active' : ''}`} onClick={() => setType(key)} aria-pressed={type === key}>
              <div className="row between">
                <span className="subtle" style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span>
                {flag && <span className={`badge ${flag === 'elevated' ? 'badge-amber' : 'badge-rose'}`}>{FLAG_LABEL[flag]}</span>}
              </div>
              <div className={`vital-value depth-1 ${flag ? `flag-${flag}` : ''}`}>
                {latest ? formatVitalValue(latest) : '—'}<span className="vital-unit">{latest ? m.unit : ''}</span>
              </div>
              <div className="subtle row gap-8" style={{ fontSize: 12.5 }}>
                {latest ? <>{t && <t.Icon />} {t ? t.text : formatDateTime(latest.recordedAt)}</> : 'No readings yet'}
              </div>
            </TiltCard>
          );
        })}
      </div>

      <div className={readOnly ? 'stack gap-20' : 'grid dash-grid'} style={{ alignItems: 'start' }}>
        <section className="glass card-pad chart-card">
          <div className="row between wrap gap-12">
            <h2 className="section-title">{meta.label} <span className="subtle" style={{ fontSize: 13, fontWeight: 500 }}>({meta.unit})</span></h2>
            {meta.paired && (
              <div className="row gap-16" style={{ fontSize: 13, color: '#a3b1c6' }}>
                <span className="row gap-8"><span style={{ width: 10, height: 10, borderRadius: 3, background: SERIES[0] }} /> Systolic</span>
                <span className="row gap-8"><span style={{ width: 10, height: 10, borderRadius: 3, background: SERIES[1] }} /> Diastolic</span>
              </div>
            )}
          </div>
          {chrono.length === 0 ? (
            <EmptyState icon={FiActivity} title="No readings yet">{readOnly ? 'The patient hasn’t logged this vital.' : 'Log your first reading to start a trend.'}</EmptyState>
          ) : (
            <div className="chart-box"><Line data={chartData} options={chartOptions} aria-label={`${meta.label} trend chart`} /></div>
          )}
          {readings.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>When</th><th>Reading</th><th>Note</th>{!readOnly && <th aria-label="Actions" />}</tr></thead>
                <tbody>
                  {readings.slice(0, 8).map((v) => {
                    const flag = vitalFlag(v.type, v.value, v.value2);
                    return (
                      <tr key={v._id}>
                        <td className="subtle" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(v.recordedAt)}</td>
                        <td className="mono" style={{ whiteSpace: 'nowrap' }}>
                          <span className={flag ? `flag-${flag}` : ''}>{formatVitalValue(v)}</span> <span className="subtle">{meta.unit}</span>
                        </td>
                        <td className="subtle">{v.note || '—'}</td>
                        {!readOnly && <td style={{ width: 40 }}><button className="btn btn-ghost btn-sm btn-icon" onClick={() => remove(v)} aria-label="Delete reading"><FiTrash2 /></button></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {!readOnly && (
          <motion.form className="glass card-pad stack gap-16" onSubmit={save} style={{ position: 'sticky', top: 24 }} key={type} initial={{ opacity: 0, rotateY: -10 }} animate={{ opacity: 1, rotateY: 0 }}>
            <h2 className="section-title">Log {meta.label.toLowerCase()}</h2>
            <div className={meta.paired ? 'grid grid-2' : ''} style={{ gap: 12 }}>
              <div className="field">
                <label className="field-label" htmlFor="v1">{meta.paired ? 'Systolic' : `Value (${meta.unit})`}</label>
                <input id="v1" className="input mono" type="number" step="any" inputMode="decimal" placeholder={meta.placeholder[0]} value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} required />
              </div>
              {meta.paired && (
                <div className="field">
                  <label className="field-label" htmlFor="v2">Diastolic</label>
                  <input id="v2" className="input mono" type="number" step="any" inputMode="decimal" placeholder={meta.placeholder[1]} value={form.value2} onChange={(e) => setForm((f) => ({ ...f, value2: e.target.value }))} required />
                </div>
              )}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="vt">When</label>
              <input id="vt" className="input" type="datetime-local" max={nowLocal()} value={form.recordedAt} onChange={(e) => setForm((f) => ({ ...f, recordedAt: e.target.value }))} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="vn">Note (optional)</label>
              <input id="vn" className="input" maxLength={200} placeholder="e.g. after breakfast" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <Button className="btn btn-primary btn-block" loading={saving} disabled={!form.value || (meta.paired && !form.value2)}><FiPlus /> Save reading</Button>
            <p className="subtle" style={{ fontSize: 12 }}>Highlights use general adult reference ranges and aren&apos;t a diagnosis.</p>
          </motion.form>
        )}
      </div>
    </div>
  );
};

const Vitals = () => {
  const { cnic } = useShell();
  return (
    <>
      <PageHeader eyebrow="Tracking" title="Vitals" subtitle="Log blood pressure, sugar, weight and more. Your care team can see the trends." />
      <VitalsView patientCNIC={cnic} />
    </>
  );
};

export default Vitals;
