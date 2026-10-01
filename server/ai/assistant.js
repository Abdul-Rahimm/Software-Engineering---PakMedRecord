// PakMedRecord AI assistant: Claude with role-scoped tools, streamed to the browser over SSE.

const Anthropic = require('@anthropic-ai/sdk');
const ChatThread = require('../models/ChatThreadModel');
const Patient = require('../models/PatientModel');
const Doctor = require('../models/DoctorModel');
const { toolDefinitions, runTool, TOOL_LABELS } = require('./tools');

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
const MAX_TOOL_ROUNDS = 8;
// Opt into server-side refusal fallbacks: a declined request is retried on Anthropic's recommended model
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

// The SDK resolves credentials from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN (or an `ant auth login` profile)
const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client;
const getClient = () => {
  if (!client) client = new Anthropic();
  return client;
};

// ---------- prompts (stable text first so it can be cached) ----------

const SAFETY = `Safety rules (always apply):
- You are not a doctor and must not diagnose, prescribe, or change anyone's treatment. Explain, summarise and help people prepare for conversations with their doctor.
- If someone describes possible emergency symptoms (chest pain, trouble breathing, signs of stroke, severe bleeding, suicidal thoughts, loss of consciousness, a severe allergic reaction), tell them to call Rescue 1122 or go to the nearest emergency department now, before anything else.
- Never invent records, values, dates or doctors. If the data isn't in the tools' results, say you don't see it.`;

const PATIENT_SYSTEM = `You are PakMed Assistant, the health assistant inside PakMedRecord, a Pakistani platform where each patient keeps one verified medical record across hospitals.

You help the signed-in patient understand their own health information and get things done in the app. Use your tools to look things up instead of guessing: their health profile, verified records, submissions awaiting review, appointments, logged vitals, care team, and the doctor directory.

You can also take a few actions for them: book an appointment with a doctor in their care team, log a vital-sign reading, and save a private note. Before booking, propose the exact doctor, date and time (check availability first) and wait for the patient to confirm. Only log readings or save notes the patient explicitly gave you. They can only book with doctors already in their care team; if they need a new doctor, suggest a few from search_doctors and tell them to add one from the Find doctors page.

${SAFETY}

Style: warm, clear and brief. Use plain language and explain medical terms. Use short paragraphs or bullet lists; use **bold** for key facts. Reply in the language the patient writes in (English or Urdu, including Roman Urdu). Dates are in Pakistan time.`;

const DOCTOR_SYSTEM = `You are PakMed Assistant, a clinical assistant for doctors inside PakMedRecord, a Pakistani platform where patients keep one verified medical record across hospitals.

You help the signed-in doctor work faster: look up their schedule, their review queue, and the full history of patients who have added them to their care team. Use your tools rather than guessing. You can only see patients affiliated with this doctor.

${SAFETY.replace("You are not a doctor and must not diagnose, prescribe, or change anyone's treatment. Explain, summarise and help people prepare for conversations with their doctor.", 'Support the doctor\'s clinical judgement; do not present suggestions as decisions. Flag important things such as allergies, interactions and abnormal vitals, and say how confident you are.')}

Style: concise and clinical. Lead with the answer, then supporting details. Use bullet lists and **bold** for critical items (allergies, abnormal values). Use dates.`;

const contextBlock = async (user) => {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' });
  const iso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const person = user.role === 'doctor'
    ? await Doctor.findOne({ doctorCNIC: user.cnic })
    : await Patient.findOne({ patientCNIC: user.cnic });
  const name = person ? `${user.role === 'doctor' ? 'Dr. ' : ''}${person.firstName} ${person.lastName}` : 'the user';
  return `Today is ${today} (${iso}). You are talking with ${name}${user.role === 'doctor' && person?.specialization ? `, ${person.specialization}` : ''}.`;
};

const systemFor = async (user) => [
  { type: 'text', text: user.role === 'doctor' ? DOCTOR_SYSTEM : PATIENT_SYSTEM, cache_control: { type: 'ephemeral' } },
  { type: 'text', text: await contextBlock(user) },
];

// ---------- SSE helpers ----------

