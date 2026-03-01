// guard.js — v4.4.3 (PERSISTENT REAL-TIME)
// Saves popup field drafts in real time and restores them even after closing the popup.
// Does NOT affect your real custom-name config (uses its own key).
//
// How to use:
// - Add data-guard="true" to fields you want to persist (recommended).
// - This script will autosave on input/change/keyup/paste/cut.
// - Restore on load + focusin.
// - Optional: call window.MBX_GUARD_CLEAR_DRAFT() to wipe only the draft.

(() => {
  "use strict";

  if (window.__MBX_GUARD_V433__) return;
  window.__MBX_GUARD_V433__ = true;

  const ATTR = "data-guard";
  const AUTO_GUARD_ALL_FALLBACK = false; // keep strict: only fields marked data-guard="true"
  const DRAFT_KEY = "mbx_popup_draft_v430"; // separate from your real config keys

  const WRITE_DEBOUNCE_MS = 40;

  const isChromeStorageOk =
    typeof MBX_STORAGE !== "undefined" &&
    MBX_STORAGE.local &&
    typeof MBX_STORAGE.local.get === "function";

  // -----------------------------
  // Helpers
  // -----------------------------
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function isField(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = (el.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "select") return true;
    if (tag !== "input") return false;

    const t = (el.type || "").toLowerCase();
    if (t === "button" || t === "submit" || t === "reset" || t === "file") return false;
    return true;
  }

  function hasExplicitGuardFields() {
    return !!document.querySelector(`[${ATTR}="true"]`);
  }

  function shouldGuard(el) {
    if (!isField(el)) return false;

    if (hasExplicitGuardFields()) return el.getAttribute(ATTR) === "true";
    return AUTO_GUARD_ALL_FALLBACK;
  }

  function norm(s) {
    return String(s ?? "").trim().replace(/\s+/g, " ").slice(0, 140);
  }

  function domIndex(el) {
    const all = qsa("input,textarea,select").filter(isField);
    const idx = all.indexOf(el);
    return idx < 0 ? 0 : idx;
  }

  function fieldId(el) {
    // Stable identifier: prefer id, then name, then placeholder, else index
    const id = norm(el.id);
    const name = norm(el.name);
    const ph = norm(el.getAttribute("placeholder"));
    const aria = norm(el.getAttribute("aria-label"));

    let base = "";
    if (id) base = `id:${id}`;
    else if (name) base = `name:${name}`;
    else if (aria) base = `aria:${aria}`;
    else if (ph) base = `ph:${ph}`;
    else base = `idx:${domIndex(el)}`;

    const tag = (el.tagName || "x").toLowerCase();
    const type = (el.type || "").toLowerCase();

    return `${tag}:${type}:${base}`;
  }

  function getVal(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === "select") return el.value ?? "";

    const type = (el.type || "").toLowerCase();
    if (type === "checkbox") return el.checked ? "1" : "0";

    if (type === "radio") {
      return el.checked ? String(el.value ?? "1") : "";
    }

    return String(el.value ?? "");
  }

  function setVal(el, v) {
    const tag = el.tagName.toLowerCase();
    if (tag === "select") {
      el.value = v;
      return;
    }

    const type = (el.type || "").toLowerCase();
    if (type === "checkbox") {
      el.checked = v === "1";
      return;
    }

    if (type === "radio") {
      el.checked = v !== "" && v === String(el.value ?? "1");
      return;
    }

    el.value = v;
  }

  // -----------------------------
  // Storage (draft only)
  // -----------------------------
  function getDraft() {
    return new Promise((resolve) => {
      if (!isChromeStorageOk) return resolve({});
      MBX_STORAGE.local.get([DRAFT_KEY], (data) => resolve(data?.[DRAFT_KEY] || {}));
    });
  }

  function setDraft(draftObj) {
    return new Promise((resolve) => {
      if (!isChromeStorageOk) return resolve();
      MBX_STORAGE.local.set({ [DRAFT_KEY]: draftObj }, () => resolve());
    });
  }

  function clearDraft() {
    return new Promise((resolve) => {
      if (!isChromeStorageOk) return resolve();
      MBX_STORAGE.local.remove([DRAFT_KEY], () => resolve());
    });
  }

  // Expose clear function (optional)
  window.MBX_GUARD_CLEAR_DRAFT = async () => {
    await clearDraft();
  };

  // -----------------------------
  // Real-time save engine
  // -----------------------------
  let draftCache = {};
  let debounceTimer = 0;
  let loading = true;

  function scheduleWrite() {
    if (debounceTimer) return;
    debounceTimer = window.setTimeout(async () => {
      debounceTimer = 0;
      await setDraft(draftCache);
    }, WRITE_DEBOUNCE_MS);
  }

  function saveField(el) {
    if (loading) return; // don't save while we are restoring
    if (!shouldGuard(el)) return;

    const type = (el.type || "").toLowerCase();

    // Radio group: store all radios in the group so restore is perfect
    if (type === "radio" && el.name) {
      const group = qsa(`input[type="radio"][name="${CSS.escape(el.name)}"]`)
        .filter(isField)
        .filter(shouldGuard);

      for (const r of group) {
        draftCache[fieldId(r)] = getVal(r);
      }
      scheduleWrite();
      return;
    }

    draftCache[fieldId(el)] = getVal(el);
    scheduleWrite();
  }

  async function restoreAll() {
    const fields = qsa("input,textarea,select")
      .filter(isField)
      .filter(shouldGuard);

    for (const el of fields) {
      const key = fieldId(el);
      if (draftCache[key] != null) setVal(el, draftCache[key]);
    }
  }

  // Restore on focus (helpful if popup.js overwrites values later)
  function restoreField(el) {
    if (!shouldGuard(el)) return;
    const key = fieldId(el);
    if (draftCache[key] != null) setVal(el, draftCache[key]);
  }

  // -----------------------------
  // Event delegation (strong)
  // -----------------------------
  function installListeners() {
    const onAny = (ev) => {
      const el = ev.target;
      if (!isField(el)) return;
      if (!shouldGuard(el)) return;
      saveField(el);
    };

    document.addEventListener("input", onAny, true);
    document.addEventListener("change", onAny, true);
    document.addEventListener("keyup", onAny, true);
    document.addEventListener("paste", onAny, true);
    document.addEventListener("cut", onAny, true);

    document.addEventListener(
      "focusin",
      (ev) => {
        const el = ev.target;
        if (!isField(el)) return;
        if (!shouldGuard(el)) return;
        restoreField(el);
      },
      true
    );
  }

  // Restore new fields if popup UI changes
  function observeDOM() {
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!node || node.nodeType !== 1) continue;

          if (isField(node) && shouldGuard(node)) {
            restoreField(node);
            continue;
          }

          const inner = qsa("input,textarea,select", node)
            .filter(isField)
            .filter(shouldGuard);

          for (const el of inner) restoreField(el);
        }
      }
    });

    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  // -----------------------------
  // Init
  // -----------------------------
  async function init() {
    if (!isChromeStorageOk) {
      console.warn("[guard.js] MBX_STORAGE not available.");
      return;
    }

    installListeners();
    observeDOM();

    // Load draft then restore
    draftCache = await getDraft();

    // Restore multiple times to "win" if popup.js sets values after load
    loading = true;
    await restoreAll();
    setTimeout(restoreAll, 30);
    setTimeout(restoreAll, 120);
    setTimeout(restoreAll, 300);
    setTimeout(() => { loading = false; }, 350);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
