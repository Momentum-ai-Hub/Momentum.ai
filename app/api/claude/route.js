export async function POST(request) {
  const body = await request.json();
  const { useWebSearch, ...claudeBody } = body;

  const payload = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
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

  // Extraire le texte même si Claude a utilisé le web search (multiple content blocks)
  const text = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n');

  return Response.json({ ...data, content: [{ type: 'text', text }] });
}
