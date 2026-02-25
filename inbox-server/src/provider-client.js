function buildMockAtoms(items, count) {
  if (!items.length) {
    return [];
  }

  const atoms = [];
  const target = Math.max(Math.min(count * 2, 30), 1);
  for (let i = 0; i < target; i += 1) {
    const item = items[i % items.length];
    const note = String(item.note ?? "").trim();
    const firstTag = (item.tags ?? [])[0] ?? "insight";
    atoms.push({
      hook: `Angle ${i + 1}: ${item.title}`,
      thesis: note || `Use this ${firstTag} idea in your next post.`,
      evidence_snippet: note || item.title,
      tone: "practical",
      audience: "creators",
      reusable_sentence: `Turn "${item.title}" into one sharp takeaway.`,
      source_item_ids: [item.id],
      confidence: 0.55,
    });
  }
  return atoms;
}

async function generateWithOpenAI({ items, params, model }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY is required.");
    error.code = "PROVIDER_ERROR";
    throw error;
  }

  const endpoint = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/chat/completions";
  const payload = {
    model: model.model,
    temperature: model.temperature ?? 0.7,
    messages: [
      {
        role: "system",
        content:
          "Generate concise content atoms in JSON array format. Do not include markdown fences.",
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "Generate content atoms",
            goal: params.goal,
            novelty: params.novelty,
            count: params.count,
            schema: [
              "hook",
              "thesis",
              "evidence_snippet",
              "tone",
              "audience",
              "reusable_sentence",
              "source_item_ids",
            ],
            items: items.map((item) => ({
              id: item.id,
              title: item.title,
              note: item.note,
              tags: item.tags,
              source: item.source,
            })),
          },
          null,
          2
        ),
      },
    ],
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`OpenAI provider failed: ${response.status} ${text}`);
    error.code = "PROVIDER_ERROR";
    throw error;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error("OpenAI provider returned empty content.");
    error.code = "PROVIDER_ERROR";
    throw error;
  }

  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (Array.isArray(parsed.atoms)) {
      return parsed.atoms;
    }
  } catch {
    // fallthrough
  }

  const error = new Error("OpenAI provider output is not valid JSON atoms.");
  error.code = "PROVIDER_ERROR";
  throw error;
}

export function createDefaultProviderRegistry() {
  return {
    mock: {
      async generateAtoms({ items, params }) {
        return buildMockAtoms(items, params.count ?? 15);
      },
    },
    openai: {
      async generateAtoms(input) {
        return generateWithOpenAI(input);
      },
    },
  };
}

export function getProviderClient(providerName, registry) {
  return registry[providerName] ?? null;
}
