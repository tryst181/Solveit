/**
 * Solveit — Content Script v7
 * 
 * SMART CAPTURE + FILL:
 * 1. Detect all question groups (radio sets, inputs) in the DOM FIRST
 * 2. Format them as structured Q&A for the AI (so it knows what's a question vs option)
 * 3. AI answers each question
 * 4. Click/fill the correct answer
 * 5. Only a tiny toast. Zero other UI on the page.
 */

(() => {
  let isProcessing = false;

  const handler = (message, sender, sendResponse) => {
    switch (message.action) {
      case 'solve': handleSolve(sendResponse); return true;
      case 'clear': clearAll(); sendResponse({ success: true }); return false;
      case 'getStatus': sendResponse({ isProcessing, hasFilled: false }); return false;
    }
  };
  
  if (!window.__SolveitListenerAdded) {
    chrome.runtime.onMessage.addListener(handler);
    window.__SolveitListenerAdded = true;
  }

  async function handleSolve(sendResponse) {
    if (isProcessing) { sendResponse({ success: false, error: 'Already processing.' }); return; }
    isProcessing = true;
    showToast('🔄 Scanning page...');

    try {
      // STEP 1: Detect question groups in the DOM
      const groups = detectQuestionGroups();
      console.log('[Solveit] Detected', groups.length, 'question groups');

      // STEP 2: Build structured prompt
      let pageText;
      if (groups.length > 0) {
        pageText = buildStructuredCapture(groups);
      } else {
        pageText = captureRawText();
      }

      if (pageText.length < 20) {
        isProcessing = false;
        showToast('❌ No quiz content found');
        sendResponse({ success: false, error: 'No quiz content found.' });
        return;
      }

      // STEP 2.5: Capture images from the page (diagrams, figures, equations)
      showToast('📸 Capturing images...');
      const images = captureImages();
      console.log('[Solveit] Captured', images.length, 'images');

      showToast('🧠 AI solving...');

      // STEP 3: Send to AI (with images)
      const aiResponse = await chrome.runtime.sendMessage({
        action: 'processPage',
        pageText,
        pageUrl: window.location.href,
        pageTitle: document.title,
        images
      });

      if (!aiResponse?.success) {
        isProcessing = false;
        showToast('❌ ' + (aiResponse?.error || 'Failed'));
        sendResponse({ success: false, error: aiResponse?.error || 'AI failed' });
        return;
      }

      // STEP 4: Fill answers
      showToast('✍️ Filling answers...');
      let filledCount = 0;

      if (groups.length > 0) {
        filledCount = fillStructured(groups, aiResponse.answers);
      } else {
        filledCount = fillDirect(aiResponse.answers);
      }

      isProcessing = false;
      showToast(`✅ Done! Filled ${filledCount}/${aiResponse.answers.length}`);

      sendResponse({
        success: true,
        filledCount,
        totalQuestions: aiResponse.answers.length,
        answers: aiResponse.answers
      });

    } catch (err) {
      isProcessing = false;
      console.error('[Solveit]', err);
      showToast('❌ ' + err.message);
      sendResponse({ success: false, error: err.message });
    }
  }

  // ================================================================
  // CAPTURE IMAGES from the page (diagrams, graphs, equations)
  // ================================================================
  function captureImages() {
    const images = [];
    const maxImages = 8;
    const minSize = 50; // Skip tiny icons

    // Find all meaningful images on the page
    const imgElements = document.querySelectorAll('img, svg, canvas, [style*="background-image"]');

    for (const el of imgElements) {
      if (images.length >= maxImages) break;

      try {
        if (el.tagName === 'IMG') {
          // Skip tiny images (icons, spacers)
          if (el.naturalWidth < minSize || el.naturalHeight < minSize) continue;
          if (el.width < minSize || el.height < minSize) continue;
          // Skip tracking pixels and ads
          const src = el.src || '';
          if (src.includes('pixel') || src.includes('tracking') || src.includes('ad.') || src.includes('analytics')) continue;

          const dataUrl = imgToBase64(el);
          if (dataUrl) {
            images.push({ dataUrl, desc: el.alt || 'Question image' });
          }
        }
        else if (el.tagName === 'CANVAS') {
          try {
            const dataUrl = el.toDataURL('image/jpeg', 0.85);
            if (dataUrl && dataUrl.length > 100) {
              images.push({ dataUrl, desc: 'Canvas diagram' });
            }
          } catch {}
        }
      } catch (err) {
        // Cross-origin images will fail — skip
      }
    }

    return images;
  }

  /**
   * Convert an <img> element to base64 data URL via canvas
   */
  function imgToBase64(img) {
    try {
      const canvas = document.createElement('canvas');
      // Limit size to save bandwidth
      const maxDim = 800;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch {
      return null; // Cross-origin etc
    }
  }

  // ================================================================
  // DETECT ALL QUESTION GROUPS IN THE DOM
  // ================================================================
  function detectQuestionGroups() {
    const groups = [];
    const claimed = new Set();

    // --- 1. Standard radio groups (by name) ---
    const allRadios = [...document.querySelectorAll('input[type="radio"]')];
    const radioByName = {};
    allRadios.forEach(r => {
      const n = r.getAttribute('name') || '__unnamed_' + Math.random();
      if (!radioByName[n]) radioByName[n] = [];
      radioByName[n].push(r);
    });

    for (const [name, radios] of Object.entries(radioByName)) {
      if (radios.length < 2) continue;
      const container = commonParent(radios);
      groups.push({
        type: 'radio',
        radios,
        options: radios.map(r => ({ el: r, text: radioLabel(r) })),
        questionText: getQuestionText(container, radios),
        container
      });
      radios.forEach(r => claimed.add(r));
    }

    // --- 2. Aria radiogroups (Google Forms, custom UIs) ---
    document.querySelectorAll('[role="radiogroup"]').forEach(rg => {
      const items = [...rg.querySelectorAll('[role="radio"]')];
      if (items.length < 2) return;
      groups.push({
        type: 'aria-radio',
        options: items.map(el => ({ el, text: elText(el) })),
        questionText: getQuestionText(rg.parentElement || rg, items),
        container: rg
      });
    });

    // --- 3. Clickable option divs/spans (cliffsnotes, custom quizzes) ---
    if (groups.length === 0) {
      // Look for sets of clickable elements that look like quiz options
      const optionSels = [
        '.quiz-choice', '.quiz-option', '.answer-choice', '.option-item',
        '[data-answer]', '[data-option]', '.choice-item',
        '.quiz_choices li', '.answers li', '.options li'
      ];

      for (const sel of optionSels) {
        const opts = [...document.querySelectorAll(sel)];
        if (opts.length >= 2) {
          const container = commonParent(opts);
          groups.push({
            type: 'clickable',
            options: opts.map(el => ({ el, text: elText(el) })),
            questionText: getQuestionText(container, opts),
            container
          });
          break;
        }
      }
    }

    // --- 4. Infer from page structure: adjacent elements that look like options ---
    if (groups.length === 0) {
      // Look for a series of short text elements that might be clickable options
      const candidates = [...document.querySelectorAll('li a, .answer a, div[onclick], span[onclick], button:not([type="submit"])')];
      const quizLike = candidates.filter(el => {
        const t = elText(el);
        return t.length > 0 && t.length < 100;
      });
      if (quizLike.length >= 2 && quizLike.length <= 10) {
        const container = commonParent(quizLike);
        groups.push({
          type: 'clickable',
          options: quizLike.map(el => ({ el, text: elText(el) })),
          questionText: getQuestionText(container, quizLike),
          container
        });
      }
    }

    // --- 5. Text inputs / number inputs ---
    document.querySelectorAll('input[type="text"], input[type="number"], input[type="tel"], input:not([type]):not([role]):not([hidden]), textarea').forEach(inp => {
      if (claimed.has(inp) || inp.offsetParent === null) return;
      if (['hidden', 'submit', 'button', 'search'].includes(inp.type)) return;
      const container = inp.closest('div, fieldset, li, tr, td, section') || inp.parentElement;
      groups.push({
        type: 'text-input',
        input: inp,
        questionText: getQuestionText(container, [inp]),
        container
      });
    });

    // --- 6. Select dropdowns ---
    document.querySelectorAll('select').forEach(sel => {
      const container = sel.closest('div, fieldset, li, tr, td') || sel.parentElement;
      groups.push({
        type: 'select',
        input: sel,
        options: [...sel.options].filter(o => o.value).map(o => ({ el: o, text: o.textContent.trim() })),
        questionText: getQuestionText(container, [sel]),
        container
      });
    });

    return groups;
  }

  // ================================================================
  // BUILD STRUCTURED CAPTURE — Clear Q&A format for AI
  // ================================================================
  function buildStructuredCapture(groups) {
    let capture = `PAGE: ${document.title}\nURL: ${window.location.href}\n\n`;
    capture += `This page has ${groups.length} question(s). Here they are:\n\n`;

    groups.forEach((g, i) => {
      capture += `=== QUESTION ${i + 1} ===\n`;
      capture += `Question text: ${g.questionText || '[no text detected — look at the options to infer the question]'}\n`;

      if (g.options && g.options.length > 0) {
        capture += `Type: Multiple choice\n`;
        capture += `Options:\n`;
        g.options.forEach((opt, j) => {
          capture += `  ${String.fromCharCode(65 + j)}) ${opt.text}\n`;
        });
      } else if (g.type === 'text-input') {
        capture += `Type: Text/Number input (type your answer)\n`;
      } else if (g.type === 'select') {
        capture += `Type: Dropdown select\n`;
        if (g.options) g.options.forEach((opt, j) => {
          capture += `  ${String.fromCharCode(65 + j)}) ${opt.text}\n`;
        });
      }
      capture += '\n';
    });

    // Also capture surrounding context that might have instructions
    const pageContext = captureRawText();
    if (pageContext.length > 0) {
      capture += `\n--- FULL PAGE CONTEXT (for instructions, formulas, etc.) ---\n${pageContext}\n`;
    }

    return capture;
  }

  // ================================================================
  // RAW TEXT CAPTURE (fallback for article quizzes)
  // ================================================================
  function captureRawText() {
    const sels = ['form', 'main', 'article', '[role="main"]', '.entry-content', '.quiz-content', '#content', '.content', 'body'];
    let el = null;
    for (const s of sels) { const f = document.querySelector(s); if (f?.innerText?.length > 50) { el = f; break; } }
    if (!el) el = document.body;
    let text = el.innerText.replace(/\n{4,}/g, '\n\n').trim();
    if (text.length > 20000) text = text.substring(0, 20000);
    return text;
  }

  // ================================================================
  // FILL STRUCTURED — match AI answers to detected groups by index
  // ================================================================
  function fillStructured(groups, answers) {
    let filled = 0;

    groups.forEach((group, idx) => {
      // Match answer by index (since we formatted questions by index)
      const answer = answers[idx];
      if (!answer) return;

      const answerText = (answer.answer || '').trim();
      if (!answerText) return;

      console.log(`[Solveit] Q${idx+1}: "${group.questionText?.slice(0,40)}" → "${answerText}"`);

      let success = false;

      if (group.type === 'radio') {
        success = selectBestOption(group.options, answerText, (opt) => {
          opt.el.checked = true;
          opt.el.click();
          dispatch(opt.el);
          // Click label too
          const label = opt.el.closest('label') || document.querySelector(`label[for="${opt.el.id}"]`);
          if (label) label.click();
        });
      }

      else if (group.type === 'aria-radio') {
        success = selectBestOption(group.options, answerText, (opt) => {
          opt.el.click();
          try { opt.el.setAttribute('aria-checked', 'true'); } catch {}
        });
      }

      else if (group.type === 'clickable') {
        success = selectBestOption(group.options, answerText, (opt) => {
          opt.el.click();
        });
      }

      else if (group.type === 'text-input') {
        setInput(group.input, answerText);
        success = true;
      }

      else if (group.type === 'select') {
        success = selectBestOption(group.options, answerText, (opt) => {
          group.input.value = opt.el.value;
          dispatch(group.input);
        });
      }

      if (success) {
        filled++;
        console.log(`[Solveit] ✅ Q${idx+1} filled`);
      } else {
        console.warn(`[Solveit] ⚠️ Q${idx+1} could not fill "${answerText}"`);
      }
    });

    return filled;
  }

  // ================================================================
  // FILL DIRECT — fallback for unstructured pages
  // ================================================================
  function fillDirect(answers) {
    let filled = 0;

    // Collect all interactive elements
    const allRadios = [...document.querySelectorAll('input[type="radio"]')];
    const allAriaRadios = [...document.querySelectorAll('[role="radio"]')];

    answers.forEach((item) => {
      const answer = (item.answer || '').trim();
      if (!answer) return;

      // Try radios
      const normAnswer = answer.toLowerCase();
      let best = null, bestScore = 0;

      allRadios.forEach(r => {
        const label = radioLabel(r).toLowerCase();
        const score = matchScore(label, normAnswer);
        if (score > bestScore) { bestScore = score; best = r; }
      });

      if (best && bestScore >= 0.3) {
        best.checked = true; best.click(); dispatch(best);
        filled++;
        return;
      }

      // Try aria radios
      allAriaRadios.forEach(el => {
        const text = elText(el).toLowerCase();
        const score = matchScore(text, normAnswer);
        if (score > bestScore) { bestScore = score; best = el; }
      });

      if (best && bestScore >= 0.3) {
        best.click();
        filled++;
      }
    });

    return filled;
  }

  // ================================================================
  // SELECT BEST MATCHING OPTION
  // ================================================================
  function selectBestOption(options, answerText, doSelect) {
    const norm = answerText.toLowerCase().trim();
    let best = null, bestScore = 0;

    options.forEach(opt => {
      const score = matchScore(opt.text.toLowerCase().trim(), norm);
      if (score > bestScore) { bestScore = score; best = opt; }
    });

    if (best && bestScore >= 0.2) {
      doSelect(best);
      return true;
    }

    // Fallback: try partial word match
    options.forEach(opt => {
      const optNorm = opt.text.toLowerCase().replace(/[^\w\s.-]/g, '').trim();
      const ansNorm = norm.replace(/[^\w\s.-]/g, '').trim();
      if (optNorm === ansNorm || optNorm.includes(ansNorm) || ansNorm.includes(optNorm)) {
        if (!best || opt.text.length < best.text.length) { best = opt; }
      }
    });

    if (best) { doSelect(best); return true; }

    console.warn(`[Solveit] No match for "${answerText}" in options:`, options.map(o => o.text));
    return false;
  }

  // ================================================================
  // HELPERS
  // ================================================================
  function commonParent(elements) {
    if (elements.length === 0) return document.body;
    let p = elements[0].parentElement;
    for (let d = 0; d < 12 && p; d++) {
      if ([...elements].every(el => p.contains(el))) return p;
      p = p.parentElement;
    }
    return elements[0].closest('form, div, section') || document.body;
  }

  function getQuestionText(container, interactiveEls) {
    if (!container) return '';

    // Get ALL text in the container, then subtract option text
    const fullText = (container.innerText || '').trim();
    const optionTexts = interactiveEls.map(el => {
      if (el.tagName === 'INPUT') return radioLabel(el);
      return elText(el);
    });

    // Remove option texts from full text to isolate the question
    let qText = fullText;
    optionTexts.forEach(ot => {
      if (ot) qText = qText.replace(ot, '');
    });

    // Clean up
    qText = qText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();

    // If question text is too short, try looking at preceding siblings/elements
    if (qText.length < 5) {
      let prev = container.previousElementSibling;
      for (let i = 0; i < 3 && prev; i++) {
        const t = (prev.innerText || '').trim();
        if (t.length >= 5 && t.length <= 500) return t;
        prev = prev.previousElementSibling;
      }
      // Try parent's text
      const parentText = (container.parentElement?.innerText || '').trim();
      if (parentText.length > fullText.length) {
        let diff = parentText;
        optionTexts.forEach(ot => { if (ot) diff = diff.replace(ot, ''); });
        diff = diff.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
        if (diff.length > qText.length) qText = diff;
      }
    }

    return qText.slice(0, 300);
  }

  function radioLabel(input) {
    // label[for]
    if (input.id) { const l = document.querySelector(`label[for="${input.id}"]`); if (l) return l.innerText.trim(); }
    // closest label
    const lw = input.closest('label'); if (lw) return lw.innerText.trim();
    // aria-label
    if (input.getAttribute('aria-label')) return input.getAttribute('aria-label');
    // sibling text
    let sib = input.nextSibling;
    while (sib) {
      if (sib.nodeType === 3 && sib.textContent.trim()) return sib.textContent.trim();
      if (sib.nodeType === 1 && !sib.querySelector('input')) return sib.innerText.trim();
      sib = sib.nextSibling;
    }
    // Parent text minus inputs
    const p = input.parentElement;
    if (p) { const c = p.cloneNode(true); c.querySelectorAll('input').forEach(i => i.remove()); return c.innerText.trim(); }
    return input.value || '';
  }

  function elText(el) {
    return (el.innerText || el.getAttribute('aria-label') || el.getAttribute('data-value') || el.textContent || '').trim();
  }

  function setInput(input, value) {
    input.focus();
    if (input.getAttribute('contenteditable') === 'true' || input.getAttribute('role') === 'textbox') {
      input.textContent = value; dispatch(input); return;
    }
    const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(input, value); else input.value = value;
    dispatch(input); input.blur();
  }

  function matchScore(label, answer) {
    if (!label || !answer) return 0;
    const l = label.replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim();
    const a = answer.replace(/[^\w\s.-]/g, '').replace(/\s+/g, ' ').trim();
    if (l === a) return 1.0;
    if (l.includes(a) && a.length > 1) return 0.9;
    if (a.includes(l) && l.length > 1) return 0.85;
    const lw = new Set(l.split(' '));
    const aw = a.split(' ').filter(w => w.length > 1);
    if (aw.length === 0) return 0;
    return (aw.filter(w => lw.has(w)).length / aw.length) * 0.7;
  }

  function dispatch(el) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    ['input', 'change', 'blur'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
  }

  // ================================================================
  // STEALTH PROGRESS REPORTING (No DOM injection)
  // ================================================================
  function showToast(msg) {
    try {
      chrome.runtime.sendMessage({ action: 'progress', phase: 'solving', current: 0, total: 1, detail: msg });
    } catch (e) {
      // Swalllow error if background context is closed
    }
  }

  function clearAll() {
    // We no longer inject DOM elements, but if any strictly legacy elements remain, strip them.
  }

  console.log('[Solveit] Content v7 — smart capture + fill.');
})();
