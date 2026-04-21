/**
 * Solveit — OpenAI-Compatible Provider Adapter
 * Handles: OpenAI, DeepSeek, Grok (xAI), Groq, GLM, and any custom OpenAI-compatible endpoint.
 */

class OpenAICompatProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  async query(systemPrompt, userPrompt) {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 1024
    };

    // Groq-specific: some models need slightly different params
    if (this.baseUrl.includes('groq.com')) {
      body.temperature = 0.0;
    }

    const data = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    const content = data.choices?.[0]?.message?.content || '';
    return this._parseResponse(content);
  }

  _parseResponse(content) {
    // Try to parse structured JSON response
    const parsed = this._safeJsonParse(content);
    if (parsed && parsed.answer !== undefined) {
      return {
        answer: String(parsed.answer),
        explanation: parsed.explanation || '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 70,
        provider: this.displayName
      };
    }

    // Fallback: use raw text as answer
    return {
      answer: content.trim(),
      explanation: '',
      confidence: 50,
      provider: this.displayName
    };
  }

  _safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch {
      const jsonMatch = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try { return JSON.parse(jsonMatch[1]); } catch { /* */ }
      }
      const objMatch = str.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { return JSON.parse(objMatch[0]); } catch { /* */ }
      }
      return null;
    }
  }
}

// Pre-configured provider factory
const OPENAI_COMPAT_PRESETS = {
  openai: {
    name: 'openai',
    displayName: 'ChatGPT (OpenAI)',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    icon: '🟢'
  },
  deepseek: {
    name: 'deepseek',
    displayName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    icon: '🔵'
  },
  grok: {
    name: 'grok',
    displayName: 'Grok (xAI)',
    baseUrl: 'https://api.x.ai/v1',
    model: 'grok-3-mini',
    icon: '⚡'
  },
  groq: {
    name: 'groq',
    displayName: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    icon: '🟠'
  },
  glm: {
    name: 'glm',
    displayName: 'GLM (ZhipuAI)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    icon: '🟣'
  }
};
