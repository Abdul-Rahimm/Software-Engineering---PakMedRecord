import { formatCNIC, formatDateTime } from './format';

// Branded, printable medical record
export const downloadRecordPDF = async ({ record, patient, doctor }) => {
  // loaded on demand to keep the main bundle small
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;

  // Header band
  doc.setFillColor(4, 10, 18);
  doc.rect(0, 0, W, 120, 'F');
  doc.setFillColor(61, 255, 176);
  doc.rect(0, 120, W, 4, 'F');
  doc.setTextColor(61, 255, 176);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('PakMedRecord', M, 62);
  doc.setTextColor(170, 185, 205);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text('Verified medical record', M, 86);
  doc.text(`Generated ${formatDateTime(new Date())}`, W - M, 86, { align: 'right' });

  // Meta grid
  const rows = [
    ['Title', record.title || '—'],
    ['Category', record.category || 'General'],
    ['Patient', patient ? `${patient.firstName} ${patient.lastName}` : '—'],
    ['Patient CNIC', formatCNIC(record.patientCNIC)],
    ['Doctor', doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : formatCNIC(record.doctorCNIC)],
    ['Hospital', doctor?.hospital || '—'],
    ['Recorded', formatDateTime(record.createdAt)],
    ['Record ID', String(record._id)],
  ];
  let y = 170;
  doc.setFontSize(10);
  rows.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? M : W / 2 + 8;
    if (i % 2 === 0 && i > 0) y += 44;
    doc.setTextColor(120, 130, 145);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(20, 28, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(String(value), x, y + 17, { maxWidth: W / 2 - M - 8 });
    doc.setFontSize(10);
  });

  // Body
  y += 70;
  doc.setDrawColor(225, 230, 238);
  doc.line(M, y - 26, W - M, y - 26);
  doc.setTextColor(120, 130, 145);
  doc.setFont('helvetica', 'bold');
  doc.text('CLINICAL NOTES', M, y);
  doc.setTextColor(20, 28, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12.5);
  const lines = doc.splitTextToSize(record.recordData || '', W - M * 2);
  doc.text(lines, M, y + 24, { lineHeightFactor: 1.6 });

  // Footer
  const H = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setTextColor(150, 160, 175);
  doc.text('This document was generated from PakMedRecord. Verify authenticity with the issuing doctor.', M, H - 36);

  doc.save(`PakMedRecord-${formatCNIC(record.patientCNIC)}-${String(record._id).slice(-6)}.pdf`);
};

const age = (dob) => (dob ? Math.floor((Date.now() - new Date(dob)) / 3.15576e10) : null);

