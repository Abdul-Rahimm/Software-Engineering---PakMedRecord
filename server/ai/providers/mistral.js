// Mistral adapter (default). Free "Experiment" plan keys work; set MISTRAL_API_KEY.

const MODEL = process.env.AI_MODEL || 'mistral-small-latest';

// The SDK is ESM-only; load it lazily from this CommonJS server
let sdk;
const loadSdk = async () => {
  if (!sdk) {
    const [{ Mistral }, errors] = await Promise.all([import('@mistralai/mistralai'), import('@mistralai/mistralai/models/errors')]);
    sdk = {
      errors,
      client: new Mistral({
        apiKey: process.env.MISTRAL_API_KEY,
        // optional override, e.g. a proxy or a local test server
        ...(process.env.MISTRAL_SERVER_URL && { serverURL: process.env.MISTRAL_SERVER_URL }),
      }),
    };
  }
  return sdk;
};

const toolDefs = (tools) =>
  tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));

// Stream one chat completion; forwards text, accumulates tool calls (which may arrive in fragments)
const streamCompletion = async (request, signal, onText) => {
  const { client } = await loadSdk();
  const stream = await client.chat.stream(request, { signal });
  let text = '';
  let finishReason = null;
  const calls = [];
  for await (const event of stream) {
    const choice = event.data?.choices?.[0];
    if (!choice) continue;
    const { content, toolCalls } = choice.delta || {};
    if (typeof content === 'string' && content) {
      text += content;
      onText(content);
    } else if (Array.isArray(content)) {
      const piece = content.filter((c) => c.type === 'text').map((c) => c.text).join('');
      if (piece) {
        text += piece;
        onText(piece);
      }
    }
    (toolCalls || []).forEach((tc, i) => {
      const idx = tc.index ?? i;
      const slot = (calls[idx] ||= { id: '', type: 'function', function: { name: '', arguments: '' } });
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.function.name = tc.function.name;
      const args = tc.function?.arguments;
      if (typeof args === 'string') slot.function.arguments += args;
      else if (args && typeof args === 'object') slot.function.arguments = JSON.stringify(args);
    });
    if (choice.finishReason) finishReason = choice.finishReason;
  }
  return { text, finishReason, toolCalls: calls.filter(Boolean) };
};

const parseArgs = (raw) => {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return undefined; // runTool reports invalid input back to the model
  }
};

module.exports = {
  name: 'mistral',
  model: MODEL,
  enabled: () => Boolean(process.env.MISTRAL_API_KEY),

  async runTurn({ stable, context, history, tools, signal, onText }) {
    const { text, toolCalls } = await streamCompletion(
      {
        model: MODEL,
        // system prompt is rebuilt each request (it contains today's date), never stored in history
        messages: [{ role: 'system', content: `${stable}\n\n${context}` }, ...history],
        tools: toolDefs(tools),
        toolChoice: 'auto',
        temperature: 0.3,
        maxTokens: 4096,
      },
      signal,
      onText
    );
    const assistant = { role: 'assistant', content: text, ...(toolCalls.length && { toolCalls }) };
    if (!text && !toolCalls.length) assistant.content = 'Sorry, I could not produce an answer. Please rephrase your question.';
    return {
      append: [assistant],
      toolCalls: toolCalls.map((tc) => ({ id: tc.id, name: tc.function.name, input: parseArgs(tc.function.arguments) })),
    };
  },

  // Mistral expects one `tool` message per call, linked by toolCallId
  toolResultMessages: (results) =>
    results.map((r) => ({ role: 'tool', name: r.name, toolCallId: r.id, content: r.isError ? `Error: ${r.content}` : r.content })),

  refusalMessage: (text) => ({ role: 'assistant', content: text }),

  async generate({ system, prompt, signal, onText }) {
    await streamCompletion(
      { model: MODEL, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.3, maxTokens: 2048 },
      signal,
      onText
    );
    return { refusal: false };
  },

  isRetryable: () => false,

  friendlyError(err) {
    const errors = sdk?.errors;
    if (!errors) return null;
    if (err instanceof errors.MistralError) {
      if (err.statusCode === 401) return 'The AI service rejected our credentials. Check MISTRAL_API_KEY on the server.';
      if (err.statusCode === 429) return 'The free AI plan is rate-limited. Please wait a few seconds and try again.';
      return `The AI service returned an error (${err.statusCode}).`;
    }
    if (err instanceof errors.ConnectionError || err instanceof errors.RequestTimeoutError) {
      return 'Could not reach the AI service. Check the server\'s internet connection.';
    }
    return null;
  },
};
