// Claude (Anthropic) adapter. Paid; enable with AI_PROVIDER=anthropic and ANTHROPIC_API_KEY.

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
// Opt into server-side refusal fallbacks: a declined request is retried on Anthropic's recommended model
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

let client;
const getClient = () => {
  if (!client) client = new Anthropic();
  return client;
};

const toolDefs = (tools) =>
  tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters, eager_input_streaming: true }));

const systemBlocks = (stable, context) => [
  { type: 'text', text: stable, cache_control: { type: 'ephemeral' } },
  { type: 'text', text: context },
];

const stream = (params, signal, onText) => {
  const s = getClient().beta.messages.stream({ betas: [FALLBACK_BETA], fallbacks: 'default', ...params }, { signal });
  s.on('text', onText);
  return s.finalMessage();
};

module.exports = {
  name: 'anthropic',
  model: MODEL,
  // The SDK resolves credentials from ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN
  enabled: () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),

  // One model turn. Returns the message(s) to append and any tool calls to run.
  async runTurn({ stable, context, history, tools, signal, onText }) {
    const final = await stream(
      { model: MODEL, max_tokens: 32000, output_config: { effort: 'medium' }, system: systemBlocks(stable, context), tools: toolDefs(tools), messages: history },
      signal,
      onText
    );
    if (final.stop_reason === 'refusal') return { refusal: true };
    const content = JSON.parse(JSON.stringify(final.content));
    const toolCalls = final.stop_reason === 'tool_use'
      ? content.filter((b) => b.type === 'tool_use').map((b) => ({ id: b.id, name: b.name, input: b.input }))
      : [];
    return { append: [{ role: 'assistant', content }], toolCalls };
  },

  // All results of one turn go back in a single user message
  toolResultMessages: (results) => [{
    role: 'user',
    content: results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content, ...(r.isError && { is_error: true }) })),
  }],

  refusalMessage: (text) => ({ role: 'assistant', content: [{ type: 'text', text }] }),

  async generate({ system, prompt, effort, signal, onText }) {
    const final = await stream(
      { model: MODEL, max_tokens: 16000, output_config: { effort }, system, messages: [{ role: 'user', content: prompt }] },
      signal,
      onText
    );
    return { refusal: final.stop_reason === 'refusal' };
  },

  // One-shot JSON answer (no streaming)
  async completeJSON({ system, prompt, maxTokens = 4000 }) {
    const msg = await getClient().messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: `${system}\nRespond with a single JSON object and nothing else.`,
      messages: [{ role: 'user', content: prompt }],
    });
    return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  },

  // With eager input streaming a tool input can arrive as unparseable JSON: worth re-issuing the turn
  isRetryable: (err) => !(err instanceof Anthropic.APIError),

  friendlyError(err) {
    if (err instanceof Anthropic.AuthenticationError) return 'The AI service rejected our credentials. Check ANTHROPIC_API_KEY on the server.';
    if (err instanceof Anthropic.RateLimitError) return 'The AI assistant is busy right now. Please try again in a moment.';
    if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the AI service. Check the server\'s internet connection.';
    if (err instanceof Anthropic.APIError) return `The AI service returned an error (${err.status}).`;
    return null;
  },
};
