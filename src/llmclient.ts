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

export interface LlmClient {
  chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<ChatResponse>;
}

export class LlmClientLlama implements LlmClient {
  chat(messages: ChatMessage[], opts?: { temperature?: number; }): Promise<ChatResponse> {
    throw new Error("Method not implemented.");
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
