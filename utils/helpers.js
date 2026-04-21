/**
 * Solveit — Shared Utilities
 * Common helper functions used across content scripts and background.
 */

const SolveitHelpers = (() => {
  /**
   * Generate a unique ID for questions
   */
  function generateId(prefix = 'q') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Normalize text for comparison (lowercase, trim, collapse whitespace)
   */
  function normalizeText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * Deep-clean HTML to extract pure question text
   */
  function extractText(element) {
    if (!element) return '';
    const clone = element.cloneNode(true);
    // Remove scripts, styles, hidden elements
    clone.querySelectorAll('script, style, [hidden], [aria-hidden="true"]').forEach(el => el.remove());
    return (clone.textContent || clone.innerText || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Determine question type from context clues
   */
  function inferQuestionType(questionText, inputElement) {
    if (!inputElement) return 'short-text';

    const tagName = inputElement.tagName.toLowerCase();
    const inputType = (inputElement.type || '').toLowerCase();

    // Check for MCQ indicators
    if (inputType === 'radio' || inputType === 'checkbox') return 'mcq';
    if (tagName === 'select') return 'mcq';

    // Check for number indicators
    if (inputType === 'number') {
      const step = inputElement.getAttribute('step');
      if (step && step.includes('.')) return 'decimal';
      return 'integer';
    }

    // Check question text for number clues
    const numberKeywords = /\b(how many|calculate|compute|total|sum|count|percentage|number of|value of|what is \d|find the|solve)\b/i;
    if (numberKeywords.test(questionText)) {
      if (/\b(decimal|fraction|percentage|ratio|rate|probability)\b/i.test(questionText)) {
        return 'decimal';
      }
      return 'integer';
    }

    // Long answer detection
    if (tagName === 'textarea') return 'long-text';
    const maxLength = parseInt(inputElement.getAttribute('maxlength') || '0', 10);
    if (maxLength > 200 || inputElement.rows > 2) return 'long-text';

    return 'short-text';
  }

  /**
   * Safe JSON parse with fallback
   */
  function safeJsonParse(str) {
    try {
      // Try direct parse
      return JSON.parse(str);
    } catch {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try { return JSON.parse(jsonMatch[1]); } catch { /* continue */ }
      }
      // Try finding JSON object in text
      const objMatch = str.match(/\{[\s\S]*\}/);
      if (objMatch) {
        try { return JSON.parse(objMatch[0]); } catch { /* continue */ }
      }
      return null;
    }
  }

  /**
   * Format elapsed time nicely
   */
  function formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  /**
   * Debounce helper
   */
  function debounce(fn, ms) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  }

  return {
    generateId,
    normalizeText,
    extractText,
    inferQuestionType,
    safeJsonParse,
    formatTime,
    debounce
  };
})();

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.SolveitHelpers = SolveitHelpers;
}
