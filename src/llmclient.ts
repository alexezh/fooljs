// ----------------------------
// 2) REST Chat API client (OpenAI-compatible style)
// ----------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  content: string;
  raw?: any;
}

export interface EmbeddingResponse {
  embedding: number[];
  raw?: any;
}

export interface LlmClient {
  chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<ChatResponse>;
  embed?(text: string): Promise<EmbeddingResponse>;
}

/**
 * LlmClientLlama: client for llama.cpp server with OpenAI-compatible API
 * Default chat endpoint: http://localhost:8080/v1/chat/completions
 * Default embeddings endpoint: http://localhost:8080/v1/embeddings
 */
export class LlmClientLlama implements LlmClient {
  private readonly embeddingsUrl: string;

  constructor(
    private readonly endpointUrl: string = "http://localhost:8080/v1/chat/completions",
    private readonly model: string = "llama",
    private readonly embeddingModel: string = "nomic-embed-text"
  ) {
    // Derive embeddings endpoint from chat endpoint
    const baseUrl = endpointUrl.replace(/\/v1\/chat\/completions$/, '');
    this.embeddingsUrl = `${baseUrl}/v1/embeddings`;
  }

  async chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<ChatResponse> {
    const body = {
      model: this.model,
      messages,
      temperature: opts?.temperature ?? 0.2,
    };

    const res = await fetch(this.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM chat failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    // OpenAI-compatible: json.choices[0].message.content
    const content = json?.choices?.[0]?.message?.content ?? "";
    return { content, raw: json };
  }

  async embed(text: string): Promise<EmbeddingResponse> {
    const body = {
      model: this.embeddingModel,
      input: text,
    };

    const res = await fetch(this.embeddingsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM embed failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    // OpenAI-compatible: json.data[0].embedding
    const embedding = json?.data?.[0]?.embedding ?? [];
    return { embedding, raw: json };
  }
}

export class LlmClientGpt implements LlmClient {
  constructor(
    private readonly endpointUrl: string,
    private readonly apiKey: string,
    private readonly model: string
  ) { }

  async chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<ChatResponse> {
    const body = {
      model: this.model,
      messages,
      temperature: opts?.temperature ?? 0.2,
    };

    const res = await fetch(this.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM chat failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    // OpenAI-ish: json.choices[0].message.content
    const content = json?.choices?.[0]?.message?.content ?? "";
    return { content, raw: json };
  }
}

export function extractJsonObject(text: string): any {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in LLM response:\n${text}`);
  }
  return JSON.parse(raw.slice(start, end + 1));
}

