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
