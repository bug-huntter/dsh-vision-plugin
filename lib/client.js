window.__ModuleLoader__.load({ id: "@dsh/vision-plugin", factory: (require) => { var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_client = require("@deepseek-ai/dsh-client-runtime/client");

// src/constants.ts
var VISION_PLUGIN_NAMESPACE = "vision-plugin";

// src/client/VisionPluginsTab.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var styles = {
  tab: { padding: "8px 0" },
  card: {
    border: "1px solid var(--dsw-alias-border-l2)",
    borderRadius: "12px",
    background: "var(--dsw-alias-bg-layer-3)",
    transition: "border-color 0.16s, background 0.16s"
  },
  cardBody: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "14px 16px"
  },
  cardInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    flex: 1,
    minWidth: 0
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: 1.4,
    color: "var(--dsw-alias-label-primary)",
    margin: 0
  },
  cardDesc: {
    fontSize: "13px",
    lineHeight: 1.5,
    color: "var(--dsw-alias-label-tertiary)",
    margin: 0
  },
  controls: { flex: "none", display: "flex", alignItems: "center", gap: "8px" },
  failed: { fontSize: "12px", color: "var(--dsw-alias-label-error)", lineHeight: 1.5 },
  toggle: { position: "relative", display: "inline-block", cursor: "pointer" },
  toggleInput: { position: "absolute", opacity: 0, width: 0, height: 0 },
  toggleTrack: {
    display: "block",
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    background: "var(--dsw-alias-bg-module-platform)",
    transition: "background 0.2s",
    border: "1px solid var(--dsw-alias-border-l2)",
    position: "relative"
  },
  toggleThumb: {
    position: "absolute",
    top: "2px",
    left: "2px",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "white",
    transition: "transform 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
  },
  toggleTrackChecked: {
    display: "block",
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    background: "var(--dsw-alias-brand-primary)",
    transition: "background 0.2s",
    border: "1px solid var(--dsw-alias-brand-primary)",
    position: "relative"
  },
  toggleThumbChecked: {
    position: "absolute",
    top: "2px",
    left: "2px",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "white",
    transition: "transform 0.2s",
    transform: "translateX(20px)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
  }
};
function VisionPluginsTab(props) {
  const { t, useEnabled, useSaving, useFailed, useWritable, onToggle } = props;
  const enabled = useEnabled((e) => e);
  const saving = useSaving((s2) => s2);
  const failed = useFailed((f) => f);
  const writable = useWritable((w) => w);
  const trackStyle = enabled ? styles.toggleTrackChecked : styles.toggleTrack;
  const thumbStyle = enabled ? styles.toggleThumbChecked : styles.toggleThumb;
  const disabled = saving || !writable;
  const disabledStyle = disabled ? { ...styles.toggle, opacity: 0.5, cursor: "default" } : styles.toggle;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.tab, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: styles.card, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.cardBody, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.cardInfo, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: styles.cardTitle, children: t("tab.label") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.cardDesc, children: t("tab.description") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: styles.controls, children: [
      failed ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.failed, children: t("saveFailed") }) : null,
      !writable ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: styles.failed, children: t("readOnly") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: disabledStyle, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            style: styles.toggleInput,
            checked: enabled,
            disabled,
            onChange: onToggle
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: trackStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: thumbStyle }) })
      ] })
    ] })
  ] }) }) });
}