const openStream = (res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  return (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
};

const friendlyError = (err) => {
  if (err instanceof Anthropic.AuthenticationError) return 'The AI service rejected our credentials. Check ANTHROPIC_API_KEY on the server.';
  if (err instanceof Anthropic.RateLimitError) return 'The AI assistant is busy right now. Please try again in a moment.';
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the AI service. Check the server\'s internet connection.';
  if (err instanceof Anthropic.APIError) return `The AI service returned an error (${err.status}).`;
  return 'Something went wrong while generating a reply.';
};

const REFUSAL_TEXT = "I'm not able to help with that request. If this is about your health, please speak to your doctor.";

// Stream one model turn, forwarding text deltas. Returns the final message.
const streamTurn = async ({ send, params, signal }) => {
  const stream = getClient().beta.messages.stream(
    { betas: [FALLBACK_BETA], fallbacks: 'default', ...params },
    { signal }
  );
  stream.on('text', (text) => send({ type: 'text', text }));
  return stream.finalMessage();
};

// ---------- chat with tools ----------

const chat = async ({ user, threadId, message, res }) => {
  const send = openStream(res);
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  try {
    let thread = threadId ? await ChatThread.findOne({ _id: threadId, role: user.role, cnic: user.cnic }) : null;
    if (!thread) {
      thread = await ChatThread.create({ role: user.role, cnic: user.cnic, title: message.slice(0, 60) });
    }
    send({ type: 'thread', threadId: String(thread._id), title: thread.title });

    // Append-only history: we only ever push to it, never edit earlier turns
    const messages = [...thread.messages, { role: 'user', content: message }];
    const tools = toolDefinitions(user.role);
    const system = await systemFor(user);
    let jsonRetries = 0;

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      let final;
      send({ type: 'turn' });
      try {
        final = await streamTurn({
          send,
          signal: abort.signal,
          params: {
            model: MODEL,
            max_tokens: 32000,
            output_config: { effort: 'medium' },
            system,
            tools,
            messages,
          },
        });
        jsonRetries = 0;
      } catch (err) {
        // With eager input streaming a tool input can arrive as unparseable JSON: re-issue the turn
        if (!(err instanceof Anthropic.APIError) && !abort.signal.aborted && jsonRetries++ < 2) {
          send({ type: 'reset' });
          continue;
        }
        throw err;
      }

      const content = JSON.parse(JSON.stringify(final.content));

      if (final.stop_reason === 'refusal') {
        send({ type: 'text', text: REFUSAL_TEXT });
        messages.push({ role: 'assistant', content: [{ type: 'text', text: REFUSAL_TEXT }] });
        break;
      }

      messages.push({ role: 'assistant', content });

      const toolUses = content.filter((b) => b.type === 'tool_use');
      if (final.stop_reason !== 'tool_use' || toolUses.length === 0) break;

      if (round === MAX_TOOL_ROUNDS) {
        send({ type: 'text', text: '\n\nI had to stop here because this needed too many steps. Could you narrow the question down?' });
        break;
      }

      // Run every tool call from this turn, then return all results in one user message
      const results = [];
      for (const tu of toolUses) {
        send({ type: 'tool', name: tu.name, label: TOOL_LABELS[tu.name] || tu.name });
        const { isError, content: out } = await runTool(user.role, tu.name, tu.input, user);
        send({ type: 'tool_done', name: tu.name, ok: !isError, mutated: ['book_appointment', 'log_vital', 'add_note'].includes(tu.name) && !isError });
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: out, ...(isError && { is_error: true }) });
      }
      messages.push({ role: 'user', content: results });
    }

    thread.messages = messages;
    thread.markModified('messages');
    await thread.save();
    send({ type: 'done' });
  } catch (err) {
    if (!abort.signal.aborted) {
      console.error('AI chat failed:', err);
      send({ type: 'error', error: friendlyError(err) });
    }
  } finally {
    res.end();
  }
};

// ---------- single-shot streamed generations (no tools) ----------

const generate = async ({ res, system, prompt, effort = 'low' }) => {
  const send = openStream(res);
  const abort = new AbortController();
  res.on('close', () => abort.abort());
  try {
    const final = await streamTurn({
      send,
      signal: abort.signal,
      params: {
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort },
        system,
        messages: [{ role: 'user', content: prompt }],
      },
    });
    if (final.stop_reason === 'refusal') send({ type: 'text', text: REFUSAL_TEXT });
    send({ type: 'done' });
  } catch (err) {
    if (!abort.signal.aborted) {
      console.error('AI generation failed:', err);
      send({ type: 'error', error: friendlyError(err) });
    }
  } finally {
    res.end();
  }
};

const EXPLAIN_SYSTEM = `You explain medical records to patients in PakMedRecord, in plain, friendly language.
Structure: a one-sentence summary; "What this means" (2-4 bullets explaining terms, values and medicines); "Questions you could ask your doctor" (2-3 bullets).
${SAFETY}
Keep it under 220 words. Don't speculate beyond what the record says. If the record mentions a medicine, explain what it's commonly used for in general terms only.`;

const SUMMARY_SYSTEM = `You write pre-consultation briefs for doctors in PakMedRecord from a patient's verified record.
Structure with short headings: **Snapshot** (age, sex, blood group, key conditions), **Alerts** (allergies, possible interactions, abnormal or worsening vitals; write "None found" if none), **History** (chronological, one line per relevant record), **Current medications**, **Suggested follow-ups** (things worth checking, phrased as considerations, not orders).
Be concise and factual; cite dates. Never invent data. If information is missing, say so briefly.`;

module.exports = { aiEnabled, chat, generate, EXPLAIN_SYSTEM, SUMMARY_SYSTEM, MODEL };
