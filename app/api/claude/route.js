export const maxDuration = 60;
export const dynamic = ‘force-dynamic’;

export async function POST(request) {
try {
const body = await request.json();
const { useWebSearch, …claudeBody } = body;

```
if (!process.env.ANTHROPIC_API_KEY) {
  return Response.json(
    { error: 'ANTHROPIC_API_KEY manquante côté serveur (vérifier Vercel env vars)' },
    { status: 500 }
  );
}

const payload = {
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  ...claudeBody,
};

if (useWebSearch) {
  payload.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
}

const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify(payload),
});

const data = await response.json();

// Si Anthropic renvoie une erreur (4xx/5xx), la faire remonter clairement
if (!response.ok) {
  console.error('Anthropic API error:', response.status, data);
  return Response.json(
    { error: data.error?.message || ('Anthropic API error ' + response.status), details: data },
    { status: response.status }
  );
}

// Extraire le texte même si Claude a utilisé le web search (multiple content blocks)
const text = (data.content || [])
  .filter(b => b.type === 'text')
  .map(b => b.text)
  .join('\n');

return Response.json({ ...data, content: [{ type: 'text', text }] });
```

} catch (err) {
console.error(‘Route /api/claude crash:’, err);
return Response.json(
{ error: ’Erreur serveur : ’ + err.message },
{ status: 500 }
);
}
}