// src/client/VisionModelsSection.tsx
var import_react = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var s = {
  section: { padding: "24px 0" },
  heading: { fontSize: "18px", fontWeight: 600, lineHeight: 1.4, color: "var(--dsw-alias-label-primary)", margin: "0 0 8px" },
  intro: { fontSize: "13px", lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary)", margin: "0 0 24px" },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "12px 0",
    borderBottom: "1px solid var(--dsw-alias-border-l2)",
    marginBottom: "24px"
  },
  toggleInfo: { display: "flex", flexDirection: "column", gap: "4px" },
  toggleLabel: { fontSize: "15px", fontWeight: 600, lineHeight: 1.4, color: "var(--dsw-alias-label-primary)" },
  toggleDesc: { fontSize: "13px", lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary)" },
  toggle: { position: "relative", display: "inline-block", flex: "none", cursor: "pointer" },
  toggleInput: { position: "absolute", opacity: 0, width: 0, height: 0 },
  toggleTrack: {
    display: "block",
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    background: "var(--dsw-alias-bg-module-platform)",
    transition: "background 0.2s",
    border: "1px solid var(--dsw-alias-border-l2)",
    position: "relative"
  },
  toggleThumb: {
    position: "absolute",
    top: "2px",
    left: "2px",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "white",
    transition: "transform 0.2s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
  },
  toggleTrackChecked: {
    display: "block",
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    background: "var(--dsw-alias-brand-primary)",
    transition: "background 0.2s",
    border: "1px solid var(--dsw-alias-brand-primary)",
    position: "relative"
  },
  toggleThumbChecked: {
    position: "absolute",
    top: "2px",
    left: "2px",
    width: "18px",
    height: "18px",
    borderRadius: "50%",
    background: "white",
    transition: "transform 0.2s",
    transform: "translateX(20px)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
  },
  field: { marginBottom: "20px" },
  label: {
    display: "block",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.5,
    color: "var(--dsw-alias-label-primary)",
    marginBottom: "6px"
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid var(--dsw-alias-border-l2)",
    borderRadius: "8px",
    padding: "8px 12px",
    font: "inherit",
    fontSize: "14px",
    lineHeight: 1.5,
    color: "var(--dsw-alias-label-primary)",
    background: "var(--dsw-alias-bg-layer-3)",
    transition: "border-color 0.16s",
    outline: "none"
  },
  hint: { margin: "4px 0 0", fontSize: "12px", lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary)" },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    paddingTop: "16px",
    borderTop: "1px solid var(--dsw-alias-border-l2)",
    marginTop: "8px"
  },
  failed: { flex: 1, minWidth: 0, margin: 0, fontSize: "12px", lineHeight: 1.5, color: "var(--dsw-alias-label-error)" },
  disabled: { opacity: 0.4, cursor: "default" }
};
function btn(base, disabled) {
  return disabled ? { ...base, ...s.disabled } : base;
}
function VisionModelsSection(props) {
  const { t, useSettings, edit, discard, save } = props;
  const state = useSettings((s2) => s2);
  const fieldId = (0, import_react.useId)();
  if (state.status !== "ready") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: s.section, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: s.hint, children: t(state.status === "loading" ? "loading" : "unavailable") }) });
  }
  const dis = !state.writable || state.saving;
  const trackSt = state.enabled ? s.toggleTrackChecked : s.toggleTrack;
  const thumbSt = state.enabled ? s.toggleThumbChecked : s.toggleThumb;
  const inputEnabled = { ...s.input, opacity: dis ? 0.5 : 1, cursor: dis ? "default" : "text" };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.section, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h2", { style: s.heading, children: t("section.title") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: s.intro, children: t("section.description") }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.toggleRow, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.toggleInfo, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: s.toggleLabel, children: t("enabled.label") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: s.toggleDesc, children: t("enabled.description") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("label", { style: s.toggle, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "input",
          {
            type: "checkbox",
            style: s.toggleInput,
            checked: state.enabled,
            disabled: !state.writable,
            onChange: (e) => {
              edit("enabled", e.target.checked ? "true" : "false");
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: trackSt, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: thumbSt }) })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.field, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: s.label, htmlFor: `${fieldId}-bu`, children: t("model.baseUrl") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          id: `${fieldId}-bu`,
          style: inputEnabled,
          type: "text",
          value: state.baseUrl,
          placeholder: t("model.baseUrl.placeholder"),
          disabled: !state.writable,
          onChange: (e) => {
            edit("baseUrl", e.target.value);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: s.hint, children: t("model.baseUrl.description") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.field, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: s.label, htmlFor: `${fieldId}-mi`, children: t("model.modelId") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          id: `${fieldId}-mi`,
          style: inputEnabled,
          type: "text",
          value: state.modelId,
          placeholder: t("model.modelId.placeholder"),
          disabled: !state.writable,
          onChange: (e) => {
            edit("modelId", e.target.value);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: s.hint, children: t("model.modelId.description") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.field, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: s.label, htmlFor: `${fieldId}-ake`, children: t("model.apiKeyEnv") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          id: `${fieldId}-ake`,
          style: inputEnabled,
          type: "text",
          value: state.apiKeyEnv,
          placeholder: t("model.apiKeyEnv.placeholder"),
          disabled: !state.writable,
          onChange: (e) => {
            edit("apiKeyEnv", e.target.value);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: s.hint, children: t("model.apiKeyEnv.description") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.field, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { style: s.label, htmlFor: `${fieldId}-ak`, children: t("model.apiKey") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          id: `${fieldId}-ak`,
          style: inputEnabled,
          type: "password",
          autoComplete: "off",
          value: state.apiKey,
          placeholder: t("model.apiKey.placeholder"),
          disabled: !state.writable,
          onChange: (e) => {
            edit("apiKey", e.target.value);
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: s.hint, children: t("model.apiKey.description") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: s.footer, children: [
      state.failed ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: s.failed, role: "status", children: t("saveFailed") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          style: btn(s.discardBtn, !state.dirty || state.saving),
          disabled: !state.dirty || state.saving,
          onClick: discard,
          children: t("discard")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          style: btn(s.saveBtn, !state.dirty || state.saving),
          disabled: !state.dirty || state.saving,
          onClick: save,
          children: t(state.saving ? "saving" : "save")
        }
      )
    ] })
  ] });
}
s.discardBtn = {
  appearance: "none",
  border: "1px solid var(--dsw-alias-border-l2)",
  borderRadius: "8px",
  padding: "5px 14px",
  font: "inherit",
  fontSize: "13px",
  lineHeight: 1.5,
  cursor: "pointer",
  background: "none",
  color: "var(--dsw-alias-label-secondary)"
};
s.saveBtn = {
  appearance: "none",
  border: "1px solid transparent",
  borderRadius: "8px",
  padding: "5px 14px",
  font: "inherit",
  fontSize: "13px",
  lineHeight: 1.5,
  cursor: "pointer",
  background: "var(--dsw-alias-label-primary)",
  color: "var(--dsw-alias-bg-layer-3)"
};

