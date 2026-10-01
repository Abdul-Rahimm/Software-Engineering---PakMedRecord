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
export const downloadEmergencyCard = async (p) => {
  const { jsPDF } = await import('jspdf');
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
  (meds.length ? meds.slice(0, 7) : ['No current medications recorded']).forEach((m, i) => doc.text(`•  ${m}`, 4, 19 + i * 4.2, { maxWidth: 78 }));
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
