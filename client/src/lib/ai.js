import { getSession } from '../session';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3009';

// POST to an AI endpoint and read its Server-Sent Events stream.
// onEvent receives each parsed event ({ type: 'text' | 'tool' | 'done' | 'error' | ... }).
export const streamAI = async (path, body, onEvent, signal) => {
  const session = getSession();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session && { Authorization: `Bearer ${session.token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      /* not JSON */
    }
    onEvent({ type: 'error', error: message, status: res.status });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data: '));
      if (line) {
        try {
          onEvent(JSON.parse(line.slice(6)));
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  }
};
