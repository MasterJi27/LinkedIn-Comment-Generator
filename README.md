# LinkedIn AI Comment & Reply Generator

A Chrome extension (Manifest V3) that injects an AI-powered comment/reply generator directly into your LinkedIn feed. Powered by **Nvidia Nemotron Super 120B** via an **N8N webhook → OpenRouter** pipeline.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [File Structure](#file-structure)
- [How It Works](#how-it-works)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Tone Options](#tone-options)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Tech Stack](#tech-stack)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)

---

## Features

### Comment Generation
- **One-click AI comments** — a ✨ button appears alongside every post's action bar on your LinkedIn feed
- **5 tone presets** — Professional, Friendly, Witty, Supportive, Insightful
- **Hint input** — guide the AI with a custom topic, angle, or talking point
- **Regenerate** — get a fresh comment any time with a single click
- **Character counter** — live count with amber warning at 90% of LinkedIn's 1250-character limit and red warning if exceeded

### Reply Generation
- **Reply mode** — toggle from comment to reply mode to craft targeted replies
- **Smart context** — auto-extracts the original post content for better reply relevance
- **Suggestion cards** — displays 3 instant reply variants to choose from

### Paste & Copy
- **Paste to Comment** — directly inserts the generated text into LinkedIn's comment box with a single click
- **Copy to clipboard** — one-click clipboard copy as a fallback
- **6-method robust insertion** — multiple DOM strategies ensure the paste works across LinkedIn UI variants

### Popup Interface
- Click the extension icon for a compact popup to preview the current post, add a hint, and generate/use a comment without scrolling

### Quality of Life
- **Duplicate button prevention** — mutation observer ensures no double buttons on re-renders
- **Loading animations** — animated typing dots with rotating status messages during generation
- **Toast notifications** — non-intrusive success/error toasts
- **Debug mode** — toggle with `Ctrl+Shift+D` for developer diagnostics (off by default in production)

---

## Architecture

```
LinkedIn Page (HTTPS)
       │
       ▼
 content.js  ──────────────────────────────────────────────────────┐
 (DOM injection,                                                    │
  UI rendering,                                                     │
  post extraction)                                                  │
       │  chrome.runtime.sendMessage({ action: 'apiRequest' })      │
       ▼                                                            │
 background.js  (Service Worker)                                    │
 (CORS proxy — LinkedIn blocks direct fetch to external URLs)       │
       │  fetch()                                                   │
       ▼                                                            │
 N8N Webhook                                                        │
 https://n8n.devflow.me/webhook/linkedin-comment                    │
       │  OpenRouter API call                                       │
       ▼                                                            │
 Nvidia Nemotron Super 120B  (nvidia/nemotron-3-super-120b-a12b:free)
       │  Generated comment text                                    │
       └──────────────────────────────── response back to content.js
```

The background service worker acts purely as a **CORS proxy** — LinkedIn pages cannot directly call external APIs, so all `fetch` calls are relayed through the background script.

---

## File Structure

```
├── manifest.json          Chrome Extension manifest (MV3)
├── content.js             Main content script (~4400 lines)
│                            - Post detection & button injection
│                            - Comment/reply UI components
│                            - API call orchestration
│                            - LinkedIn DOM insertion utilities
├── background.js          Service worker
│                            - CORS proxy for API calls
│                            - fetchWithRetry with exponential backoff
│                            - Clipboard permission check
├── popup.html             Extension popup layout
├── popup.js               Popup logic
│                            - Reads current post from active tab
│                            - Triggers generateComment via content script
│                            - Safe DOM rendering (no innerHTML)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## How It Works

### 1. Post Detection
`content.js` runs a `MutationObserver` on the LinkedIn feed. Every time new posts appear (infinite scroll), `addButtonsToPosts()` is called. Each post is identified by its `data-urn` or similar attribute, tracked in a capped `Set` (`processedPostIds`, max 500 entries) to avoid reprocessing.

### 2. Button Injection
A ✨ **Generate Comment** button is inserted next to the existing LinkedIn action bar buttons (Like, Comment, Share). Three fallback insertion strategies ensure it works on all LinkedIn layout variants.

### 3. UI Panel
Clicking the button creates and mounts an `lcg-comment-ui` panel beneath the post containing:
- Tone selector pills
- Hint text input
- Generated comment text area with live character count
- Paste, Copy, and Regenerate action buttons
- Mode toggle (Comment / Reply)

### 4. API Call
On generate, the extension:
1. Extracts the post's text content (`extractPostContent()`)
2. Reads the selected tone & optional hint
3. Sends a message to `background.js` with the N8N webhook URL and a JSON payload:
   ```json
   {
     "hint": "user hint text",
     "caption": "extracted post text",
     "tone": "professional",
     "model": "nvidia/nemotron-3-super-120b-a12b:free",
     "user_info": { "id": "...", "name": "...", "email": "...", "profile_url": "..." }
   }
   ```
4. `background.js` proxies the call with `fetchWithRetry` (2 retries, 30 s timeout, exponential back-off)
5. The response text is displayed in the comment box

### 5. Paste to LinkedIn
`pasteToLinkedIn()` finds LinkedIn's `contenteditable` comment box using 5 CSS selectors, walks up the DOM ancestor chain to scope to the correct post, then safely inserts paragraph nodes using `createElement` + `textContent` (no `innerHTML`).

---

## Installation

> These steps are for loading the extension as an **unpacked developer extension** in Chrome.

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle, top-right).
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.
6. The extension icon will appear in your Chrome toolbar.

To **reload** after making code changes: click the refresh icon on the extension card at `chrome://extensions`.

---

## Usage

### From the Feed (recommended)
1. Open [linkedin.com/feed](https://www.linkedin.com/feed/).
2. A ✨ **Generate Comment** button appears on every post's action bar.
3. Click it — a panel opens below the post.
4. *(Optional)* Select a tone pill and/or type a hint.
5. Click **✨ Generate Comment** — wait ~5–10 seconds for the AI response.
6. Review the comment, then click **Paste to Comment** to insert it into LinkedIn's comment field.
7. Edit if needed, then post normally.

### From the Popup
1. Navigate to any LinkedIn post.
2. Click the extension icon in the Chrome toolbar.
3. The popup shows a preview of the detected post.
4. Add a hint (optional) and click **Generate**.
5. Click **Use Comment** to paste it into the page.

### Reply Mode
1. Open the comment panel on any post.
2. Click the **Reply** tab in the mode toggle.
3. The panel switches to reply mode — the AI takes the post context into account.
4. Three suggestion cards are shown; click any one to use it.

---

## Configuration

All configuration lives at the top of `content.js`:

```js
const API_CONFIG = {
    URL: 'https://n8n/webhook/linkedin-comment',  // Your N8N webhook
    MAX_RETRIES: 2,        // Retry attempts on failure
    TIMEOUT_MS: 30000      // Per-request timeout (ms)
};
```

To point the extension at a different N8N instance or webhook path, update `API_CONFIG.URL`.

---

## Tone Options

| Tone | Description |
|------|-------------|
| Professional | Formal, authoritative, business-appropriate |
| Friendly | Warm, conversational, approachable |
| Witty | Clever, light-humoured, engaging |
| Supportive | Encouraging, empathetic, uplifting |
| Insightful | Analytical, thought-provoking, adds value |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+D` | Toggle debug mode (shows verbose logs + visual feedback overlays) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension platform | Chrome MV3 (Manifest V3) |
| Content injection | Vanilla JS + CSS-in-JS (no React/Vue) |
| AI model | Nvidia Nemotron Super 120B (`nvidia/nemotron-3-super-120b-a12b:free`) |
| AI gateway | OpenRouter (via N8N workflow) |
| Workflow automation | N8N (self-hosted) |
| CORS bypass | Chrome Service Worker proxy |
| Storage | `chrome.storage` / `localStorage` |

---

## Security Notes

- All API calls go over **HTTPS only** — no plain HTTP endpoints are used.
- AI-generated text is inserted via `textContent` / `createElement` — never raw `innerHTML` — preventing XSS injection even if the model returns malicious markup.
- The extension requests only the minimum required permissions: `activeTab`, `storage`, `clipboardWrite`.
- No user data is stored remotely; the `user_info` payload is sent to your own N8N instance only.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No ✨ button on posts | Extension not loaded / LinkedIn layout changed | Reload extension at `chrome://extensions`; scroll to trigger MutationObserver |
| "API request timed out" | N8N webhook is cold-starting or unreachable | Wait 10 s and retry; check N8N instance is running |
| Paste does nothing | LinkedIn updated their editor DOM | Click directly inside the LinkedIn comment box first, then click Paste |
| Popup shows "Select a post" | No post detected on the current tab | Navigate to linkedin.com/feed and scroll to at least one post |
| Comment looks wrong | Post content extraction failed | Add a hint describing the post topic to guide the AI |
| Debug logs needed | Want to inspect internals | Press `Ctrl+Shift+D` on a LinkedIn tab to toggle debug mode |
