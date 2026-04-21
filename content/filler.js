/**
 * Solveit — Answer Filler v2
 * Handles both:
 *  - FORM-BASED quizzes: clicks radio buttons, fills text inputs
 *  - ARTICLE-BASED quizzes: overlays correct answers visually on the page
 *
 * Uses batch-fill (all at once, no flickering).
 * One-time fill with user-edit protection.
 */

const SolveitFiller = (() => {

  const FILLED_ATTR = 'data-Solveit-filled';
  const EDITED_ATTR = 'data-Solveit-edited';
  const ANSWER_ATTR = 'data-Solveit-answer';

  /**
   * Fill all answers in a batch
   * @param {Array} solvedQuestions - [{question, result}]
   * @returns {number} count of filled questions
   */
  function fillAll(solvedQuestions) {
    const operations = [];

    solvedQuestions.forEach(({ question, result }) => {
      if (!result || !result.finalAnswer) return;
      if (question.container?.getAttribute(EDITED_ATTR) === 'true') return;
      if (question.container?.getAttribute(FILLED_ATTR) === 'true') return;
      operations.push({ question, result });
    });

    // Execute all fills
    let filledCount = 0;
    operations.forEach(({ question, result }) => {
      try {
        if (question.isArticleQuiz) {
          // Article-based quiz: overlay answer visually
          fillArticleQuestion(question, result);
        } else if (question.type === 'mcq') {
          fillMCQ(question, result.finalAnswer);
        } else {
          fillTextInput(question, result.finalAnswer);
        }

        // Mark as filled
        if (question.container) {
          question.container.setAttribute(FILLED_ATTR, 'true');
          question.container.setAttribute(ANSWER_ATTR, result.finalAnswer);
        }
        question.filled = true;
        filledCount++;

        // Add visual feedback
        addSuccessOverlay(question, result);

        // Watch for user edits (only for form-based)
        if (!question.isArticleQuiz && question.inputElement) {
          watchForEdits(question);
        }
      } catch (err) {
        console.warn(`[Solveit] Failed to fill Q${question.questionNum || question.index}: ${err.message}`);
        addErrorOverlay(question, err.message);
      }
    });

    return filledCount;
  }

  /**
   * ARTICLE QUIZ: Overlay the correct answer directly on the page
   * For sites like Sanfoundry where there are no form elements
   */
  function fillArticleQuestion(question, result) {
    if (!question.container) return;

    // Find where to insert the answer overlay
    // Look for the question text element
    const target = question.container;

    // Create answer overlay
    const overlay = document.createElement('div');
    overlay.className = 'Solveit-answer-overlay';

    const confidence = result.confidence || 0;
    const confClass = confidence >= 85 ? 'high' : confidence >= 60 ? 'medium' : 'low';

    // For MCQ: highlight the correct option letter
    let answerDisplay = result.finalAnswer;
    if (question.type === 'mcq' && question.options.length > 0) {
      // Find which option matches
      const normalizedAnswer = result.finalAnswer.trim().toLowerCase();
      let matchIdx = -1;

      for (let i = 0; i < question.options.length; i++) {
        const opt = question.options[i].trim().toLowerCase();
        if (opt === normalizedAnswer || opt.includes(normalizedAnswer) || normalizedAnswer.includes(opt)) {
          matchIdx = i;
          break;
        }
      }

      // Also try matching by option letter
      if (matchIdx === -1 && /^[a-d]$/i.test(result.finalAnswer.trim())) {
        matchIdx = result.finalAnswer.trim().toLowerCase().charCodeAt(0) - 97;
      }

      if (matchIdx >= 0 && matchIdx < question.options.length) {
        const letter = String.fromCharCode(65 + matchIdx);
        answerDisplay = `${letter}) ${question.options[matchIdx]}`;

        // Try to highlight the option in the DOM
        highlightOptionInDOM(question, matchIdx);
      }
    }

    // Build the overlay HTML
    overlay.innerHTML = `
      <div class="Solveit-answer-badge ${confClass}">
        <span class="Solveit-answer-label">✓ Answer:</span>
        <span class="Solveit-answer-text">${escapeHtml(answerDisplay)}</span>
        <span class="Solveit-answer-conf">${confidence}%</span>
      </div>
      ${result.explanations && result.explanations.length > 0 ? `
        <div class="Solveit-explanation">
          ${result.explanations.slice(0, 2).map(e =>
            `<span class="Solveit-expl-item" title="${escapeHtml(e.explanation || '')}">
              ${escapeHtml(e.provider)}: ${escapeHtml((e.explanation || '').slice(0, 100))}
            </span>`
          ).join('')}
        </div>
      ` : ''}
    `;

    // Insert after the question container or at its end
    target.style.position = target.style.position || 'relative';
    target.appendChild(overlay);
  }

  /**
   * Highlight the correct option in the page DOM for article quizzes
   */
  function highlightOptionInDOM(question, optionIndex) {
    if (!question.container) return;

    const letter = String.fromCharCode(97 + optionIndex); // a, b, c, d
    const letterUpper = letter.toUpperCase();

    // Search for text nodes containing the option
    const walker = document.createTreeWalker(
      question.container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.trim();

      // Match "a) option text" or "A. option text"
      if (text.match(new RegExp(`^${letter}\\s*[.):\\-]`, 'i'))) {
        const parent = node.parentElement;
        if (parent) {
          parent.style.background = 'rgba(34, 197, 94, 0.15)';
          parent.style.borderRadius = '4px';
          parent.style.padding = '2px 4px';
          parent.style.fontWeight = '700';
          parent.style.color = '#22c55e';
          parent.style.transition = 'all 0.3s ease';
        }
        break;
      }
    }
  }

  /**
   * FORM QUIZ: Fill a text/number input
   */
  function fillTextInput(question, answer) {
    const el = question.inputElement;
    if (!el) return;

    // Handle contenteditable elements
    if (el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox') {
      el.focus();
      el.textContent = answer;
      el.innerHTML = answer;
      dispatchEvents(el);
      return;
    }

    // Standard input/textarea — use native setter to bypass React
    el.focus();

    const nativeInputSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement?.prototype || HTMLInputElement.prototype, 'value'
    )?.set;
    const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement?.prototype || HTMLTextAreaElement.prototype, 'value'
    )?.set;

    if (el.tagName === 'TEXTAREA' && nativeTextAreaSetter) {
      nativeTextAreaSetter.call(el, answer);
    } else if (nativeInputSetter) {
      nativeInputSetter.call(el, answer);
    } else {
      el.value = answer;
    }

    dispatchEvents(el);
  }

  /**
   * FORM QUIZ: Fill an MCQ (select the correct option)
   */
  function fillMCQ(question, answer) {
    if (question.isDropdown) {
      fillDropdown(question, answer);
      return;
    }

    const normalizedAnswer = answer.trim().toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    question.options.forEach((opt, idx) => {
      const normalizedOpt = opt.trim().toLowerCase();
      let score = 0;

      if (normalizedOpt === normalizedAnswer) score = 100;
      else if (normalizedOpt.includes(normalizedAnswer) || normalizedAnswer.includes(normalizedOpt)) score = 80;
      else {
        const optWords = new Set(normalizedOpt.split(/\s+/));
        const ansWords = normalizedAnswer.split(/\s+/);
        const overlap = ansWords.filter(w => optWords.has(w)).length;
        score = (overlap / Math.max(ansWords.length, 1)) * 60;
      }

      if (score > bestScore) { bestScore = score; bestMatch = idx; }
    });

    if (bestMatch !== null && question.optionElements[bestMatch]) {
      const element = question.optionElements[bestMatch];
      element.focus();

      const clickTarget = element.closest('[role="radio"], [role="checkbox"]') || element;
      clickTarget.click();
      if (element !== clickTarget) element.click();
      if (element.type === 'radio' || element.type === 'checkbox') element.checked = true;

      dispatchEvents(element);
    }
  }

  /**
   * Fill a dropdown
   */
  function fillDropdown(question, answer) {
    const el = question.inputElement;
    const normalizedAnswer = answer.trim().toLowerCase();

    if (el.tagName === 'SELECT') {
      const options = Array.from(el.options);
      const match = options.find(opt =>
        opt.textContent.trim().toLowerCase() === normalizedAnswer ||
        opt.value.toLowerCase() === normalizedAnswer
      );
      if (match) { el.value = match.value; dispatchEvents(el); }
    } else {
      el.click();
      setTimeout(() => {
        const bestOption = question.optionElements.find((opt, idx) =>
          question.options[idx]?.trim().toLowerCase() === normalizedAnswer
        );
        if (bestOption) bestOption.click();
      }, 200);
    }
  }

  /**
   * Dispatch events for framework reactivity
   */
  function dispatchEvents(el) {
    ['input', 'change', 'blur'].forEach(type => {
      el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
    });
    try {
      el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: el.value || el.textContent }));
    } catch { /* */ }
    try {
      el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Unidentified' }));
      el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' }));
    } catch { /* */ }
  }

  /**
   * Watch for user edits after filling
   */
  function watchForEdits(question) {
    const el = question.inputElement;
    if (!el) return;

    const handler = () => {
      if (question.container) {
        question.container.setAttribute(EDITED_ATTR, 'true');
        const badge = question.container.querySelector('.Solveit-badge');
        if (badge) { badge.textContent = '✏️ Edited'; badge.className = 'Solveit-badge Solveit-badge-edited'; }
      }
      el.removeEventListener('input', handler);
      el.removeEventListener('change', handler);
    };

    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  }

  /**
   * Add success overlay
   */
  function addSuccessOverlay(question, result) {
    if (!question.container) return;

    // For article quizzes, the overlay is already added by fillArticleQuestion
    if (question.isArticleQuiz) return;

    const existing = question.container.querySelector('.Solveit-overlay');
    if (existing) existing.remove();

    question.container.classList.add('Solveit-filled');

    const badge = document.createElement('div');
    badge.className = 'Solveit-badge';
    const confidence = result.confidence || 0;
    badge.classList.add(confidence >= 85 ? 'Solveit-badge-high' : confidence >= 60 ? 'Solveit-badge-medium' : 'Solveit-badge-low');
    badge.innerHTML = `<span class="Solveit-badge-icon">✓</span><span class="Solveit-badge-text">${confidence}% · ${result.consensusType || 'AI'}</span>`;

    if (result.explanations?.length > 0) {
      badge.title = result.explanations.map(e => `${e.provider}: ${e.explanation}`).join('\n');
    }

    question.container.style.position = question.container.style.position || 'relative';
    question.container.appendChild(badge);
  }

  /**
   * Add error overlay
   */
  function addErrorOverlay(question, message) {
    if (!question.container) return;
    question.container.classList.add('Solveit-error');
    const badge = document.createElement('div');
    badge.className = 'Solveit-badge Solveit-badge-error';
    badge.innerHTML = `<span class="Solveit-badge-icon">⚠</span><span class="Solveit-badge-text">Error</span>`;
    badge.title = message;
    question.container.style.position = question.container.style.position || 'relative';
    question.container.appendChild(badge);
  }

  /**
   * Clear all fills
   */
  function clearOverlays() {
    document.querySelectorAll('.Solveit-filled').forEach(el => el.classList.remove('Solveit-filled'));
    document.querySelectorAll('.Solveit-error').forEach(el => el.classList.remove('Solveit-error'));
    document.querySelectorAll('.Solveit-badge').forEach(el => el.remove());
    document.querySelectorAll('.Solveit-answer-overlay').forEach(el => el.remove());
    document.querySelectorAll(`[${FILLED_ATTR}]`).forEach(el => el.removeAttribute(FILLED_ATTR));
    document.querySelectorAll(`[${EDITED_ATTR}]`).forEach(el => el.removeAttribute(EDITED_ATTR));
    document.querySelectorAll(`[${ANSWER_ATTR}]`).forEach(el => el.removeAttribute(ANSWER_ATTR));
    // Reset any highlighted options
    document.querySelectorAll('[style*="rgb(34, 197, 94)"]').forEach(el => {
      el.style.background = '';
      el.style.fontWeight = '';
      el.style.color = '';
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  return { fillAll, clearOverlays };
})();

if (typeof window !== 'undefined') {
  window.SolveitFiller = SolveitFiller;
}
