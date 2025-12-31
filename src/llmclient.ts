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
    private readonly endpointUrl: string = "http://localhost:11434/api/chat",
    private readonly llamaModel: string = "llama3.1:8b",
    private readonly embeddingModel: string = "nomic-embed-text"
  ) {
    // Derive embeddings endpoint from chat endpoint
    const baseUrl = endpointUrl.replace(/\/v1\/chat\/completions$/, '');
    this.embeddingsUrl = `${baseUrl}/v1/embeddings`;
  }

  async chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<ChatResponse> {
    const body = {
      model: this.llamaModel,
      messages,
      temperature: opts?.temperature ?? 0.2,
      stream: false,  // Disable streaming for simpler parsing
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

    const text = await res.text();

    // Ollama returns newline-delimited JSON objects when streaming
    // Each line: {"message":{"content":"..."},"done":false}
    // Keep reading until done is true
    const lines = text.trim().split('\n');
    let fullContent = '';
    let lastJson: any = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const json = JSON.parse(line);
        lastJson = json;

        // Ollama format: message.content contains the chunk
        if (json.message?.content) {
          fullContent += json.message.content;
        }

        // Stop when done is true
        if (json.done === true) {
          break;
        }
      } catch (e) {
        // If parsing fails, might be OpenAI format - try that
        const json = extractJsonObject(text);
        const content = json?.choices?.[0]?.message?.content ?? "";
        return { content, raw: json };
      }
    }

    return { content: fullContent, raw: lastJson };
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

