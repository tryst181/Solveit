/**
 * Solveit — Anthropic Claude Provider Adapter
 * Uses Claude's unique /v1/messages API format with x-api-key header.
 */

class ClaudeProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = config.name || 'claude';
    this.displayName = config.displayName || 'Claude (Anthropic)';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
    this.model = config.model || 'claude-sonnet-4-20250514';
  }

  async query(systemPrompt, userPrompt) {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/v1/messages`;

    const body = {
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1
    };

    const data = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    const content = data.content?.[0]?.text || '';
    return this._parseResponse(content);
  }

  _parseResponse(content) {
    const parsed = this._safeJsonParse(content);
    if (parsed && parsed.answer !== undefined) {
      return {
        answer: String(parsed.answer),
        explanation: parsed.explanation || '',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 70,
        provider: this.displayName
      };
    }

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
