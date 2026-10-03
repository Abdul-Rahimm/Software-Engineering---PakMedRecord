import { useState } from 'react';
import { FiRotateCcw } from 'react-icons/fi';
import api from '../api';
import { apiError } from '../lib/format';
import { useFeedback } from './Feedback';

// For a cancelled paid appointment: the clinic refunds in its Safepay dashboard, then records it here
const RefundButton = ({ appointment, onDone, className = 'btn btn-sm' }) => {
  const { toast, confirm } = useFeedback();
  const [busy, setBusy] = useState(false);
  if (appointment.payment?.status !== 'refund_due' || !appointment.payment.paymentId) return null;
  const run = async () => {
    const ok = await confirm({
      title: `Refund Rs ${appointment.fee || ''}?`,
      message: 'First send the refund from your Safepay dashboard (Payments → find the payment → Refund). Then mark it here so the patient is told.',
      confirmLabel: 'I have refunded it',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api.post(`/payments/${appointment.payment.paymentId}/refunded`, { note: 'Refunded in Safepay' });
      toast('Marked as refunded. The patient has been notified.');
      onDone?.();
    } catch (err) {
      toast(apiError(err), 'error');
    } finally {
      setBusy(false);
    }
  };
  return <button className={className} onClick={run} disabled={busy}><FiRotateCcw /> Mark refunded</button>;
};

export default RefundButton;
