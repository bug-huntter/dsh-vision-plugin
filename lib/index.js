// src/index.ts
import z from "@deepseek-ai/schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { symbols } from "@deepseek-ai/cordis";

// src/constants.ts
var VISION_PLUGIN_NAMESPACE = "vision-plugin";

// src/index.ts
var VisionPluginSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().default(""),
  modelId: z.string().default(""),
  apiKey: z.string().default(""),
  apiKeyEnv: z.string().default(""),
  prompt: z.string().default(""),
  timeoutMs: z.number().default(12e4)
});
var DEFAULT_TRANSCRIBE_PROMPT = "Transcribe and describe this image faithfully. Include all visible text verbatim (OCR). Then briefly describe any other relevant content such as diagrams, charts, UI elements, people, or the scene. Reply with only the transcription and description, without preamble.";
var TRANSCRIPTION_PREFIX = "[Image transcription]";
function withImage(modalities) {
  if (modalities === void 0 || modalities.includes("image")) return modalities;
  return [...modalities, "image"];
}
function errorMessage(value) {
  return value instanceof Error ? value.message : String(value);
}
function messageHasImage(content) {
  return content.some((block) => {
    if (block.type === "image") return true;
    if (block.type === "tool-result") return messageHasImage(block.content);
    return false;
  });
}
function collectImageRefs(content, out) {
  for (const block of content) {
    if (block.type === "image") {
      out.push(block.attachment);
      continue;
    }
    if (block.type === "tool-result" && block.content !== void 0) {
      collectImageRefs(block.content, out);
    }
  }
}
function mapBlocksReplacingImages(content, nextTranscription) {
  let changed = false;
  const result = [];
  for (const block of content) {
    if (block.type === "image") {
      result.push({ type: "text", text: nextTranscription() });
      changed = true;
    } else if (block.type === "tool-result" && block.content !== void 0) {
      const inner = mapBlocksReplacingImages(
        block.content,
        nextTranscription
      );
      if (inner === void 0) {
        result.push(block);
      } else {
        result.push({ ...block, content: inner });
        changed = true;
      }
    } else {
      result.push(block);
    }
  }
  return changed ? result : void 0;
}
async function resolveVisionKey(ctx, settings, llm) {
  const credentials = ctx.get("credentials");
  const resolveRef = async (ref) => {
    if (ref.length === 0) return void 0;
    if (credentials !== void 0) {
      try {
        const hit = await credentials.resolve(ref);
        if (hit?.value !== void 0 && hit.value.length > 0) return hit.value;
      } catch (_unresolvable) {
      }
    }
    const env = process.env[ref];
    return env !== void 0 && env.length > 0 ? env : void 0;
  };
  const fromEnv = await resolveRef(settings.apiKeyEnv);
  if (fromEnv !== void 0) return fromEnv;
  const instance = llm[symbols.original] ?? llm;
  const adaptersMap = Reflect.get(instance, "adapters");
  if (adaptersMap !== void 0) {
    const wantedBase = settings.baseUrl.replace(/\/+$/, "").toLowerCase();
    const candidates = [];
    for (const registration of adaptersMap.values()) {
      const adapter = registration?.adapter ?? void 0;
      const resolveApiKey = adapter?.config?.resolveApiKey;
      const profiles = adapter?.config?.profiles;
      if (typeof resolveApiKey !== "function" || typeof profiles !== "function") continue;
      let routeProfiles;
      try {
        routeProfiles = profiles.call(adapter?.config);
      } catch (_unreadable) {
        continue;
      }
      for (const [provider, profile] of routeProfiles) {
        const routeBase = (profile.piProvider?.baseUrl ?? "").replace(/\/+$/, "").toLowerCase();
        if (routeBase !== wantedBase) continue;
        if ((profile.apiKeyEnv ?? "").length === 0) continue;
        candidates.push(async () => {
          try {
            const key = await resolveApiKey.call(adapter?.config, provider, profile);
            return key !== void 0 && key.length > 0 ? key : void 0;
          } catch (_unresolvable) {
            return void 0;
          }
        });
      }
    }
    for (const candidate of candidates) {
      const key = await candidate();
      if (key !== void 0) return key;
    }
  }
  return settings.apiKey;
}
async function transcribeImage(data, mediaType, apiKey, settings, signal) {
  const base = settings.baseUrl.replace(/\/+$/, "");
  const url = `${base}/chat/completions`;
  const dataUrl = `data:${mediaType};base64,${Buffer.from(data).toString("base64")}`;
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), settings.timeoutMs ?? 12e4);
  const wire = signal === void 0 ? timeoutController.signal : AbortSignal.any([timeoutController.signal, signal]);
  try {
    const headers = { "content-type": "application/json" };
    if (apiKey.length > 0) headers.authorization = `Bearer ${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: settings.modelId,
        max_tokens: 4096,
        temperature: 0,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: settings.prompt?.trim() !== "" ? settings.prompt.trim() : DEFAULT_TRANSCRIBE_PROMPT }
          ]
        }]
      }),
      signal: wire
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`vision model request failed with HTTP ${response.status}: ${body.slice(0, 300)}`);
    }
    const parsed = JSON.parse(body);
    const content = parsed?.choices?.[0]?.message?.content;
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((part) => part?.text ?? "").join("") : "";
    if (text.trim().length === 0) throw new Error("vision model returned an empty transcription");
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}
function installImageGuardBypass(ctx, scope, llm) {
  const instance = llm[symbols.original] ?? llm;
  const proto = Object.getPrototypeOf(instance);
  const originalResolve = Object.getOwnPropertyDescriptor(proto, "resolveModelInfo")?.value;
  if (typeof originalResolve !== "function") return;
  const originalList = Object.getOwnPropertyDescriptor(proto, "listModels")?.value;
  let active = false;
  const activate = () => {
    if (active) return;
    instance.resolveModelInfo = async (provider, model, signal) => {
      const info = await originalResolve.call(instance, provider, model, signal);
      const modalities = withImage(info.inputModalities);
      return modalities === info.inputModalities ? info : { ...info, inputModalities: modalities };
    };
    if (typeof originalList === "function") {
      instance.listModels = async (provider) => {
        const models = await originalList.call(instance, provider);
        return models.map((model) => {
          const modalities = withImage(model.inputModalities);
          return modalities === model.inputModalities ? model : { ...model, inputModalities: modalities };
        });
      };
    }
    active = true;
  };
  const deactivate = () => {
    if (!active) return;
    delete instance.resolveModelInfo;
    if (typeof originalList === "function") delete instance.listModels;
    active = false;
  };
  const apply2 = (enabled) => {
    enabled ? activate() : deactivate();
  };
  apply2(scope.get().enabled);
  ctx.effect(() => {
    const unwatch = scope.watch((next) => apply2(next.enabled));
    return () => {
      unwatch();
      deactivate();
    };
  }, "vision-plugin: image capability advertisement");
}
function installImageTranscription(ctx, scope, llm) {
  const instance = llm[symbols.original] ?? llm;
  const originalStream = Reflect.get(instance, "streamWithRegistration");
  if (typeof originalStream !== "function") return;
  const stream = (options, prepared) => originalStream.call(instance, options, prepared);
  const transcribingStream = async function* (options, prepared) {
    const settings = scope.get();
    const needsTranscription = settings.enabled && settings.baseUrl.length > 0 && settings.modelId.length > 0 && options.messages.some((message) => message.role === "user" && messageHasImage(message.content));
    if (!needsTranscription) {
      yield* stream(options, prepared);
      return;
    }
    const attachments = ctx.get("attachments");
    try {
      if (options.signal?.aborted) {
        yield { type: "finish", reason: { kind: "aborted", failure: { message: "aborted", code: "ABORTED" } } };
        return;
      }
      if (attachments === void 0) {
        yield* stream(options, prepared);
        return;
      }
      const refs = [];
      for (const message of options.messages) {
        if (message.role !== "user") continue;
        collectImageRefs(message.content, refs);
      }
      if (refs.length === 0) {
        yield* stream(options, prepared);
        return;
      }
      const apiKey = await resolveVisionKey(ctx, settings, llm);
      const transcriptions = await Promise.all(refs.map((ref) => attachments.readImage(ref, options.signal).then((stored) => transcribeImage(stored.data, ref.mediaType, apiKey, settings, options.signal))));
      let cursor = 0;
      const nextTranscription = () => {
        const text = transcriptions[cursor];
        if (text === void 0) throw new Error("vision transcription queue exhausted");
        cursor += 1;
        return `${TRANSCRIPTION_PREFIX}
${text}`;
      };
      const transformed = options.messages.map((message) => {
        if (message.role !== "user") return message;
        const content = mapBlocksReplacingImages(message.content, nextTranscription);
        return content === void 0 ? message : { ...message, content };
      });
      yield* stream({ ...options, messages: transformed }, prepared);
    } catch (error) {
      yield {
        type: "finish",
        reason: {
          kind: "error",
          failure: { message: `vision-plugin: image transcription failed: ${errorMessage(error)}`, code: "VISION_TRANSCRIBE_FAILED" }
        }
      };
    }
  };
  ctx.effect(() => {
    Object.defineProperty(instance, "streamWithRegistration", {
      value: (options, prepared) => {
        if (scope.get().enabled) return transcribingStream(options, prepared);
        return stream(options, prepared);
      },
      writable: true,
      configurable: true
    });
    return () => {
      delete instance.streamWithRegistration;
    };
  }, "vision-plugin: image transcription boundary");
}
function apply(ctx) {
  let scope;
  ctx.inject(["settings"], (settingsCtx) => {
    scope = settingsCtx.settings.register(settingsNamespace(VISION_PLUGIN_NAMESPACE), VisionPluginSettingsSchema);
  });
  ctx.inject(["settings", "llm", "attachments"], (both) => {
    if (scope === void 0) return;
    try {
      installImageGuardBypass(both, scope, both.llm);
      installImageTranscription(both, scope, both.llm);
    } catch (error) {
      const logger = both.logger ?? ctx.logger;
      logger?.error("vision-plugin: failed to install image pipeline patches", error);
    }
  });
  ctx.inject(["settings", "llm"], (both) => {
    const handle = both.llm.registerConfigurableProviders([{
      provider: "vision-plugin-settings",
      displayName: "\u8BC6\u56FE\u6A21\u578B\u914D\u7F6E",
      settingsNs: VISION_PLUGIN_NAMESPACE,
      settingsPath: []
    }]);
    both.effect(() => handle, "vision-plugin: settings namespace exposure");
  });
}
export {
  VISION_PLUGIN_NAMESPACE,
  apply
};
