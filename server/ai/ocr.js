// Reads uploaded medical documents with Mistral's vision-capable chat model (works on the free plan):
// a full transcription plus a suggested title, category, date and summary.

const { z } = require('zod');
const { RECORD_CATEGORIES } = require('../models/constants');

const MODEL = process.env.OCR_MODEL || process.env.AI_MODEL || 'ministral-14b-latest';

const PROMPT = `You are reading a medical document a patient or doctor uploaded to PakMedRecord (lab report, prescription, discharge summary, scan report, vaccination card, etc.).

Return ONLY a JSON object with these keys:
- "text": a faithful transcription of ALL readable text, in Markdown. Keep tables as Markdown tables, keep units and reference ranges, keep the original language. Do not add, correct or interpret anything. Write [illegible] for unreadable parts.
- "title": a short title for the record, max 8 words, e.g. "Lipid profile" or "Prescription from Dr. Khan".
- "category": exactly one of ${RECORD_CATEGORIES.map((c) => `"${c}"`).join(', ')}.
- "documentDate": the date on the document as YYYY-MM-DD, or "" if none is visible.
- "labs": for lab reports, one entry per numeric test result: {"test": name as printed, "value": number only, "unit": unit as printed, "range": reference range as printed or "", "flag": "H" or "L" only if the document itself marks it, else ""}. Use [] when there are no numeric lab results. Never invent values.
- "summary": 1-3 plain sentences stating what the document contains (tests with their values, medicines with doses, diagnosis). Only facts printed on the document: never call a value high, low, normal or abnormal unless the document itself says so, and give no advice.

If the image is not a medical document or contains no readable text, return "text": "" and explain in "summary".`;

const Result = z.object({
  text: z.string().default(''),
  title: z.string().default(''),
  category: z.string().default(''),
  documentDate: z.string().default(''),
  summary: z.string().default(''),
  labs: z.array(z.object({
    test: z.coerce.string().default(''),
    value: z.union([z.number(), z.string()]).optional(),
    unit: z.coerce.string().default(''),
    range: z.coerce.string().default(''),
    flag: z.coerce.string().default(''),
  }).passthrough()).default([]).catch([]),
});

// "5.4", "5,4" or "<0.5" -> number; anything else is dropped
const toNumber = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = String(v ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

let client;
const getClient = async () => {
  if (!client) {
    const { Mistral } = await import('@mistralai/mistralai');
    client = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
      ...(process.env.MISTRAL_SERVER_URL && { serverURL: process.env.MISTRAL_SERVER_URL }),
    });
  }
  return client;
};

const ocrEnabled = () => Boolean(process.env.MISTRAL_API_KEY);

// buffer + mime -> { text, title, category, documentDate, summary, labs }
const extractDocument = async (buffer, mime) => {
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
  const doc = mime === 'application/pdf'
    ? { type: 'document_url', documentUrl: dataUrl }
    : { type: 'image_url', imageUrl: dataUrl };
  const c = await getClient();
  const res = await c.chat.complete({
    model: MODEL,
    temperature: 0,
    maxTokens: 6000,
    responseFormat: { type: 'json_object' },
    messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, doc] }],
  });
  const raw = res.choices?.[0]?.message?.content;
  const content = typeof raw === 'string' ? raw : (raw || []).map((p) => p.text || '').join('');
  let parsed;
  try {
    parsed = Result.parse(JSON.parse(content));
  } catch {
    // model didn't return clean JSON: keep whatever it transcribed
    parsed = { text: content.trim(), title: '', category: '', documentDate: '', summary: '', labs: [] };
  }
  return {
    text: parsed.text.trim().slice(0, 60000),
    title: parsed.title.trim().slice(0, 120),
    category: RECORD_CATEGORIES.includes(parsed.category) ? parsed.category : '',
    documentDate: /^\d{4}-\d{2}-\d{2}$/.test(parsed.documentDate) ? parsed.documentDate : '',
    summary: parsed.summary.trim().slice(0, 1000),
    labs: parsed.labs
      .map((l) => ({ test: l.test.trim().slice(0, 80), value: toNumber(l.value), unit: l.unit.trim().slice(0, 20), range: l.range.trim().slice(0, 40), flag: /^[HL]$/i.test(l.flag.trim()) ? l.flag.trim().toUpperCase() : '' }))
      .filter((l) => l.test && l.value !== null)
      .slice(0, 80),
  };
};

const friendlyOcrError = (err) =>
  err?.statusCode === 429
    ? 'The AI reader is busy (free plan limit). Try again in a few seconds.'
    : 'Could not read this file automatically.';

module.exports = { ocrEnabled, extractDocument, friendlyOcrError };
