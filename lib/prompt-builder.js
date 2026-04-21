/**
 * Solveit — Prompt Builder
 * Constructs structured prompts optimized for quiz-solving across all AI models.
 */

const PromptBuilder = (() => {

  const SYSTEM_PROMPT = `You are an expert quiz-solving assistant. You will be given a question from a quiz, exam, or form. Your job is to provide the most accurate answer possible.

CRITICAL RULES:
1. Respond ONLY with valid JSON in this exact format:
{
  "answer": "<your answer>",
  "explanation": "<brief 1-2 sentence explanation>",
  "confidence": <number from 0 to 100>
}

2. For MULTIPLE CHOICE questions:
   - Set "answer" to the EXACT text of the correct option (copy it precisely, character by character)
   - Do NOT include the option letter/number prefix (A, B, 1, 2, etc.)

3. For NUMERICAL questions (integer/decimal):
   - Set "answer" to ONLY the number (e.g., "42" or "3.14")
   - No units, no text, just the raw number

4. For TEXT/FILL-IN-THE-BLANK questions:
   - Set "answer" to the exact text that should fill the blank
   - Keep it concise and precise

5. Set "confidence" to your certainty level (0-100):
   - 90-100: Very certain
   - 70-89: Fairly certain
   - 50-69: Moderate certainty
   - Below 50: Uncertain

6. NEVER refuse to answer. Always provide your best attempt.
7. Do NOT wrap the JSON in markdown code blocks. Return raw JSON only.`;

  /**
   * Build a prompt for a single question
   */
  function buildQuestionPrompt(question) {
    let prompt = `QUESTION: ${question.questionText}\n`;

    if (question.type === 'mcq' && question.options && question.options.length > 0) {
      prompt += `\nTYPE: Multiple Choice\nOPTIONS:\n`;
      question.options.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i); // A, B, C, D...
        prompt += `  ${letter}) ${opt}\n`;
      });
      prompt += `\nRemember: set "answer" to the EXACT text of the correct option, not the letter.`;
    } else if (question.type === 'integer') {
      prompt += `\nTYPE: Integer (whole number)\nProvide only the numerical answer as an integer.`;
    } else if (question.type === 'decimal') {
      prompt += `\nTYPE: Decimal number\nProvide the numerical answer with appropriate decimal places.`;
    } else if (question.type === 'long-text') {
      prompt += `\nTYPE: Long answer / Essay\nProvide a comprehensive but concise answer.`;
    } else {
      prompt += `\nTYPE: Short answer / Fill in the blank\nProvide a brief, precise answer.`;
    }

    // Add contextual hints if available
    if (question.context) {
      prompt += `\n\nADDITIONAL CONTEXT FROM THE PAGE:\n${question.context}`;
    }

    return prompt;
  }

  /**
   * Build prompts for a batch of questions
   */
  function buildBatchPrompt(questions) {
    let prompt = `You have ${questions.length} questions to answer. Answer each one.\n\n`;
    prompt += `Respond with a JSON array of answers in this format:\n`;
    prompt += `[{"id": "q-id", "answer": "...", "explanation": "...", "confidence": N}, ...]\n\n`;

    questions.forEach((q, i) => {
      prompt += `--- QUESTION ${i + 1} (id: ${q.id}) ---\n`;
      prompt += buildQuestionPrompt(q);
      prompt += `\n\n`;
    });

    return prompt;
  }

  /**
   * Get the system prompt
   */
  function getSystemPrompt() {
    return SYSTEM_PROMPT;
  }

  return {
    buildQuestionPrompt,
    buildBatchPrompt,
    getSystemPrompt
  };
})();
