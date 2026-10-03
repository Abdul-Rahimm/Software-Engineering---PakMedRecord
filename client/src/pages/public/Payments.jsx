import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiAlertTriangle, FiCheckCircle, FiCreditCard, FiXCircle } from 'react-icons/fi';
import api from '../../api';
import { getSession } from '../../session';
import { CenterCard } from '../../ui/Layouts';
import { Button, Spinner } from '../../ui/Bits';
import { apiError, formatTime } from '../../lib/format';
import { downloadReceiptPDF } from '../../lib/pdf';
import '../auth.css';

const usePayment = (ref) => {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => {
    if (!ref) return setState({ data: null, error: 'Missing payment reference' });
    api.get(`/payments/${ref}`).then((r) => setState({ data: r.data, error: null })).catch((err) => setState({ data: null, error: apiError(err) }));
  }, [ref]);
  return [state, setState];
};

const Summary = ({ data }) => (
  <div className="glass card-pad stack gap-8" style={{ fontSize: 14 }}>
    <div className="row between"><span className="subtle">Doctor</span><strong>Dr. {data.doctor?.firstName} {data.doctor?.lastName}</strong></div>
    <div className="row between"><span className="subtle">Appointment</span><span>{new Date(data.appointment.date).toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })} · {formatTime(data.appointment.time)}</span></div>
    <div className="row between"><span className="subtle">Amount</span><strong>Rs {data.payment.amount.toLocaleString('en-PK')}</strong></div>
  </div>
);

// Simulated checkout used when PAYMENTS_TEST_MODE is on. No money moves.
export const TestCheckout = () => {
  const { ref } = useParams();
  const navigate = useNavigate();
  const [{ data, error }] = usePayment(ref);
  const [busy, setBusy] = useState(false);
  const finish = async (success) => {
    setBusy(true);
    try {
      await api.post(`/payments/test/${ref}`, { success });
    } finally {
      navigate(`/payments/result?ref=${ref}`);
    }
  };
  return (
    <CenterCard>
      <div className="stack gap-8">
        <span className="badge badge-amber" style={{ alignSelf: 'flex-start' }}><FiAlertTriangle /> Test mode: no real payment</span>
        <h1 style={{ fontSize: 26 }}>Pay consultation fee</h1>
        <p className="muted">This is a simulated checkout for trying out PakMedRecord. Clinics that connect Safepay send patients to Safepay&apos;s secure checkout instead.</p>
      </div>
      {error ? <p className="field-error">{error}</p> : !data ? <Spinner /> : (
        <>
          <Summary data={data} />
          <Button className="btn btn-primary btn-lg btn-block" loading={busy} onClick={() => finish(true)}><FiCreditCard /> Pay Rs {data.payment.amount.toLocaleString('en-PK')}</Button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => finish(false)}>Cancel payment</button>
        </>
      )}
    </CenterCard>
  );
};

// Where Safepay (or the test checkout) sends the patient back. If the confirmation hasn't
// arrived yet, ask the server to check with Safepay for a few seconds before giving up.
export const PaymentResult = () => {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const [state, setState] = useState({ data: null, error: null });
  const cnic = getSession()?.cnic;

  useEffect(() => {
    if (!ref) {
      setState({ data: null, error: 'Missing payment reference' });
      return undefined;
    }
    let tries = 0;
    let timer;
    let live = true;
    const load = async () => {
      try {
        const { data } = await api.get(`/payments/${ref}`, { params: { check: 1 } });
        if (!live) return;
        setState({ data, error: null });
        if (data.payment.status === 'initiated' && ++tries < 6) timer = setTimeout(load, 2500);
      } catch (err) {
        if (live) setState({ data: null, error: apiError(err) });
      }
    };
    load();
    return () => { live = false; clearTimeout(timer); };
  }, [ref]);

  const { data, error } = state;
  const status = data?.payment?.status;
  const view = {
    paid: { icon: FiCheckCircle, ok: true, title: 'Payment received', text: 'Your doctor has been notified. You can download a receipt any time from My appointments.' },
    initiated: { icon: FiAlertTriangle, ok: false, title: 'Confirming your payment…', text: 'Safepay hasn\'t confirmed it yet. If money was taken it will show as paid within a few minutes; you don\'t need to pay again.' },
    cancelled: { icon: FiXCircle, ok: false, title: 'Payment cancelled', text: 'No money was taken. You can try again, or pay at the clinic.' },
    failed: { icon: FiXCircle, ok: false, title: 'Payment not completed', text: 'No money was taken. You can try again, or pay at the clinic.' },
    refund_due: { icon: FiAlertTriangle, ok: false, title: 'Refund on its way', text: 'This appointment was cancelled, so the clinic will refund you.' },
    refunded: { icon: FiCheckCircle, ok: true, title: 'Refunded', text: 'The clinic has refunded this payment.' },
  }[status] || {};
  return (
    <CenterCard>
      {error ? <p className="field-error">{error}</p> : !data ? <Spinner /> : (
        <div className="stack gap-16" style={{ textAlign: 'center' }}>
          <div className="inbox-orb" style={view.ok ? undefined : { color: status === 'initiated' ? 'var(--amber)' : 'var(--rose-text)' }}>{status === 'initiated' ? <Spinner size={26} /> : view.icon && <view.icon size={30} />}</div>
          <h1 style={{ fontSize: 26 }}>{view.title}</h1>
          <p className="muted">{view.text}</p>
          <Summary data={data} />
          {['paid', 'refund_due', 'refunded'].includes(status) && <button className="btn" onClick={() => downloadReceiptPDF(data)}>Download receipt</button>}
          <Link to={cnic ? `/appointments/mine/${cnic}` : '/'} className="btn btn-primary btn-block">Back to my appointments</Link>
        </div>
      )}
    </CenterCard>
  );
};
