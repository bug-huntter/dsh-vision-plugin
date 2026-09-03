/**
 * Simplified Chinese dictionary for the vision plugin.
 */
export const zh = {
  'tab.label': '图片识别功能',
  'tab.description': '启用或禁用 AI 的图片识别能力，并可配置识图模型',

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

  'model.apiKey': 'API Key',
  'model.apiKey.placeholder': 'sk-xxxxxxxxxxxxxxxx',
  'model.apiKey.description': 'API 密钥（敏感信息，请妥善保管）',
  'model.apiKeyEnv': '密钥来源（变量名）',
  'model.apiKeyEnv.placeholder': 'OPENROUTER_API_KEY',
  'model.apiKeyEnv.description': '环境变量或凭证名。留空则自动复用同 Base URL 路由已配置的密钥。优先级：此字段 > 复用路由 > API Key',

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
  'tab.label': 'Image Recognition',
  'tab.description': 'Enable or disable AI image recognition and configure the vision model',

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

  'model.apiKey': 'API Key',
  'model.apiKey.placeholder': 'sk-xxxxxxxxxxxxxxxx',
  'model.apiKey.description': 'API key (sensitive information, handle with care)',
  'model.apiKeyEnv': 'Key Source (env/credential name)',
  'model.apiKeyEnv.placeholder': 'OPENROUTER_API_KEY',
  'model.apiKeyEnv.description': 'Environment variable or credential reference. When empty, the key of the model route sharing this Base URL is reused. Priority: this field > route reuse > API Key',

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
