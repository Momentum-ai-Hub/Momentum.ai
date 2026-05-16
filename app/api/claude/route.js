export async function POST(request) {
  const body = await request.json();
  
  const payload = {
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    ...body,
  };

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
  return Response.json(data);
}
