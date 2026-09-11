/**
 * Simplified Chinese dictionary for the vision plugin.
 */
export const zh = {
  'section.nav': '识图模型配置',
  'section.title': '识图模型配置',
  'section.description': '配置图片识别所使用的视觉模型参数',

  'loading': '正在加载识图配置…',
  'unavailable': '无法读取识图配置：设置命名空间未注册，或当前连接为只读',

  'enabled.label': '启用图片识别',
  'enabled.description': '开启后，AI 可以识别并理解用户上传的图片内容',

  'model.baseUrl': 'Base URL',
  'model.baseUrl.placeholder': 'https://api.example.com/v1',
  'model.baseUrl.description': '视觉模型 API 的基础地址',

  'model.modelId': 'Model ID',
  'model.modelId.placeholder': 'gpt-4o-vision-preview',
  'model.modelId.description': '用于视觉任务的模型标识符',

  'model.fallbackModelId': '备用模型（可选）',
  'model.fallbackModelId.placeholder': 'qwen/qwen3.8-flash',
  'model.fallbackModelId.description': '主模型遇 429 限流/5xx 且重试耗尽后自动切换的备用模型；留空则只使用主模型（OpenRouter 等聚合平台常因上游限流需要备用模型）',

  'model.maxRetries': '重试次数',
  'model.maxRetries.description': '遇到 429 限流、5xx 或网络错误时的指数退避重试次数（0–10，默认 3），会遵循服务端 Retry-After',

  'test.button': '测试连接',
  'test.testing': '正在测试连接…',
  'test.hint': '保存前会自动用当前配置测试连通性与图片支持，也可点此手动测试。只有配置类错误（地址/模型错误、密钥无效、模型不支持图片）才阻止保存；429/5xx 等临时错误仍可保存。',
  'test.ok': '测试通过',
  'test.warn': '测试未完全通过（仍可保存）',
  'test.blocked': '测试未通过，已阻止保存',

  'model.apiKey': 'API Key',
  'model.apiKey.placeholder': 'sk-xxxxxxxxxxxxxxxx',
  'model.apiKey.description': 'API 密钥（敏感信息，请妥善保管）。填写后即用于识图请求，优先于「复用同 Base URL 路由的密钥」',
  'model.apiKeyEnv': '密钥来源（变量名）',
  'model.apiKeyEnv.placeholder': 'OPENROUTER_API_KEY',
  'model.apiKeyEnv.description': '环境变量或凭证名。留空时优先使用下面的 API Key 字段，两者都留空才自动复用同 Base URL 路由已配置的密钥。优先级：密钥来源 > API Key > 复用路由',

  'save': '保存',
  'saving': '保存中...',
  'saved': '已保存',
  'saveFailed': '保存失败，请重试',
  'discard': '放弃修改',
  'readOnly': '当前环境为只读，无法保存配置',
  'unsaved': '有未保存的修改',
  'collapse': '收起',
  'expand': '展开',

  'validation.required': '此项为必填',
  'validation.invalidUrl': '请输入有效的 URL 地址',
} satisfies Record<string, string>

export type VisionPluginKey = keyof typeof zh

export const en: Record<VisionPluginKey, string> = {
  'section.nav': 'Vision Model Config',
  'section.title': 'Vision Model Configuration',
  'section.description': 'Configure vision model parameters for image recognition',

  'loading': 'Loading vision settings…',
  'unavailable': 'Vision settings are unavailable: the namespace is not registered or this connection is read-only',

  'enabled.label': 'Enable Image Recognition',
  'enabled.description': 'When enabled, AI can recognize and understand uploaded images',

  'model.baseUrl': 'Base URL',
  'model.baseUrl.placeholder': 'https://api.example.com/v1',
  'model.baseUrl.description': 'Base URL of the vision model API',

  'model.modelId': 'Model ID',
  'model.modelId.placeholder': 'gpt-4o-vision-preview',
  'model.modelId.description': 'Model identifier for vision tasks',

  'model.fallbackModelId': 'Fallback Model (optional)',
  'model.fallbackModelId.placeholder': 'qwen/qwen3.8-flash',
  'model.fallbackModelId.description': 'Used when the primary model keeps failing with transient errors (429/5xx) after retries; empty means primary only (aggregators like OpenRouter often need a fallback due to upstream rate limits)',

  'model.maxRetries': 'Retries',
  'model.maxRetries.description': 'Exponential-backoff retries for 429 rate limits, 5xx or network errors (0-10, default 3); honors the server Retry-After header',

  'test.button': 'Test connection',
  'test.testing': 'Testing connection…',
  'test.hint': 'A connectivity & image-support check runs automatically with the current draft config before saving; you can also run it manually here. Only real config errors (bad URL/model, invalid key, model without image support) block the save — transient 429/5xx still save.',
  'test.ok': 'Test passed',
  'test.warn': 'Test not fully passed (save still allowed)',
  'test.blocked': 'Test failed — save blocked',

  'model.apiKey': 'API Key',
  'model.apiKey.placeholder': 'sk-xxxxxxxxxxxxxxxx',
  'model.apiKey.description': 'API key (sensitive information, handle with care). Once filled it is used as-is for image requests, ahead of route key reuse',
  'model.apiKeyEnv': 'Key Source (env/credential name)',
  'model.apiKeyEnv.placeholder': 'OPENROUTER_API_KEY',
  'model.apiKeyEnv.description': 'Environment variable or credential reference. When empty, the literal API Key below wins; only when both are empty is the key of the model route sharing this Base URL reused. Priority: this field > API Key > route reuse',

  'save': 'Save',
  'saving': 'Saving...',
  'saved': 'Saved',
  'saveFailed': 'Save failed, please retry',
  'discard': 'Discard',
  'readOnly': 'Read-only environment, cannot save configuration',
  'unsaved': 'Unsaved changes',
  'collapse': 'Collapse',
  'expand': 'Expand',

  'validation.required': 'This field is required',
  'validation.invalidUrl': 'Please enter a valid URL',
}