// Wallet-size emergency card: blood group, allergies, conditions, medications, emergency contact
// `qrUrl`: link to the patient's emergency page, printed as a QR code on the back
export const downloadEmergencyCard = async (p, qrUrl) => {
  const { jsPDF } = await import('jspdf');
  const qr = qrUrl ? await (await import('../ui/QRCode')).qrDataUrl(qrUrl, 300) : null;
  // credit-card proportions, landscape, two pages (front/back)
  const doc = new jsPDF({ unit: 'mm', format: [85.6, 54], orientation: 'landscape' });
  const W = 85.6;

  const header = (title) => {
    doc.setFillColor(4, 10, 18);
    doc.rect(0, 0, W, 12, 'F');
    doc.setFillColor(255, 93, 143);
    doc.rect(0, 12, W, 1, 'F');
    doc.setTextColor(61, 255, 176);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('PakMedRecord', 4, 7.6);
    doc.setTextColor(255, 143, 177);
    doc.setFontSize(7);
    doc.text(title, W - 4, 7.6, { align: 'right' });
  };

  const field = (label, value, x, y, w) => {
    doc.setTextColor(120, 130, 145);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.2);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(15, 22, 35);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    const lines = doc.splitTextToSize(value || '—', w);
    doc.text(lines.slice(0, 3), x, y + 3.4);
  };

  header('EMERGENCY MEDICAL CARD');
  doc.setTextColor(15, 22, 35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${p.firstName} ${p.lastName}`, 4, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(90, 100, 115);
  doc.text(`CNIC ${formatCNIC(p.patientCNIC)}  ·  ${p.gender}${age(p.dateOfBirth) != null ? `  ·  ${age(p.dateOfBirth)} yrs` : ''}`, 4, 24.5);

  // blood group badge
  doc.setFillColor(255, 93, 143);
  doc.roundedRect(W - 22, 15.5, 18, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5);
  doc.text('BLOOD', W - 13, 19, { align: 'center' });
  doc.setFontSize(10);
  doc.text(p.bloodGroup || '?', W - 13, 24.4, { align: 'center' });

  field('Allergies', (p.allergies || []).join(', ') || 'None recorded', 4, 31, 38);
  field('Conditions', (p.chronicConditions || []).join(', ') || 'None recorded', 44, 31, 38);
  const ec = p.emergencyContact || {};
  field('Emergency contact', ec.name ? `${ec.name}${ec.relation ? ` (${ec.relation})` : ''}  ${ec.phone || ''}` : 'Not set', 4, 45, 78);

  doc.addPage([85.6, 54], 'landscape');
  header('MEDICATIONS');
  const meds = (p.medications || []).map((m) => [m.name, m.dose, m.frequency].filter(Boolean).join(' · '));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(15, 22, 35);
  const medWidth = qr ? 50 : 78;
  (meds.length ? meds.slice(0, 7) : ['No current medications recorded']).forEach((m, i) => doc.text(doc.splitTextToSize(`•  ${m}`, medWidth)[0], 4, 19 + i * 4.2));
  if (qr) {
    doc.addImage(qr, 'PNG', W - 30, 16, 26, 26);
    doc.setFontSize(5);
    doc.setTextColor(90, 100, 115);
    doc.text('Scan for full emergency info', W - 17, 45, { align: 'center' });
  }
  doc.setFontSize(5.6);
  doc.setTextColor(120, 130, 145);
  doc.text(`In an emergency call 1122.  Generated ${new Date().toLocaleDateString('en-GB')}`, 4, 51);

  doc.save(`PakMedRecord-emergency-card-${formatCNIC(p.patientCNIC)}.pdf`);
};

// Complete medical history: profile summary followed by every record
export const downloadHistoryPDF = async ({ patient: p, records, doctorsById }) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 0;

  const ensure = (needed) => {
    if (y + needed > H - 56) {
      doc.addPage();
      y = 56;
    }
  };

  doc.setFillColor(4, 10, 18);
  doc.rect(0, 0, W, 110, 'F');
  doc.setFillColor(61, 255, 176);
  doc.rect(0, 110, W, 4, 'F');
  doc.setTextColor(61, 255, 176);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('PakMedRecord', M, 56);
  doc.setTextColor(200, 210, 225);
  doc.setFontSize(13);
  doc.text(`Medical history — ${p.firstName} ${p.lastName}`, M, 82);
  doc.setFontSize(9.5);
  doc.setTextColor(150, 165, 185);
  doc.text(`CNIC ${formatCNIC(p.patientCNIC)}   ·   Generated ${formatDateTime(new Date())}`, M, 98);

  y = 148;
  const summary = [
    ['Blood group', p.bloodGroup || '—'],
    ['Date of birth', p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString('en-GB') : '—'],
    ['Allergies', (p.allergies || []).join(', ') || 'None recorded'],
    ['Chronic conditions', (p.chronicConditions || []).join(', ') || 'None recorded'],
    ['Medications', (p.medications || []).map((m) => [m.name, m.dose, m.frequency].filter(Boolean).join(' ')).join('; ') || 'None recorded'],
    ['Family history', (p.familyHistory || []).join(', ') || 'None recorded'],
  ];
  summary.forEach(([k, v]) => {
    const lines = doc.splitTextToSize(v, W - M * 2 - 130);
    ensure(lines.length * 14 + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 130, 145);
    doc.text(k.toUpperCase(), M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(20, 28, 40);
    doc.text(lines, M + 130, y);
    y += lines.length * 14 + 8;
  });

  y += 12;
  ensure(40);
  doc.setDrawColor(225, 230, 238);
  doc.line(M, y, W - M, y);
  y += 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 28, 40);
  doc.text(`Records (${records.length})`, M, y);
  y += 22;

  records.forEach((r) => {
    const d = doctorsById?.[r.doctorCNIC];
    const body = doc.splitTextToSize(r.recordData || '', W - M * 2);
    ensure(48 + body.length * 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(20, 28, 40);
    doc.text(`${r.title || r.category || 'Record'}`, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120, 130, 145);
    doc.text(`${formatDateTime(r.createdAt)}  ·  ${r.category || 'General'}  ·  ${d ? `Dr. ${d.firstName} ${d.lastName}, ${d.hospital}` : formatCNIC(r.doctorCNIC)}`, M, y + 14);
    doc.setFontSize(11);
    doc.setTextColor(35, 45, 60);
    doc.text(body, M, y + 32, { lineHeightFactor: 1.45 });
    y += 44 + body.length * 15.5;
  });

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8.5);
    doc.setTextColor(150, 160, 175);
    doc.text(`PakMedRecord · ${p.firstName} ${p.lastName} · page ${i} of ${pages}`, M, H - 28);
  }
  doc.save(`PakMedRecord-history-${formatCNIC(p.patientCNIC)}.pdf`);
};

const pdfHeader = (doc, W, M, subtitle) => {
  doc.setFillColor(4, 10, 18);
  doc.rect(0, 0, W, 96, 'F');
  doc.setFillColor(61, 255, 176);
  doc.rect(0, 96, W, 3, 'F');
  doc.setTextColor(61, 255, 176);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('PakMedRecord', M, 50);
  doc.setTextColor(170, 185, 205);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(subtitle, M, 72);
};

// E-prescription with a QR code pharmacies scan to verify it
export const downloadPrescriptionPDF = async ({ prescription: rx, doctor, patient, appUrl = window.location.origin }) => {
  const [{ jsPDF }, { qrDataUrl }] = await Promise.all([import('jspdf'), import('../ui/QRCode')]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  pdfHeader(doc, W, M, 'E-prescription');
  doc.setTextColor(170, 185, 205);
  doc.text(`Issued ${formatDateTime(rx.createdAt)}`, W - M, 72, { align: 'right' });

  const qr = await qrDataUrl(`${appUrl}/rx/${rx.code}`, 300);
  doc.addImage(qr, 'PNG', W - M - 96, 118, 96, 96);
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 145);
  doc.text('Scan to verify', W - M - 48, 226, { align: 'center' });
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(20, 28, 40);
  doc.text(rx.code, W - M - 48, 240, { align: 'center' });

  const label = (text, x, y) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(120, 130, 145);
    doc.text(text.toUpperCase(), x, y);
  };
  const value = (text, x, y, w = 300) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(20, 28, 40);
    doc.text(doc.splitTextToSize(String(text || '—'), w), x, y);
  };
  label('Doctor', M, 132);
  value(doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : '—', M, 149);
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 115);
  doc.text([doctor?.specialization, doctor?.hospital].filter(Boolean).join(' · '), M, 165);
  if (doctor?.verification?.pmdcNumber) doc.text(`PMDC ${doctor.verification.pmdcNumber}`, M, 179);
  label('Patient', M, 206);
  value(patient ? `${patient.firstName} ${patient.lastName}` : '—', M, 223);
  doc.setFontSize(10);
  doc.setTextColor(90, 100, 115);
  doc.text(`CNIC ${formatCNIC(rx.patientCNIC)}${patient?.gender ? ` · ${patient.gender}` : ''}${age(patient?.dateOfBirth) != null ? ` · ${age(patient.dateOfBirth)} yrs` : ''}`, M, 239);

  let y = 270;
  if (rx.diagnosis) {
    label('Diagnosis', M, y);
    value(rx.diagnosis, M, y + 17, W - M * 2);
    y += 44;
  }
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(26);
  doc.setTextColor(5, 150, 105);
  doc.text('Rx', M, y + 14);
  y += 36;
  rx.items.forEach((item, i) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(20, 28, 40);
    doc.text(`${i + 1}. ${item.name}${item.dose ? `  ${item.dose}` : ''}`, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(70, 80, 95);
    const detail = [item.frequency, item.durationDays ? `for ${item.durationDays} days` : null, item.instructions].filter(Boolean).join(' · ');
    if (detail) doc.text(doc.splitTextToSize(detail, W - M * 2 - 16), M + 16, y + 16);
    y += detail ? 42 : 26;
  });
  if (rx.notes) {
    y += 8;
    label('Notes', M, y);
    value(rx.notes, M, y + 17, W - M * 2);
  }
  doc.setDrawColor(200, 206, 216);
  doc.line(W - M - 180, H - 110, W - M, H - 110);
  doc.setFontSize(9);
  doc.setTextColor(120, 130, 145);
  doc.text('Electronically issued via PakMedRecord', W - M - 90, H - 96, { align: 'center' });
  doc.text(`Verify at ${appUrl}/rx/${rx.code}. Valid only if the status there is "Valid".`, M, H - 36);
  doc.save(`Prescription-${rx.code}.pdf`);
};

// Payment receipt for a consultation
export const downloadReceiptPDF = async ({ payment, appointment, doctor, patient }) => {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a5' });
  const W = doc.internal.pageSize.getWidth();
  const M = 32;
  pdfHeader(doc, W, M, 'Payment receipt');
  const rows = [
    ['Receipt no.', payment.txnRef],
    ['Paid on', formatDateTime(payment.paidAt)],
    ['Patient', patient ? `${patient.firstName} ${patient.lastName}` : formatCNIC(payment.patientCNIC)],
    ['Doctor', doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : '—'],
    ['Clinic', doctor?.clinicAddress || doctor?.hospital || '—'],
    ['Appointment', appointment ? `${new Date(appointment.date).toLocaleDateString('en-GB', { timeZone: 'UTC' })} at ${appointment.time}` : '—'],
    ['Method', { jazzcash: 'JazzCash', test: 'Test payment (no money moved)', clinic: 'Paid at clinic' }[payment.provider] || payment.provider],
    ['Reference', payment.providerRef || '—'],
  ];
  let y = 130;
  rows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120, 130, 145);
    doc.text(k, M, y);
    doc.setTextColor(20, 28, 40);
    doc.text(String(v), W - M, y, { align: 'right', maxWidth: W / 2 });
    y += 22;
  });
  doc.setDrawColor(225, 230, 238);
  doc.line(M, y, W - M, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Total paid', M, y + 28);
  doc.text(`Rs ${Number(payment.amount).toLocaleString('en-PK')}`, W - M, y + 28, { align: 'right' });
  doc.save(`Receipt-${payment.txnRef}.pdf`);
};
