<div align="center">
  <img src="./icons/icon128.png" width="80" height="auto" />
  <h1>Solveit</h1>
  <p><b>Agentic Zero-Footprint Form Automation & Quiz Solver</b></p>
  <a href="#features">Features</a> &bull; <a href="#installation">Installation</a> &bull; <a href="#stealth-mode">Stealth Architecture</a> &bull; <a href="#bring-your-own-keys-byok">Supported APIs</a>
</div>

<br/>

**Solveit** is a state-of-the-art browser extension designed to natively understand, automate, and resolve complex DOM interactions via Multi-modal LLMs. Driven entirely by your local API keys (BYOK), it evaluates structured quizzes, generic web forms, diagrammatic logic puzzles, and institutional inputs at blinding speed. Built exclusively on a **Zero-Footprint Stealth Architecture**, it interacts with the DOM seamlessly without injecting detectable artifacts or leaving programmatic traces.

---

## ⚡ Key Features

* **Waterfall Token Optimization**: Employs an intelligent routing subsystem that sequentially cascades through your LLM nodes (e.g., trying OpenAI -> falling back to DeepSeek on Rate Limit). This prevents redundant API requests and drastically reduces token overhead.
* **Semantic Memory Reservoir**: Dictate or configure your custom structured profile (Name, Organization, Academic IDs). Solveit injects this contextual dictionary natively into forms without hallucinating options.
* **Voice-to-JSON Dictation**: Harnesses Chrome’s absolute fastest Web Speech API (`webkitSpeechRecognition`) to digest your spontaneous speech, instantly routing it through an active LLM to generate precise JSON mappings deployed right into your Memory Reservoir.
* **Vision-Language Synthesis**: Utilizes multi-modal models (GPT-4o, Gemini 2.0) to intrinsically understand graphs, LaTeX formulas, diagrams, and generic visual quiz dependencies right on the page before clicking the corresponding `input` options.
* **Absolute Zero-Footprint**: The content engine (`content.js`) is highly sterilized. Unlike generic extensions, it appends **no tracking classes**, invokes **no DOM overlays**, and strictly operates within an isolated window envelope to thwart invasive honor-lock or canvas anti-cheat routines. All execution progress renders externally on the Extension Action badge.

## 🛠 Supported Architectures (BYOK)
You maintain absolute privacy. Solveit stores API keys locally via `chrome.storage.local` and never beacons data.

* **OpenAI** (`gpt-4o`, `o1-mini`)
* **Anthropic Claude** (`claude-3-7-sonnet`)
* **Google Gemini** (`gemini-2.0-flash`)
* **DeepSeek** (`deepseek-chat`)
* **Grok** & **Groq** Fast-inference targets
* **OpenRouter** Access any model worldwide (defaults to `mistral-7b-free`)

## 📦 Installation

This extension is built on Manifest V3.

1. Clone or download this repository.
2. Navigate to `chrome://extensions/` in your Chromium-based browser.
3. Toggle on **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `/Solveit-ai` directory.
5. Click the Extension icon, open the "Dashboard", and plug in your desired API Key.

## 🧠 Memory Reservoir & Dictation

1. Click on the Solveit extension icon and hit **Dashboard**.
2. Scroll to the **Personal Memory Reservoir** section.
3. Click **Dictate with AI 🎤**.
4. Speak naturally: *"My name is John Doe, my employee ID is UX-8800, and my email is john@corp.com"*.
5. The LLM translates this perfectly into the structured DOM inputs.
6. The next time you encounter a lengthy induction form, prompt the solver!

## 🔐 Stealth Operations

Solveit utilizes Synthetic Event Dispatching (`MouseEvent('click')`) to emulate user behavior organically. There are no `<style>` injected blocks, no `data-Solveit-done` footprint tags, and no arbitrary toast notifications disrupting the view-port. For extreme environments, use the built-in keyboard shortcut (`Alt + S`) to command the AI entirely invisibly.

---
<div align="center">
  <p>Built with precision for maximum throughput and minimal API token utilization.</p>
</div>
