export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    var body = await request.json();
    var useWebSearch = body.useWebSearch;
    var system = body.system;
    var messages = body.messages;

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY manquante cote serveur" },
        { status: 500 }
      );
    }

    var payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: messages,
    };

    if (system) {
      payload.system = system;
    }

    if (useWebSearch) {
      payload.tools = [{ type: "web_search_20250305", name: "web_search" }];
    }

    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });

    var data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", response.status, data);
      var errMsg = "Anthropic API error " + response.status;
      if (data.error && data.error.message) {
        errMsg = data.error.message;
      }
      return Response.json({ error: errMsg }, { status: response.status });
    }

    var blocks = data.content || [];
    var text = "";
    for (var i = 0; i < blocks.length; i++) {
      if (blocks[i].type === "text") {
        text = text + blocks[i].text;
      }
    }

    return Response.json({ content: [{ type: "text", text: text }] });

  } catch (err) {
    console.error("Route /api/claude crash:", err);
    return Response.json(
      { error: "Erreur serveur : " + err.message },
      { status: 500 }
    );
  }
}
