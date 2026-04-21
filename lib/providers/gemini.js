/**
 * Solveit — Google Gemini Provider Adapter
 * Uses the generativelanguage REST API (unique format, not OpenAI-compatible).
 */

class GeminiProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.name = config.name || 'gemini';
    this.displayName = config.displayName || 'Gemini (Google)';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.model = config.model || 'gemini-2.0-flash';
  }

  async query(systemPrompt, userPrompt) {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\n---\n\n${userPrompt}` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        topP: 0.95
      }
    };

    const data = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
