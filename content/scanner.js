/**
 * Solveit — Question Scanner v2
 * Completely rewritten for robust question detection.
 * 
 * Supports THREE paradigms:
 *  1. FORM-BASED: Google Forms, MS Forms, standard HTML forms (radio/checkbox/input)
 *  2. ARTICLE-BASED: Sanfoundry, GeeksForGeeks, IndiaBIX — questions in plain text
 *  3. GENERIC: Any page with numbered question patterns
 *
 * Strategy: First scrape ALL visible text from the page, then use regex to
 * extract question blocks, then map them back to DOM elements for filling.
 */

const SolveitScanner = (() => {

  /**
   * Main entry: detect page type and scan accordingly
   */
  function scanPage() {
    const url = window.location.href;

    // Try form-based first (Google Forms, etc.)
    if (url.includes('docs.google.com/forms')) {
      const results = scanGoogleForms();
      if (results.length > 0) return results;
    }

    if (url.includes('forms.office.com') || url.includes('forms.microsoft.com')) {
      const results = scanMicrosoftForms();
      if (results.length > 0) return results;
    }

    // Try standard HTML form elements
    const formResults = scanStandardForms();
    if (formResults.length > 0) return formResults;

    // Fallback: Article-based / text-based quiz scanning (Sanfoundry, GFG, etc.)
    return scanArticleQuiz();
  }

  // ================================================================
  // ARTICLE-BASED QUIZ SCANNER (Sanfoundry, GFG, IndiaBIX, etc.)
  // This is the most important scanner — handles plain-text quizzes
  // ================================================================

  function scanArticleQuiz() {
    // Step 1: Get the main content container
    const contentContainer = findContentContainer();
    if (!contentContainer) return [];

    // Step 2: Get the full rendered text (using innerText which respects <br> as \n)
    const fullText = contentContainer.innerText;

    // Step 3: Split into question blocks using regex
    const questionBlocks = extractQuestionBlocks(fullText);
    if (questionBlocks.length === 0) return [];

    // Step 4: For each question, find its DOM location and build question objects
    const questions = [];
    questionBlocks.forEach((block, index) => {
      const question = buildQuestionFromBlock(block, contentContainer, index);
      if (question) questions.push(question);
    });

    return questions;
  }

  /**
   * Find the main content container on the page
   */
  function findContentContainer() {
    // Try common content selectors in priority order
    const selectors = [
      'div.entry-content',          // WordPress / Sanfoundry
      'article .entry-content',
      'div.article-content',
      'div.post-content',
      'article',
      'div.content',
      'main',
      'div#content',
      'div.quiz-content',
      'div.question-container',
      'div.test-content',
      'div[role="main"]',
      'div.td-post-content',        // More WordPress themes
      'div.page-content',
      'div.single-content',
      'section.content',
      'div.the_content',
      'div.entry',
      'body'                         // Last resort
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.length > 200) {
        return el;
      }
    }

    return document.body;
  }

  /**
   * Extract question blocks from full page text using regex patterns
   */
  function extractQuestionBlocks(fullText) {
    const blocks = [];

    // Pattern: Questions starting with "1.", "2.", etc. or "Q1.", "Q.1", "Question 1"
    // This regex splits text at question number boundaries
    const questionPattern = /(?:^|\n)\s*(?:Q\.?\s*)?(\d{1,3})\s*[.):\-]\s*/gm;

    const matches = [...fullText.matchAll(questionPattern)];

    if (matches.length < 2) {
      // Try alternative patterns
      return extractQuestionBlocksAlt(fullText);
    }

    for (let i = 0; i < matches.length; i++) {
      const startIdx = matches[i].index;
      const endIdx = i + 1 < matches.length ? matches[i + 1].index : fullText.length;
      const blockText = fullText.substring(startIdx, endIdx).trim();
      const questionNum = parseInt(matches[i][1], 10);

      const parsed = parseQuestionBlock(blockText, questionNum);
      if (parsed) blocks.push(parsed);
    }

    return blocks;
  }

  /**
   * Alternative extraction for pages without standard numbering
   */
  function extractQuestionBlocksAlt(fullText) {
    const blocks = [];

    // Try splitting by "Question X" pattern
    const altPattern = /(?:^|\n)\s*Question\s+(\d+)\s*[.:)?\-]?\s*/gmi;
    const matches = [...fullText.matchAll(altPattern)];

    if (matches.length >= 2) {
      for (let i = 0; i < matches.length; i++) {
        const startIdx = matches[i].index;
        const endIdx = i + 1 < matches.length ? matches[i + 1].index : fullText.length;
        const blockText = fullText.substring(startIdx, endIdx).trim();
        const parsed = parseQuestionBlock(blockText, parseInt(matches[i][1], 10));
        if (parsed) blocks.push(parsed);
      }
    }

    return blocks;
  }

  /**
   * Parse a single question block into structured data
   * Input: "1. What is the formula of sulphuric acid?\na) H2SO4\nb) H2SO3\nc) HNO3\nd) HCl\nAnswer: a"
   */
  function parseQuestionBlock(blockText, questionNum) {
    const lines = blockText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return null;

    // First line(s) = question text (before options start)
    let questionText = '';
    let optionStartIdx = -1;

    // Find where options start — look for a), b), c) or A), B), C) patterns
    const optionPattern = /^[a-dA-D]\s*[.):\-]/;

    for (let i = 0; i < lines.length; i++) {
      if (optionPattern.test(lines[i])) {
        optionStartIdx = i;
        break;
      }
    }

    if (optionStartIdx <= 0) {
      // No clear options — might be a fill-in-the-blank or single-line question
      // Take the first line as question
      questionText = lines[0].replace(/^\s*(?:Q\.?\s*)?\d{1,3}\s*[.):\-]\s*/, '').trim();

      // Check if there's an "Answer:" line
      const answerLine = lines.find(l => /^(?:Answer|Ans|View Answer|Correct Answer)\s*[.:]/i.test(l));

      return {
        questionNum,
        questionText,
        options: [],
        type: 'short-text',
        rawText: blockText,
        existingAnswer: answerLine ? answerLine.replace(/^(?:Answer|Ans|View Answer|Correct Answer)\s*[.:]\s*/i, '').trim() : null
      };
    }

    // Build question text from lines before options
    questionText = lines.slice(0, optionStartIdx).join(' ')
      .replace(/^\s*(?:Q\.?\s*)?\d{1,3}\s*[.):\-]\s*/, '')
      .trim();

    // Extract options
    const options = [];
    for (let i = optionStartIdx; i < lines.length; i++) {
      const line = lines[i];

      // Stop if we hit "Answer:", "Explanation:", "View Answer", etc.
      if (/^(?:Answer|Ans|Explanation|View Answer|Correct Answer|Solution|Note|Hint|Advertisement)\s*[.:]/i.test(line)) {
        break;
      }
      if (/^(?:advertisement|sanfoundry|participate|become a)/i.test(line)) {
        break;
      }

      // Check if this is an option line
      const optionMatch = line.match(/^[a-dA-D]\s*[.):\-]\s*(.*)/);
      if (optionMatch) {
        options.push(optionMatch[1].trim());
      } else if (options.length > 0) {
        // Continuation of previous option (multi-line option)
        options[options.length - 1] += ' ' + line;
      }
    }

    // Determine type
    let type = 'short-text';
    if (options.length >= 2) {
      type = 'mcq';
    }

    // Check for existing answer on page
    const answerLine = lines.find(l => /^(?:Answer|Ans|Correct Answer)\s*[.:]/i.test(l));
    let existingAnswer = null;
    if (answerLine) {
      existingAnswer = answerLine.replace(/^(?:Answer|Ans|Correct Answer)\s*[.:]\s*/i, '').trim();
    }

    if (!questionText || questionText.length < 5) return null;

    return {
      questionNum,
      questionText,
      options,
      type,
      rawText: blockText,
      existingAnswer
    };
  }

  /**
   * Build a full question object with DOM references
   */
  function buildQuestionFromBlock(block, contentContainer, index) {
    // Find the DOM element(s) that contain this question
    const domInfo = findQuestionInDOM(block, contentContainer);

    return {
      id: SolveitHelpers.generateId('q'),
      type: block.type,
      questionText: block.questionText,
      options: block.options,
      inputElement: domInfo.inputElement,
      optionElements: domInfo.optionElements,
      container: domInfo.container,
      filled: false,
      isArticleQuiz: true,
      questionNum: block.questionNum,
      existingAnswer: block.existingAnswer,
      index
    };
  }

  /**
   * Find DOM elements corresponding to a question block
   */
  function findQuestionInDOM(block, contentContainer) {
    // Search for the question text in the DOM
    const allElements = contentContainer.querySelectorAll('p, div, li, span, td, h3, h4, h5, h6');
    let container = null;
    let bestMatch = null;
    let bestScore = 0;

    // Normalize question text for matching
    const normalizedQ = block.questionText.toLowerCase().replace(/\s+/g, ' ').slice(0, 60);

    for (const el of allElements) {
      const elText = (el.innerText || el.textContent || '').toLowerCase().replace(/\s+/g, ' ');

      if (elText.includes(normalizedQ)) {
        const score = normalizedQ.length / Math.max(elText.length, 1);
        if (score > bestScore || !bestMatch) {
          bestScore = score;
          bestMatch = el;
        }
      }
    }

    if (bestMatch) {
      // The container is the element or its parent
      container = bestMatch.closest('div, section, article, li, tr') || bestMatch.parentElement || bestMatch;
    } else {
      // Fallback: use the content container itself
      container = contentContainer;
    }

    // Look for interactive elements near this question
    let inputElement = null;
    const optionElements = [];

    if (container) {
      // Check for radio buttons / checkboxes
      const radios = container.querySelectorAll('input[type="radio"]');
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      const textInputs = container.querySelectorAll('input[type="text"], input[type="number"], textarea');

      if (radios.length > 0) {
        inputElement = radios[0];
        radios.forEach(r => optionElements.push(r));
      } else if (checkboxes.length > 0) {
        inputElement = checkboxes[0];
        checkboxes.forEach(c => optionElements.push(c));
      } else if (textInputs.length > 0) {
        inputElement = textInputs[0];
      }

      // For article-based quizzes: look for "View Answer" buttons
      const viewAnswerBtn = container.querySelector('.collapseomatic, [class*="view-answer"], [class*="show-answer"], button, .toggle-answer');
      if (viewAnswerBtn && !inputElement) {
        inputElement = viewAnswerBtn; // We'll use this as a reference point
      }
    }

    return { container, inputElement, optionElements };
  }

  // ================================================================
  // GOOGLE FORMS SCANNER
  // ================================================================

  function scanGoogleForms() {
    const questions = [];
    const containers = document.querySelectorAll(
      '[role="listitem"], .Qr7Oae, .freebirdFormviewerComponentsQuestionBaseRoot'
    );

    containers.forEach((container, index) => {
      const question = extractGoogleFormQuestion(container, index);
      if (question) questions.push(question);
    });

    // Fallback: try through all form content
    if (questions.length === 0) {
      const formContent = document.querySelector('[role="list"]') || document.querySelector('form');
      if (formContent) {
        const inputs = formContent.querySelectorAll('input, textarea, select');
        inputs.forEach((input, index) => {
          const q = extractQuestionFromInput(input, index);
          if (q) questions.push(q);
        });
      }
    }

    return questions;
  }

  function extractGoogleFormQuestion(container, index) {
    let questionText = '';
    const textSelectors = [
      '[role="heading"]', '.M7eMe',
      '.freebirdFormviewerComponentsQuestionBaseTitle',
      '[data-params] span', '.HoXoMd'
    ];

    for (const sel of textSelectors) {
      const el = container.querySelector(sel);
      if (el) {
        questionText = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        if (questionText.length > 2) break;
      }
    }

    if (!questionText || questionText.length < 3) return null;

    // MCQ detection
    const radioInputs = container.querySelectorAll('[role="radio"], input[type="radio"]');
    const checkboxInputs = container.querySelectorAll('[role="checkbox"], input[type="checkbox"]');

    if (radioInputs.length > 0 || checkboxInputs.length > 0) {
      const isMulti = checkboxInputs.length > 0;
      const allInputs = isMulti ? checkboxInputs : radioInputs;
      const options = [];
      const optionElements = [];

      allInputs.forEach(input => {
        let optionText = '';
        const label = input.closest('[role="radio"], [role="checkbox"], label, .docssharedWizToggleLabeledLabelWrapper');
        if (label) {
          const textEl = label.querySelector('.docssharedWizToggleLabeledLabelText, span[dir], .ulDsOb') || label;
          optionText = (textEl.innerText || textEl.textContent || '').trim();
        }
        if (!optionText) optionText = input.getAttribute('aria-label') || input.getAttribute('data-answer-value') || input.value || '';
        if (optionText) {
          options.push(optionText.trim());
          optionElements.push(input);
        }
      });

      return {
        id: SolveitHelpers.generateId('q'), type: 'mcq', questionText, options,
        inputElement: allInputs[0], optionElements, container, filled: false,
        isMultiSelect: isMulti, index
      };
    }

    // Text input
    const textInput = container.querySelector('input[type="text"], input:not([type]), textarea, [contenteditable="true"], [role="textbox"]');
    if (textInput) {
      return {
        id: SolveitHelpers.generateId('q'),
        type: SolveitHelpers.inferQuestionType(questionText, textInput),
        questionText, options: [], inputElement: textInput, optionElements: [],
        container, filled: false, index
      };
    }

    return null;
  }

  // ================================================================
  // MICROSOFT FORMS SCANNER
  // ================================================================

  function scanMicrosoftForms() {
    const questions = [];
    const containers = document.querySelectorAll('[data-automation-id="questionItem"], .office-form-question-content');
    containers.forEach((container, index) => {
      const titleEl = container.querySelector('[data-automation-id="questionTitle"], .question-title-box');
      const questionText = titleEl ? (titleEl.innerText || '').trim() : '';
      if (!questionText) return;

      const radios = container.querySelectorAll('input[type="radio"]');
      const checks = container.querySelectorAll('input[type="checkbox"]');
      const textInput = container.querySelector('input[type="text"], textarea');

      if (radios.length > 0 || checks.length > 0) {
        const inputs = radios.length > 0 ? radios : checks;
        const options = [], optionElements = [];
        inputs.forEach(input => {
          const label = container.querySelector(`label[for="${input.id}"]`) || input.closest('label');
          options.push(label ? (label.innerText || '').trim() : input.value);
          optionElements.push(input);
        });
        questions.push({
          id: SolveitHelpers.generateId('q'), type: 'mcq', questionText, options,
          inputElement: inputs[0], optionElements, container, filled: false, index
        });
      } else if (textInput) {
        questions.push({
          id: SolveitHelpers.generateId('q'),
          type: SolveitHelpers.inferQuestionType(questionText, textInput),
          questionText, options: [], inputElement: textInput, optionElements: [],
          container, filled: false, index
        });
      }
    });
    return questions;
  }

  // ================================================================
  // STANDARD FORM SCANNER (any page with <form> + inputs)
  // ================================================================

  function scanStandardForms() {
    const questions = [];

    // Try fieldset+legend
    document.querySelectorAll('fieldset').forEach((fieldset, index) => {
      const legend = fieldset.querySelector('legend');
      if (!legend) return;
      const questionText = (legend.innerText || '').trim();
      if (!questionText || questionText.length < 3) return;

      const radios = fieldset.querySelectorAll('input[type="radio"]');
      const checks = fieldset.querySelectorAll('input[type="checkbox"]');
      const textInput = fieldset.querySelector('input[type="text"], input[type="number"], textarea');

      if (radios.length > 0 || checks.length > 0) {
        const inputs = radios.length > 0 ? radios : checks;
        const options = [], optionElements = [];
        inputs.forEach(input => {
          const label = fieldset.querySelector(`label[for="${input.id}"]`) || input.closest('label');
          options.push(label ? (label.innerText || '').trim() : input.value);
          optionElements.push(input);
        });
        questions.push({
          id: SolveitHelpers.generateId('q'), type: 'mcq', questionText, options,
          inputElement: inputs[0], optionElements, container: fieldset, filled: false, index
        });
      } else if (textInput) {
        questions.push({
          id: SolveitHelpers.generateId('q'),
          type: SolveitHelpers.inferQuestionType(questionText, textInput),
          questionText, options: [], inputElement: textInput, optionElements: [],
          container: fieldset, filled: false, index
        });
      }
    });

    if (questions.length > 0) return questions;

    // Try label+input associations
    const processedInputs = new Set();
    document.querySelectorAll('label').forEach((label, index) => {
      const forId = label.getAttribute('for');
      const input = forId ? document.getElementById(forId) : label.querySelector('input, textarea, select');
      if (!input || processedInputs.has(input)) return;
      processedInputs.add(input);

      const questionText = (label.innerText || '').trim();
      if (!questionText || questionText.length < 3) return;

      if (input.tagName === 'SELECT') {
        const options = [], optionElements = [];
        input.querySelectorAll('option').forEach(opt => {
          if (opt.value) { options.push(opt.textContent.trim()); optionElements.push(opt); }
        });
        questions.push({
          id: SolveitHelpers.generateId('q'), type: 'mcq', questionText, options,
          inputElement: input, optionElements,
          container: label.closest('div, li, tr') || label.parentElement,
          filled: false, isDropdown: true, index
        });
      } else {
        questions.push({
          id: SolveitHelpers.generateId('q'),
          type: SolveitHelpers.inferQuestionType(questionText, input),
          questionText, options: [], inputElement: input, optionElements: [],
          container: label.closest('div, li, tr') || label.parentElement,
          filled: false, index
        });
      }
    });

    return questions;
  }

  function extractQuestionFromInput(input, index) {
    const container = input.closest('div, li, tr, td, p') || input.parentElement;
    if (!container) return null;

    const textSelectors = ['h1','h2','h3','h4','h5','h6','label','legend','p','.question-text','strong','b'];
    let questionText = '';
    for (const sel of textSelectors) {
      const el = container.querySelector(sel);
      if (el) {
        questionText = (el.innerText || '').trim();
        if (questionText.length >= 5) break;
      }
    }
    if (!questionText || questionText.length < 5) return null;

    return {
      id: SolveitHelpers.generateId('q'),
      type: SolveitHelpers.inferQuestionType(questionText, input),
      questionText, options: [], inputElement: input, optionElements: [],
      container, filled: false, index
    };
  }

  return { scanPage };
})();

if (typeof window !== 'undefined') {
  window.SolveitScanner = SolveitScanner;
}