// src/client/locales.ts
var zh = {
  "tab.label": "\u56FE\u7247\u8BC6\u522B\u529F\u80FD",
  "tab.description": "\u542F\u7528\u6216\u7981\u7528 AI \u7684\u56FE\u7247\u8BC6\u522B\u80FD\u529B\uFF0C\u5E76\u53EF\u914D\u7F6E\u8BC6\u56FE\u6A21\u578B",
  "section.nav": "\u8BC6\u56FE\u6A21\u578B\u914D\u7F6E",
  "section.title": "\u8BC6\u56FE\u6A21\u578B\u914D\u7F6E",
  "section.description": "\u914D\u7F6E\u56FE\u7247\u8BC6\u522B\u6240\u4F7F\u7528\u7684\u89C6\u89C9\u6A21\u578B\u53C2\u6570",
  "loading": "\u6B63\u5728\u52A0\u8F7D\u8BC6\u56FE\u914D\u7F6E\u2026",
  "unavailable": "\u65E0\u6CD5\u8BFB\u53D6\u8BC6\u56FE\u914D\u7F6E\uFF1A\u8BBE\u7F6E\u547D\u540D\u7A7A\u95F4\u672A\u6CE8\u518C\uFF0C\u6216\u5F53\u524D\u8FDE\u63A5\u4E3A\u53EA\u8BFB",
  "enabled.label": "\u542F\u7528\u56FE\u7247\u8BC6\u522B",
  "enabled.description": "\u5F00\u542F\u540E\uFF0CAI \u53EF\u4EE5\u8BC6\u522B\u5E76\u7406\u89E3\u7528\u6237\u4E0A\u4F20\u7684\u56FE\u7247\u5185\u5BB9",
  "model.baseUrl": "Base URL",
  "model.baseUrl.placeholder": "https://api.example.com/v1",
  "model.baseUrl.description": "\u89C6\u89C9\u6A21\u578B API \u7684\u57FA\u7840\u5730\u5740",
  "model.modelId": "Model ID",
  "model.modelId.placeholder": "gpt-4o-vision-preview",
  "model.modelId.description": "\u7528\u4E8E\u89C6\u89C9\u4EFB\u52A1\u7684\u6A21\u578B\u6807\u8BC6\u7B26",
  "model.apiKey": "API Key",
  "model.apiKey.placeholder": "sk-xxxxxxxxxxxxxxxx",
  "model.apiKey.description": "API \u5BC6\u94A5\uFF08\u654F\u611F\u4FE1\u606F\uFF0C\u8BF7\u59A5\u5584\u4FDD\u7BA1\uFF09",
  "model.apiKeyEnv": "\u5BC6\u94A5\u6765\u6E90\uFF08\u53D8\u91CF\u540D\uFF09",
  "model.apiKeyEnv.placeholder": "OPENROUTER_API_KEY",
  "model.apiKeyEnv.description": "\u73AF\u5883\u53D8\u91CF\u6216\u51ED\u8BC1\u540D\u3002\u7559\u7A7A\u5219\u81EA\u52A8\u590D\u7528\u540C Base URL \u8DEF\u7531\u5DF2\u914D\u7F6E\u7684\u5BC6\u94A5\u3002\u4F18\u5148\u7EA7\uFF1A\u6B64\u5B57\u6BB5 > \u590D\u7528\u8DEF\u7531 > API Key",
  "save": "\u4FDD\u5B58",
  "saving": "\u4FDD\u5B58\u4E2D...",
  "saved": "\u5DF2\u4FDD\u5B58",
  "saveFailed": "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5",
  "discard": "\u653E\u5F03\u4FEE\u6539",
  "readOnly": "\u5F53\u524D\u73AF\u5883\u4E3A\u53EA\u8BFB\uFF0C\u65E0\u6CD5\u4FDD\u5B58\u914D\u7F6E",
  "unsaved": "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539",
  "collapse": "\u6536\u8D77",
  "expand": "\u5C55\u5F00",
  "validation.required": "\u6B64\u9879\u4E3A\u5FC5\u586B",
  "validation.invalidUrl": "\u8BF7\u8F93\u5165\u6709\u6548\u7684 URL \u5730\u5740"
};
var en = {
  "tab.label": "Image Recognition",
  "tab.description": "Enable or disable AI image recognition and configure the vision model",
  "section.nav": "Vision Model Config",
  "section.title": "Vision Model Configuration",
  "section.description": "Configure vision model parameters for image recognition",
  "loading": "Loading vision settings\u2026",
  "unavailable": "Vision settings are unavailable: the namespace is not registered or this connection is read-only",
  "enabled.label": "Enable Image Recognition",
  "enabled.description": "When enabled, AI can recognize and understand uploaded images",
  "model.baseUrl": "Base URL",
  "model.baseUrl.placeholder": "https://api.example.com/v1",
  "model.baseUrl.description": "Base URL of the vision model API",
  "model.modelId": "Model ID",
  "model.modelId.placeholder": "gpt-4o-vision-preview",
  "model.modelId.description": "Model identifier for vision tasks",
  "model.apiKey": "API Key",
  "model.apiKey.placeholder": "sk-xxxxxxxxxxxxxxxx",
  "model.apiKey.description": "API key (sensitive information, handle with care)",
  "model.apiKeyEnv": "Key Source (env/credential name)",
  "model.apiKeyEnv.placeholder": "OPENROUTER_API_KEY",
  "model.apiKeyEnv.description": "Environment variable or credential reference. When empty, the key of the model route sharing this Base URL is reused. Priority: this field > route reuse > API Key",
  "save": "Save",
  "saving": "Saving...",
  "saved": "Saved",
  "saveFailed": "Save failed, please retry",
  "discard": "Discard",
  "readOnly": "Read-only environment, cannot save configuration",
  "unsaved": "Unsaved changes",
  "collapse": "Collapse",
  "expand": "Expand",
  "validation.required": "This field is required",
  "validation.invalidUrl": "Please enter a valid URL"
};

