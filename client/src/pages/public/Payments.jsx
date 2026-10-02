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
        <p className="muted">This is a simulated checkout for trying out PakMedRecord. In production, JazzCash opens here instead.</p>
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

// Where JazzCash (or the test checkout) sends the patient back
export const PaymentResult = () => {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const [{ data, error }] = usePayment(ref);
  const cnic = getSession()?.cnic;
  const paid = data?.payment?.status === 'paid';
  return (
    <CenterCard>
      {error ? <p className="field-error">{error}</p> : !data ? <Spinner /> : (
        <div className="stack gap-16" style={{ textAlign: 'center' }}>
          <div className="inbox-orb" style={paid ? undefined : { color: 'var(--rose-text)' }}>{paid ? <FiCheckCircle size={30} /> : <FiXCircle size={30} />}</div>
          <h1 style={{ fontSize: 26 }}>{paid ? 'Payment received' : data.payment.status === 'initiated' ? 'Payment pending' : 'Payment not completed'}</h1>
          <p className="muted">{paid ? 'Your doctor has been notified.' : data.payment.message || 'No money was taken. You can try again or pay at the clinic.'}</p>
          <Summary data={data} />
          {paid && <button className="btn" onClick={() => downloadReceiptPDF(data)}>Download receipt</button>}
          <Link to={cnic ? `/appointments/mine/${cnic}` : '/'} className="btn btn-primary btn-block">Back to my appointments</Link>
        </div>
      )}
    </CenterCard>
  );
};
