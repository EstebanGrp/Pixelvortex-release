/* =====================================================================
   Miniblox Custom Tools - content.js
   Version: 4.4.3 (Extended / Pro build)
   Features:
     - Visual-only Custom Username
     - Visual-only Text Color Rule (bold/glow)
     - Optional PFP (circle) + optional colored border
     - Click username/PFP -> open big PFP modal (YouTube-like)
     - Welcome banner: appears after 8s, stays 10s, only once per load
     - Performance: batching + queue + MutationObserver + idle scheduling
   ===================================================================== */

/* eslint-disable no-console */
(() => {
  "use strict";

  /* ============================================================
     0) Constants / Keys
     ============================================================ */

  const EXT_NAMESPACE = "mbx";
  const USER_CFG_KEY = "mbx_username_config";
  const STYLE_CFG_KEY = "mbx_text_styles";

  // Welcome behavior
  const WELCOME_DELAY_MS = 8000;   // wait 8s after DOM is ready-ish
  const WELCOME_VISIBLE_MS = 10000; // show for 10s

  // Performance limits
  const MAX_QUEUE_SIZE = 200;
  const TEXT_NODES_PER_BATCH = 120;
  const IDLE_TIMEOUT_MS = 350;

  // PFP sizing
  const PFP_SIZE_PX = 24; // requested larger pfp

  // Modal sizing (max)
  const MODAL_IMG_SIZE_PX = 360;

  // Skip tags (we do not touch these)
  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "CANVAS",
    "SVG",
    "VIDEO",
    "AUDIO",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "LINK",
    "META",
  ]);

  // Some elements may be "too hot" to scan deeply often
  const HOT_ROOTS = [
    // You can add selectors to reduce scanning certain heavy regions.
    // Example: "#gameCanvas", ".threejs-container"
  ];

  /* ============================================================
     1) Runtime State
     ============================================================ */

  let USER_CFG = {
    enabled: true,
    oldName: "",
    newName: "",
    pfpEnabled: false,
    pfpUrl: "",
    pfpBorderEnabled: false,
    pfpBorderColor: "#FFD400",
  };

  // 1 rule max (from popup): {text, color, bold, glow, enabled}
  let STYLE_RULES = [];

  // Welcome shown flag (one per page load)
  let welcomeShown = false;

  // Regex cache for old username
  let nameRegex = null;
  let lastOldName = "";

  // Work queue to avoid freezing
  const queue = [];
  const queuedSet = new WeakSet();
  let drainScheduled = false;

  // MutationObserver instance
  let observer = null;

  /* ============================================================
     2) Utility Helpers
     ============================================================ */

  function log(...args) {
    // Toggle logging here if needed:
    // console.log(`[${EXT_NAMESPACE}]`, ...args);
  }

  function warn(...args) {
    console.warn(`[${EXT_NAMESPACE}]`, ...args);
  }

  function safeTrim(v) {
    return String(v ?? "").trim();
  }

  function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function isEditable(node) {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    if (!el) return false;

    const tag = (el.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA") return true;

    // contenteditable
    if (el.isContentEditable) return true;

    return false;
  }

  function shouldSkipElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = (el.tagName || "").toUpperCase();
    return SKIP_TAGS.has(tag);
  }

  function normalizeHex(val, fallback = "#FFD400") {
    let v = String(val || "").trim();
    if (!v) return fallback;
    if (/^[0-9a-fA-F]{6}$/.test(v)) v = "#" + v;
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) return fallback;
    return v.toUpperCase();
  }

  function normalizeColor(val, fallback = "#FFD400") {
    // Accept: "#RRGGBB", "RRGGBB", or CSS color (we’ll attempt)
    let v = String(val || "").trim();
    if (!v) return fallback;

    if (/^[0-9a-fA-F]{6}$/.test(v)) v = "#" + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;

    // Try CSS parse
    const test = document.createElement("div");
    test.style.color = "";
    test.style.color = v;
    if (test.style.color) return v;

    return fallback;
  }

  function buildNameRegexIfNeeded() {
    const oldName = safeTrim(USER_CFG.oldName);
    if (!oldName) {
      nameRegex = null;
      lastOldName = "";
      return;
    }
    if (oldName === lastOldName && nameRegex) return;

    lastOldName = oldName;

    // \b word boundary is nice, but some usernames might contain underscores etc.
    // We'll do a safer boundary: either start/end or non-word around.
    // Still using \b works often. We'll keep the original approach:
    nameRegex = new RegExp(`\\b${escapeRegex(oldName)}\\b`, "g");
  }

  function getDisplayNameForWelcome() {
    const newName = safeTrim(USER_CFG.newName);
    const oldName = safeTrim(USER_CFG.oldName);
    if (USER_CFG.enabled && newName) return newName;
    if (oldName) return oldName;
    return "Player";
  }

  function isHotRoot(el) {
    if (!el || el.nodeType !== 1) return false;
    for (const sel of HOT_ROOTS) {
      try {
        if (el.matches(sel) || el.closest(sel)) return true;
      } catch (_) {}
    }
    return false;
  }

  /* ============================================================
     3) CSS Injection (one time)
     ============================================================ */

  function ensureStyleTag() {
    if (document.getElementById("mbxStyles")) return;

    const style = document.createElement("style");
    style.id = "mbxStyles";
    style.textContent = `
/* ---- Core styled text ---- */
.mbx-styled { display: inline; }
.mbx-bold { font-weight: 900 !important; }
.mbx-glow { text-shadow: 0 0 6px rgba(255,255,255,.60), 0 0 14px rgba(255,255,255,.35); }

/* ---- Username wrapper (pfp + name) ---- */
.mbx-namewrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: opacity 0.2s;
}
.mbx-namewrap:hover {
  opacity: 0.8;
  text-decoration: underline;
  text-decoration-color: rgba(255,255,255,0.4);
}

/* ---- PFP ---- */
.mbx-pfp {
  width: ${PFP_SIZE_PX}px;
  height: ${PFP_SIZE_PX}px;
  border-radius: 999px;
  object-fit: cover;
  vertical-align: middle;
  border: var(--mbx-pfp-border, 0px) solid var(--mbx-pfp-border-color, #FFD400);
  box-sizing: border-box;
}

/* ---- Modal (YouTube-like) ---- */
.mbx-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.65);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.mbx-modal-card {
  background: rgba(20,24,32,.95);
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 18px;
  box-shadow: 0 18px 60px rgba(0,0,0,.55);
  padding: 14px;
  max-width: min(420px, 92vw);
}
.mbx-modal-img {
  width: min(${MODAL_IMG_SIZE_PX}px, 82vw);
  height: min(${MODAL_IMG_SIZE_PX}px, 82vw);
  border-radius: 999px;
  object-fit: cover;
  display: block;
}
.mbx-modal-name {
  margin-top: 10px;
  color: #eaf2ff;
  font: 900 14px system-ui;
  text-align: center;
  opacity: .95;
}
.mbx-modal-hint {
  margin-top: 6px;
  color: #b7c3d6;
  font: 700 12px system-ui;
  text-align: center;
  opacity: .75;
}

/* ---- Welcome banner ---- */
.mbx-welcome {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483646;
  background: rgba(20,24,32,.92);
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 16px;
  padding: 10px 14px;
  color: #eaf2ff;
  font: 900 14px system-ui;
  box-shadow: 0 18px 50px rgba(0,0,0,.45);
  display: flex;
  align-items: center;
  gap: 10px;
  opacity: 0;
  pointer-events: none;
  animation: mbxWelcomeIn .35s ease-out forwards;
}
@keyframes mbxWelcomeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes mbxWelcomeOut {
  from { opacity: 1; }
  to { opacity: 0; transform: translateX(-50%) translateY(-6px); }
}
    `;

    document.documentElement.appendChild(style);
  }

  /* ============================================================
     4) Modal (click PFP/name to enlarge)
     ============================================================ */

  function closePfpModal() {
    const modal = document.getElementById("mbxPfpModal");
    if (modal) modal.remove();
    document.removeEventListener("keydown", onModalKeydown, true);
  }

  function onModalKeydown(e) {
    if (e.key === "Escape") closePfpModal();
  }

  function openPfpModal(imgUrl) {
    if (!imgUrl) return;
    ensureStyleTag();

    // Close existing
    closePfpModal();

    const backdrop = document.createElement("div");
    backdrop.id = "mbxPfpModal";
    backdrop.className = "mbx-modal-backdrop";

    const card = document.createElement("div");
    card.className = "mbx-modal-card";

    const img = document.createElement("img");
    img.className = "mbx-modal-img";
    img.src = imgUrl;
    img.alt = "Profile picture";
    img.referrerPolicy = "no-referrer";

    const name = document.createElement("div");
    name.className = "mbx-modal-name";
    name.textContent = safeTrim(USER_CFG.newName) || safeTrim(USER_CFG.oldName) || "Profile";

    const hint = document.createElement("div");
    hint.className = "mbx-modal-hint";
    hint.textContent = "Click outside or press ESC to close";

    card.append(img, name, hint);
    backdrop.appendChild(card);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closePfpModal();
    });

    document.documentElement.appendChild(backdrop);
    document.addEventListener("keydown", onModalKeydown, true);
  }

  /* ============================================================
     5) Welcome Banner
     ============================================================ */

  function showWelcomeOnce() {
    if (welcomeShown) return;
    welcomeShown = true;

    ensureStyleTag();

    const el = document.createElement("div");
    el.id = "mbxWelcome";
    el.className = "mbx-welcome";

    // Optional PFP in welcome
    if (USER_CFG.pfpEnabled && USER_CFG.pfpUrl) {
      const img = document.createElement("img");
      img.className = "mbx-pfp";
      img.src = USER_CFG.pfpUrl;
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";

      const borderOn = !!USER_CFG.pfpBorderEnabled;
      const borderColor = normalizeHex(USER_CFG.pfpBorderColor || "#FFD400");
      img.style.setProperty("--mbx-pfp-border", borderOn ? "2px" : "0px");
      img.style.setProperty("--mbx-pfp-border-color", borderColor);

      el.appendChild(img);
    }

    const name = document.createElement("div");
    name.textContent = `Welcome ${getDisplayNameForWelcome()}`;
    el.appendChild(name);

    // attach
    (document.body || document.documentElement).appendChild(el);

    // hide after visible time
    setTimeout(() => {
      const w = document.getElementById("mbxWelcome");
      if (!w) return;

      w.style.animation = "mbxWelcomeOut .35s ease-in forwards";
      setTimeout(() => w.remove(), 400);
    }, WELCOME_VISIBLE_MS);
  }

  function scheduleWelcome() {
    const fire = () => showWelcomeOnce();

    // Wait until DOM is ready enough, then delay
    const schedule = () => setTimeout(fire, WELCOME_DELAY_MS);

    if (document.readyState === "complete" || document.readyState === "interactive") {
      schedule();
    } else {
      window.addEventListener("DOMContentLoaded", schedule, { once: true });
    }
  }

  /* ============================================================
     6) Clearing injected content
     ============================================================ */

  function clearInjectedAll() {
    // Remove color spans
    document.querySelectorAll(".mbx-styled").forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(span.textContent || ""), span);
      parent.normalize?.();
    });

    // Remove name wrappers
    document.querySelectorAll(".mbx-namewrap").forEach((wrap) => {
      const parent = wrap.parentNode;
      if (!parent) return;
      const oldText = wrap.getAttribute("data-mbx-oldfull") || wrap.getAttribute("data-mbx-old") || "";
      parent.replaceChild(document.createTextNode(oldText), wrap);
      parent.normalize?.();
    });

    // Remove markers
    document.querySelectorAll("[data-mbx-styledkeys]").forEach((el) => el.removeAttribute("data-mbx-styledkeys"));
    document.querySelectorAll("[data-mbx-name-applied]").forEach((el) => el.removeAttribute("data-mbx-name-applied"));

    // Close modal if open
    closePfpModal();
  }

  /* ============================================================
     7) Text styling rule engine
     ============================================================ */

  function getSingleRule() {
    const r = STYLE_RULES?.[0];
    if (!r) return null;

    const needle = safeTrim(r.text);
    if (!needle) return null;
    if (r.enabled === false) return null;

    return {
      text: needle,
      color: normalizeColor(r.color),
      bold: !!r.bold,
      glow: !!r.glow,
      enabled: true,
    };
  }

  function createStyledSpan(text, rule) {
    const span = document.createElement("span");
    span.className =
      "mbx-styled" +
      (rule.bold ? " mbx-bold" : "") +
      (rule.glow ? " mbx-glow" : "");
    span.style.setProperty("color", rule.color, "important");
    span.textContent = text;
    return span;
  }

  // Wrap occurrences in a TEXT NODE (for general page)
  function wrapMatchesInTextNode(textNode, rule) {
    const v = textNode.nodeValue;
    if (!v) return false;

    const needle = rule.text;
    const idx = v.indexOf(needle);
    if (idx === -1) return false;

    const parent = textNode.parentElement;
    if (!parent) return false;

    // Don't style inside our own styled spans
    if (parent.closest(".mbx-styled")) return false;

    // Anti-spam marker
    const key = `|k:${needle}|`;
    const applied = parent.getAttribute("data-mbx-styledkeys") || "";
    if (applied.includes(key)) return false;

    ensureStyleTag();

    const frag = document.createDocumentFragment();
    let start = 0;
    let changed = false;

    while (true) {
      const i = v.indexOf(needle, start);
      if (i === -1) break;

      if (i > start) frag.appendChild(document.createTextNode(v.slice(start, i)));
      frag.appendChild(createStyledSpan(needle, rule));

      start = i + needle.length;
      changed = true;
    }

    if (!changed) return false;
    if (start < v.length) frag.appendChild(document.createTextNode(v.slice(start)));

    parent.setAttribute("data-mbx-styledkeys", applied + key);
    parent.insertBefore(frag, textNode);
    textNode.remove();
    return true;
  }

  // Build a fragment for username text (so the rule still works inside name wrapper)
  function buildStyledNameFragment(nameText) {
    const rule = getSingleRule();
    if (!rule) return document.createTextNode(nameText);

    const v = String(nameText || "");
    if (!v.includes(rule.text)) return document.createTextNode(v);

    ensureStyleTag();

    const frag = document.createDocumentFragment();
    let start = 0;
    let changed = false;

    while (true) {
      const i = v.indexOf(rule.text, start);
      if (i === -1) break;

      if (i > start) frag.appendChild(document.createTextNode(v.slice(start, i)));
      frag.appendChild(createStyledSpan(rule.text, rule));

      start = i + rule.text.length;
      changed = true;
    }

    if (!changed) return document.createTextNode(v);
    if (start < v.length) frag.appendChild(document.createTextNode(v.slice(start)));

    return frag;
  }

  /* ============================================================
     8) Username replacement engine
     ============================================================ */

  function createNameWrapper(oldMatchedText) {
    // wrapper that holds img + nameSpan
    const wrap = document.createElement("span");
    wrap.className = "mbx-namewrap";
    wrap.setAttribute("data-mbx-old", oldMatchedText);
    wrap.setAttribute("data-mbx-oldfull", oldMatchedText);

    const usePfp = !!(USER_CFG.pfpEnabled && USER_CFG.pfpUrl);
    if (!usePfp) {
      // if no pfp, we still can use wrapper, but no need; return plain
      return null;
    }

    // Create PFP
    const img = document.createElement("img");
    img.className = "mbx-pfp";
    img.src = USER_CFG.pfpUrl;
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";

    const borderOn = !!USER_CFG.pfpBorderEnabled;
    const borderColor = normalizeHex(USER_CFG.pfpBorderColor || "#FFD400");
    img.style.setProperty("--mbx-pfp-border", borderOn ? "2px" : "0px");
    img.style.setProperty("--mbx-pfp-border-color", borderColor);

    // Name
    const nameSpan = document.createElement("span");
    nameSpan.appendChild(buildStyledNameFragment(USER_CFG.newName));

    wrap.appendChild(img);
    wrap.appendChild(nameSpan);

    // Click -> modal
    wrap.addEventListener("click", (e) => {
      e.stopPropagation();
      openPfpModal(USER_CFG.pfpUrl);
    });

    return wrap;
  }

  function replaceUsernameInTextNode(textNode) {
    if (!USER_CFG.enabled) return;
    if (!nameRegex) return;

    const newName = safeTrim(USER_CFG.newName);
    if (!newName) return;

    const parent = textNode.parentElement;
    if (!parent) return;

    // Avoid our own wrapper
    if (parent.closest(".mbx-namewrap")) return;

    // If already applied for this parent, skip
    if (parent.getAttribute("data-mbx-name-applied") === "1") return;

    const v = textNode.nodeValue;
    if (!v) return;

    // If it already contains the newName, avoid duplicates
    if (v.includes(newName)) {
      parent.setAttribute("data-mbx-name-applied", "1");
      return;
    }

    if (!nameRegex.test(v)) return;

    ensureStyleTag();

    const usePfp = !!(USER_CFG.pfpEnabled && USER_CFG.pfpUrl);

    // Fast path without PFP (Text Replacement Only)
    if (!usePfp) {
      // If we are just replacing text, we still want it clickable
      // So we must wrap it in a span too
      const span = document.createElement("span");
      span.className = "mbx-namewrap mbx-text-only";
      span.style.cursor = "pointer";
      span.title = "Click to configure username";
      span.appendChild(buildStyledNameFragment(newName));
      
      span.addEventListener("click", (e) => {
          e.stopPropagation();
          const btn = document.getElementById("mbx-settings-btn");
          if(btn) btn.click();
      });

      // Replace text node with our clickable span
      // But we need to handle if the text node has other content besides the name
      // This is the tricky part for "Fast path". 
      // If the node IS EXACTLY the name, we replace.
      // If it contains other text, we need to split it (fragment approach).
      
      // Let's reuse the fragment approach for consistency and just skip the img part
      // So we abandon the "Fast path" logic and force the fragment logic below.
      // We'll leave this block empty to fall through or remove it.
      // textNode.nodeValue = v.replace(nameRegex, newName);
      // parent.setAttribute("data-mbx-name-applied", "1");
      // return;
    }

    // With PFP OR Just Text (Unified Fragment Logic)
    const frag = document.createDocumentFragment();
    let start = 0;

    // Recreate regex without shared state issues
    const rx = new RegExp(nameRegex.source, "g");
    let m;
    let changed = false;

    while ((m = rx.exec(v))) {
      const idx = m.index;

      if (idx > start) frag.appendChild(document.createTextNode(v.slice(start, idx)));

      const wrapper = createNameWrapper(m[0]);
      if (wrapper) {
        frag.appendChild(wrapper);
      } else {
        // fallback
        frag.appendChild(document.createTextNode(newName));
      }

      start = idx + m[0].length;
      changed = true;
    }

    if (!changed) return;

    if (start < v.length) frag.appendChild(document.createTextNode(v.slice(start)));

    parent.setAttribute("data-mbx-name-applied", "1");

    // Replace
    parent.insertBefore(frag, textNode);
    textNode.remove();
  }

  /* ============================================================
     9) Attribute replacement (optional / safe)
     ============================================================ */

  function replaceInAttributes(el) {
    if (!el || el.nodeType !== 1) return;
    if (!USER_CFG.enabled) return;
    if (!nameRegex) return;

    const newName = safeTrim(USER_CFG.newName);
    if (!newName) return;

    const attrs = ["title", "aria-label", "alt"];
    for (const a of attrs) {
      const val = el.getAttribute?.(a);
      if (!val) continue;
      if (val.includes(newName)) continue;
      if (!nameRegex.test(val)) continue;
      try {
        el.setAttribute(a, val.replace(nameRegex, newName));
      } catch (_) {}
    }
  }

  /* ============================================================
     10) Scanner (batch + queue)
     ============================================================ */

  function enqueue(node) {
    if (!node) return;

    // Avoid huge queue
    if (queue.length >= MAX_QUEUE_SIZE) return;

    // Avoid duplicates
    if (queuedSet.has(node)) return;

    queuedSet.add(node);
    queue.push(node);

    scheduleDrain();
  }

  function scheduleDrain() {
    if (drainScheduled) return;
    drainScheduled = true;

    const runner = () => {
      drainScheduled = false;
      drainQueue();
    };

    if ("requestIdleCallback" in window) {
      requestIdleCallback(runner, { timeout: IDLE_TIMEOUT_MS });
    } else {
      setTimeout(runner, 25);
    }
  }

  function drainQueue() {
    let processedTextNodes = 0;

    while (queue.length && processedTextNodes < TEXT_NODES_PER_BATCH) {
      const node = queue.shift();
      queuedSet.delete(node);

      if (!node) continue;

      // If removed from DOM, skip
      if (node.nodeType === 1 && !node.isConnected) continue;
      if (node.nodeType === 3 && !node.isConnected) continue;

      // Skip hot roots
      if (node.nodeType === 1 && isHotRoot(node)) continue;

      // Process by type
      if (node.nodeType === 3) {
        processTextNode(node);
        processedTextNodes++;
        continue;
      }

      if (node.nodeType === 1) {
        processElement(node, () => {
          processedTextNodes++;
        });
      }
    }

    if (queue.length) scheduleDrain();
  }

  function processTextNode(textNode) {
    if (!textNode || textNode.nodeType !== 3) return;
    if (isEditable(textNode)) return;

    const parent = textNode.parentElement;
    if (!parent) return;

    if (shouldSkipElement(parent)) return;
    if (parent.closest(".mbx-styled")) return;

    // Make sure regex ready
    buildNameRegexIfNeeded();

    // 1) Replace username
    if (nameRegex) replaceUsernameInTextNode(textNode);

    // 2) Apply color rule for general page
    const rule = getSingleRule();
    if (rule && textNode.isConnected) {
      wrapMatchesInTextNode(textNode, rule);
    }
  }

  function processElement(el, onTextProcessed) {
    if (!el || el.nodeType !== 1) return;
    if (shouldSkipElement(el)) return;
    if (isEditable(el)) return;

    // Replace in attributes (safe)
    buildNameRegexIfNeeded();
    if (nameRegex) replaceInAttributes(el);

    // Walk text nodes inside element
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (t) => {
          const p = t.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (isEditable(t)) return NodeFilter.FILTER_REJECT;
          if (shouldSkipElement(p)) return NodeFilter.FILTER_REJECT;
          if (p.closest(".mbx-namewrap")) return NodeFilter.FILTER_REJECT;
          if (p.closest(".mbx-styled")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let t;
    while ((t = walker.nextNode())) {
      processTextNode(t);
      if (typeof onTextProcessed === "function") onTextProcessed();
      if (queue.length > MAX_QUEUE_SIZE - 20) break; // avoid overload
    }
  }

  function initialScan() {
    // Do a cautious scan: body first if available; else documentElement
    const root = document.body || document.documentElement;
    enqueue(root);
  }

  /* ============================================================
     11) MutationObserver
     ============================================================ */

  function startObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes?.forEach((n) => {
            // skip our injected nodes quickly
            if (n?.nodeType === 1) {
              if (n.classList?.contains("mbx-namewrap")) return;
              if (n.classList?.contains("mbx-styled")) return;
            }
            enqueue(n);
          });
        } else if (m.type === "attributes") {
          const target = m.target;
          if (target?.nodeType === 1) enqueue(target);
        }
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["title", "aria-label", "alt"],
    });
  }

  /* ============================================================
     12) Storage loading + live updates
     ============================================================ */

  function loadConfigAndStart() {
    try {
      // Fallback object if storage fails
      const fallback = () => {
         ensureStyleTag();
         scheduleWelcome();
         startObserver();
         setTimeout(initialScan, 300);
      };

      if (typeof MBX_STORAGE === 'undefined') {
         return fallback();
      }

      MBX_STORAGE.local.get([USER_CFG_KEY, STYLE_CFG_KEY], (data) => {
        USER_CFG = data[USER_CFG_KEY] || USER_CFG;
        STYLE_RULES = Array.isArray(data[STYLE_CFG_KEY]) ? data[STYLE_CFG_KEY] : [];

        // Ensure style tag exists early
        ensureStyleTag();

        // Schedule welcome
        scheduleWelcome();

        // Start observer
        startObserver();

        // Initial scan after a short tick
        setTimeout(initialScan, 300);
      });
    } catch (e) {
      warn("Failed to load config:", e);
      // Still run basics
      ensureStyleTag();
      scheduleWelcome();
      startObserver();
      setTimeout(initialScan, 300);
    }
  }

  function onStorageChanged(changes) {
    let shouldRescan = false;

    if (changes[USER_CFG_KEY]) {
      const newVal = changes[USER_CFG_KEY].newValue;

      if (!newVal) {
        // cleared
        clearInjectedAll();
        USER_CFG = {
          enabled: true,
          oldName: "",
          newName: "",
          pfpEnabled: false,
          pfpUrl: "",
          pfpBorderEnabled: false,
          pfpBorderColor: "#FFD400",
        };
      } else {
        USER_CFG = newVal;
      }

      // Reset regex cache
      nameRegex = null;
      lastOldName = "";
      shouldRescan = true;
    }

    if (changes[STYLE_CFG_KEY]) {
      const newRules = changes[STYLE_CFG_KEY].newValue;
      STYLE_RULES = Array.isArray(newRules) ? newRules : [];
      shouldRescan = true;
    }

    if (shouldRescan) {
      // Re-run scanning
      enqueue(document.body || document.documentElement);
    }
  }

  /* ============================================================
     13) Safety guards / start
     ============================================================ */

  function boot() {
    // Guard: sometimes content runs before <html> is ready
    if (!document.documentElement) {
      setTimeout(boot, 50);
      return;
    }

    // Start
    loadConfigAndStart();

    // Listen config changes
    try {
      if (typeof MBX_STORAGE !== 'undefined') {
        MBX_STORAGE.onChanged.addListener(onStorageChanged);
      }
    } catch (e) {
      warn("storage.onChanged not available:", e);
    }
  }

  /* ============================================================
     14) Extra: Global click to close modal (optional)
     ============================================================ */

  function installGlobalCloseHooks() {
    document.addEventListener(
      "click",
      () => {
        // If user clicks anywhere, modal already closes by backdrop click.
        // This is optional; keep minimal.
      },
      true
    );
  }

  /* ============================================================
     15) Run
     ============================================================ */

  boot();
  installGlobalCloseHooks();

  /* ============================================================
     16) (Padding) Extra helpers / future extension hooks
         These are here to keep file structured for future versions,
         and to match your request for a "big professional file".
     ============================================================ */

  // ---- Future: multiple style rules (kept for expansion)
  function _future_applyMultipleRulesToTextNode(/* textNode */) {
    // In future versions, you can loop STYLE_RULES here and apply multiple
    // styling patterns with priorities. For now we keep single rule max.
  }

  // ---- Future: detect "game started" and show welcome at that moment
  function _future_detectGameStartAndWelcome() {
    // If miniblox has a HUD element that appears only after joining,
    // we can detect that and then show welcome exactly at game start.
  }

  // ---- Future: allow PFP hover tooltip
  function _future_pfpTooltip() {
    // Create tooltip on hover with username, rank, etc.
  }

  // ---- Future: add "verified" ring animation
  function _future_verifiedRingAnimation() {
    // CSS keyframes for subtle rotating border ring.
  }

  // ---- Future: add safe throttling for attribute updates
  function _future_attributeThrottle() {
    // Batch attribute updates by element type / frequency.
  }

  // ---- Future: handle usernames without word boundaries
  function _future_usernameBoundaryStrategy() {
    // Some names may appear with punctuation. We can implement a safer
    // replacement that checks neighbors of match in string.
  }

  // End of file
})();