// src/client/index.ts
var NS = "vision-plugin";
var inject = ["slots", "locale", "connection", "remote", "settingsScope"];
function buildState(scopeSnapshot, drafts, saving, failed) {
  const value = scopeSnapshot.value;
  const enabledDraft = drafts.get("enabled");
  const baseUrlDraft = drafts.get("baseUrl");
  const modelIdDraft = drafts.get("modelId");
  const apiKeyDraft = drafts.get("apiKey");
  const apiKeyEnvDraft = drafts.get("apiKeyEnv");
  return {
    status: scopeSnapshot.status,
    writable: scopeSnapshot.writable,
    enabled: enabledDraft !== void 0 ? enabledDraft.text === "true" : value?.enabled ?? false,
    baseUrl: baseUrlDraft?.text ?? value?.baseUrl ?? "",
    modelId: modelIdDraft?.text ?? value?.modelId ?? "",
    apiKey: apiKeyDraft?.text ?? value?.apiKey ?? "",
    apiKeyEnv: apiKeyEnvDraft?.text ?? value?.apiKeyEnv ?? "",
    dirty: Array.from(drafts.values()).some((d) => d.dirty),
    saving,
    failed
  };
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "vision-plugin: dictionaries");
  const t = ctx.locale.bind(NS);
  const scope = ctx.settingsScope.bind({ namespace: VISION_PLUGIN_NAMESPACE });
  const drafts = /* @__PURE__ */ new Map();
  let saving = false;
  let failed = false;
  const publishSnapshot = () => buildState(scope.getSnapshot(), drafts, saving, failed);
  const store = (0, import_client.createSnapshotStore)(publishSnapshot());
  const publish = () => {
    store.set(publishSnapshot());
  };
  scope.subscribe(() => {
    publish();
  });
  const editSection = (field, text) => {
    drafts.set(field, { text, dirty: true });
    failed = false;
    publish();
  };
  const discardSection = () => {
    drafts.clear();
    failed = false;
    publish();
  };
  const saveSection = async () => {
    if (saving || !Array.from(drafts.values()).some((d) => d.dirty)) return;
    saving = true;
    failed = false;
    publish();
    try {
      for (const [field, draft] of drafts) {
        if (!draft.dirty) continue;
        if (field === "enabled") {
          await scope.set("enabled", draft.text === "true");
        } else {
          await scope.set(field, draft.text);
        }
      }
      await scope.load();
      drafts.clear();
    } catch (error) {
      failed = true;
      console.error("vision-plugin: failed to save section", error);
    } finally {
      saving = false;
      publish();
    }
  };
  const onToggle = () => {
    const snapshot = publishSnapshot();
    if (snapshot.saving || !snapshot.writable) return;
    const current = snapshot.enabled;
    saving = true;
    failed = false;
    publish();
    scope.set("enabled", !current).then(() => scope.load()).catch((error) => {
      failed = true;
      console.error("vision-plugin: failed to toggle enabled state", error);
    }).finally(() => {
      saving = false;
      publish();
    });
  };
  const sectionInjected = () => ({
    hooks: {
      settings: {
        getSnapshot: () => store.getSnapshot(),
        subscribe: (listener) => store.subscribe(listener)
      }
    },
    t,
    edit: editSection,
    discard: discardSection,
    save: saveSection
  });
  const tabInjected = () => ({
    hooks: {
      enabled: {
        getSnapshot: () => store.getSnapshot().enabled,
        subscribe: (listener) => store.subscribe(listener)
      },
      saving: {
        getSnapshot: () => store.getSnapshot().saving,
        subscribe: (listener) => store.subscribe(listener)
      },
      failed: {
        getSnapshot: () => store.getSnapshot().failed,
        subscribe: (listener) => store.subscribe(listener)
      },
      writable: {
        getSnapshot: () => store.getSnapshot().writable,
        subscribe: (listener) => store.subscribe(listener)
      }
    },
    t,
    onToggle
  });
  ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
    name: "settings.plugins.tab",
    id: "vision-plugin",
    order: 100,
    label: () => t("tab.label"),
    inject: tabInjected
  }, VisionPluginsTab));
  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "vision-models",
    order: 60,
    label: () => t("section.nav"),
    inject: sectionInjected
  }, VisionModelsSection));
}
return module.exports; } });
//# sourceMappingURL=client.js.map
