const USER_CFG_KEY = "mbx_username_config";
const STYLE_CFG_KEY = "mbx_text_styles";

const uEnabled = document.getElementById("uEnabled");
const uOld = document.getElementById("uOld");
const uNew = document.getElementById("uNew");

const pEnabled = document.getElementById("pEnabled");
const pUrl = document.getElementById("pUrl");

const pBorderEnabled = document.getElementById("pBorderEnabled");
const pBorderColor = document.getElementById("pBorderColor");
const pBorderColorText = document.getElementById("pBorderColorText");

const rText = document.getElementById("rText");
const rColor = document.getElementById("rColor");
const rBold = document.getElementById("rBold");
const rGlow = document.getElementById("rGlow");

function normalizeHex(val) {
  let v = String(val || "").trim();
  if (!v) return "#FFD400";
  if (/^[0-9a-fA-F]{6}$/.test(v)) v = "#" + v;
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) return "#FFD400";
  return v.toUpperCase();
}

// Keep text + picker in sync
pBorderColor.addEventListener("input", () => {
  pBorderColorText.value = pBorderColor.value.toUpperCase();
});

pBorderColorText.addEventListener("input", () => {
  const n = normalizeHex(pBorderColorText.value);
  pBorderColor.value = n;
});

function load() {
  chrome.storage.local.get([USER_CFG_KEY, STYLE_CFG_KEY], (data) => {
    const userCfg = data[USER_CFG_KEY] || {
      enabled: true,
      oldName: "",
      newName: "",
      pfpEnabled: false,
      pfpUrl: "",
      pfpBorderEnabled: false,
      pfpBorderColor: "#FFD400"
    };

    const rules = Array.isArray(data[STYLE_CFG_KEY]) ? data[STYLE_CFG_KEY] : [];

    uEnabled.checked = !!userCfg.enabled;
    uOld.value = userCfg.oldName || "";
    uNew.value = userCfg.newName || "";

    pEnabled.checked = !!userCfg.pfpEnabled;
    pUrl.value = userCfg.pfpUrl || "";

    pBorderEnabled.checked = !!userCfg.pfpBorderEnabled;

    const bc = normalizeHex(userCfg.pfpBorderColor || "#FFD400");
    pBorderColor.value = bc;
    pBorderColorText.value = bc;

    // 1 rule max
    const r = rules[0] || { text: "", color: "#FFD400", bold: true, glow: true, enabled: true };
    rText.value = r.text || "";
    rColor.value = r.color || "#FFD400";
    rBold.checked = !!r.bold;
    rGlow.checked = !!r.glow;
  });
}

document.getElementById("saveAll").addEventListener("click", () => {
  const userCfg = {
    enabled: !!uEnabled.checked,
    oldName: (uOld.value || "").trim(),
    newName: (uNew.value || "").trim(),
    pfpEnabled: !!pEnabled.checked,
    pfpUrl: (pUrl.value || "").trim(),
    pfpBorderEnabled: !!pBorderEnabled.checked,
    pfpBorderColor: normalizeHex(pBorderColorText.value || pBorderColor.value)
  };

  const text = (rText.value || "").trim();
  const rule = {
    text,
    color: (rColor.value || "#FFD400").trim(),
    bold: !!rBold.checked,
    glow: !!rGlow.checked,
    enabled: true
  };

  const rules = text ? [rule] : [];

  chrome.storage.local.set(
    { [USER_CFG_KEY]: userCfg, [STYLE_CFG_KEY]: rules },
    () => window.close()
  );
});

document.getElementById("clearAll").addEventListener("click", () => {
  chrome.storage.local.remove([USER_CFG_KEY, STYLE_CFG_KEY], () => window.close());
});

load();
