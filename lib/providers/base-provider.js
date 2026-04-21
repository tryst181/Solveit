/**
 * Solveit — Base Provider Interface
 * Abstract class that all AI provider adapters must implement.
 */

class BaseProvider {
  constructor(config) {
    this.name = config.name || 'Unknown';
    this.displayName = config.displayName || this.name;
    this.apiKey = config.apiKey || '';
    this.model = config.model || '';
    this.baseUrl = config.baseUrl || '';
    this.enabled = config.enabled !== false;
    this.timeout = config.timeout || 15000;
  }

  /**
   * Check if this provider is properly configured
   */
  isConfigured() {
    return !!(this.apiKey && this.model && this.enabled);
  }

  /**
   * Query the AI model with a prompt
   * @param {string} systemPrompt - System-level instructions
   * @param {string} userPrompt - The question/task
   * @returns {Promise<{answer: string, explanation: string, confidence: number, provider: string}>}
   */
  async query(systemPrompt, userPrompt) {
    throw new Error('query() must be implemented by subclass');
  }

  /**
   * Test connection to the provider
   * @returns {Promise<{success: boolean, message: string, latency: number}>}
   */
  async testConnection() {
    const start = Date.now();
    try {
      const result = await this.query(
        'You are a test assistant. Respond briefly.',
        'Say "connected" and nothing else.'
      );
      return {
        success: true,
        message: `Connected! Model: ${this.model}`,
        latency: Date.now() - start
      };
    } catch (err) {
      return {
        success: false,
        message: err.message || 'Connection failed',
        latency: Date.now() - start
      };
    }
  }

  /**
   * Helper: fetch with timeout
   */
  async fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(
          `${this.displayName} API error ${response.status}: ${errorBody.slice(0, 200)}`
        );
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`${this.displayName} timed out after ${this.timeout / 1000}s`);
      }
      throw err;
    }
  }
}
