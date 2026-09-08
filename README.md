# dsh-vision-plugin

DSH 图片识别插件 — 为 AI 会话添加图片理解能力。

在 **识图模型配置** 页面启用识别功能，并配置视觉模型的 Base URL、Model ID 和 API Key。

## 安装（通过 DSH 市场）
1. 打开 DSH Web GUI → **设置 → 插件** → **市场**
2. 添加仓库源 `https://github.com/bug-huntter/dsh-vision-plugin`
3. 扫描并安装

## 手动安装
```bash
dsh plugin add @lp181818/dsh-vision-plugin
```

## 效果展示

### 插件配置页（设置 → 识图模型配置）

<img src="./img/vision-plugin2.png" alt="识图模型配置面板" width="700" />

在设置面板左侧导航的「识图模型配置」中，您可以配置：
- **启用图片识别** — 主开关，开启后 AI 可以识别并理解用户上传的图片内容
- **Base URL** — 视觉模型 API 的基础地址
- **Model ID** — 用于视觉任务的模型标识符
- **备用模型（可选）** — 主模型在重试耗尽后仍遇 429/5xx 限流时自动切换的备用模型；聚合平台（OpenRouter/ARK）常因上游限流，建议填一个备选（如 `qwen/qwen3.8-flash`）
- **重试次数** — 遇到 429 限流、5xx 或网络错误时的指数退避重试次数（0–10，默认 3），会遵循服务端 `Retry-After` 头
- **密钥来源（变量名）** — 环境变量或凭证名，留空自动复用同路由已配置的密钥
- **API Key** — 实际 API 密钥（敏感信息，妥善保管）

> **保存前自动测试**：点击保存时，插件会用**当前填写的内容**在浏览器里向视觉模型发一张内嵌测试图，验证连通性与图片输入支持。只有配置类错误（地址/模型错误、密钥无效、模型不支持图片）才阻止保存；429/5xx 等临时限流仍可保存，不会把你锁在设置页外。

## 支持的服务

插件内部只做一次标准的 **OpenAI 兼容** `POST {baseUrl}/chat/completions` 请求（`Authorization: Bearer <key>`），因此**不限于 OpenRouter**。任何提供 OpenAI 兼容 `/chat/completions` 接口的服务都可用：

| 服务 | Base URL 示例 | 模型 ID 示例 |
|---|---|---|
| OpenRouter | `https://openrouter.ai/api/v1` | `qwen/qwen3.8-27b`、`openai/gpt-4o-vision` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| 火山方舟 ARK（Agent Plan / Coding Plan） | `https://ark.cn-beijing.volces.com/api/plan/v3` | `Doubao-Seed-Evolving`、`doubao-seed-evolving-latest-version` |
| 本地 / 自建 OpenAI 兼容网关 | `http://<host>:<port>/v1` | 服务端已部署的模型 ID |

> 用聚合平台（OpenRouter / ARK）时，模型名需使用该平台登记的完整标识符；`baseUrl` 填到**不含** `/chat/completions` 的根地址，插件会自动拼接。

## v1.1.0 可靠性改进

针对 **OpenRouter 等聚合平台上游限流（HTTP 429）** 导致的识图失败：

- **指数退避重试**：429 / 5xx / 网络错误自动重试（默认 3 次），间隔指数递增并加抖动，且优先遵循服务端 `Retry-After` 头；单次请求超时可配（`timeoutMs`，默认 120 秒）
- **备用模型切换**：主模型重试耗尽仍失败时，自动改用「备用模型」再尝试一轮
- **清晰的错误提示**：请求未携带 API Key 时（401/403/429），错误信息会附带中文提示，指到「设置 → 识图模型配置 → API Key 字段」
- **不再污染对话**：转写失败不再以错误块终止整轮会话；图片会被替换成一条「图片转写失败」的文本占位，对话继续正常流式回复，错误细节仅写入插件日志
- **保存前连通性测试**：设置页在保存前用当前草稿配置实测「连通性 + 图片输入支持」，配置类错误阻止保存，临时限流仅告警

新增可配置项（均可写在 `~/.dsh/settings.yaml` 的 `vision-plugin` 段，重启不丢）：

```yaml
vision-plugin:
  enabled: true
  baseUrl: https://openrouter.ai/api/v1
  modelId: qwen/qwen3.8-27b
  fallbackModelId: qwen/qwen3.8-flash   # 可选：备用模型
  maxRetries: 3                          # 可选：0-10，默认 3
  apiKey: sk-or-v1-...                   # 或通过 apiKeyEnv / 路由复用解析


## 安装

### DSH 版本兼容

| DSH 版本 | 兼容性 |
| --- | --- |
| `0.1.2-rc.1` 及同代 0.1.2 rc | 已适配（当前本机验证版本） |
| `0.1.0-rc.7` 至 0.1.2-alpha 之前 | 使用相同的 `settings.register` 服务 API，理论兼容，建议实际验证 |
| `0.1.0-rc.7` 之前 / 0.0.x | 不支持，当时尚无插件所需的 settings/section 机制 |

> `v1.0.3` 起不再引用已移除的 `settingsNamespace` 和 `@deepseek-ai/dsh-client-runtime`，
> 改用当前 DSH 的 `settings.register(ns, schema)` 与 `ctx.settingsScope` 服务。

### 前置条件

- 已安装 [DSH](https://github.com/deepseek-ai/dsh)（推荐 `0.1.2-rc.1`，最低理论版本 `0.1.0-rc.7`）
- 可用的视觉模型 API 端点（如 OpenRouter、OpenAI-compatible 服务）

### 步骤

#### 1. 安装插件包

```bash
# 从 npm registry 安装（推荐）
dsh plugin add @lp181818/dsh-vision-plugin
```

#### 2. 启动/重启 DSH Web

```bash
pnpm dsh web
```

#### 3. 配置视觉模型

在打开的设置页中：

1. 进入 **设置 → 识图模型配置**
2. 填写 **Base URL**（如 `https://openrouter.ai/api/v1`）
3. 填写 **Model ID**（如 `qwen/qwen3.8-27b`）
4. **把密钥填到「API Key」字段**——不要把 key 填进「密钥来源（变量名）」字段（那是环境变量/凭证名，不是 key 本身）
5. 开启 **启用图片识别** 开关
6. 点击 **保存**

**火山方舟 ARK 示例**（Agent Plan / Coding Plan 实测可用）：

| 字段 | 值 |
|---|---|
| Base URL | `https://ark.cn-beijing.volces.com/api/plan/v3` |
| Model ID | `Doubao-Seed-Evolving` |
| API Key | `ark-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| 密钥来源（变量名） | 留空 |

> **注意**：使用 OpenRouter 等聚合 API 时，模型名需使用该平台的完整标识符（如 `openai/gpt-4o-vision`、`qwen/qwen3.8-27b`）。

#### 4. 验证

在对话中向 AI 发送一张图片，确认它能正常识别图片内容。

## 常见问题（FAQ）

### 报错 `401 The API key format is incorrect`（或 `AuthenticationError`）

**原因**：插件实际发给服务端的 key 不是当前填写的那一个。最常见的情况是——把 key 填进了 **「密钥来源（变量名）」** 字段，或之前保存过别的 key 但未更新。插件会按以下优先级取 key：

1. `apiKeyEnv`（密钥来源/变量名）——填的是**变量名或凭证名**（如 `OPENROUTER_API_KEY`、`A2W_API_KEY`），不是 key 本身；解析失败则跳过
2. 复用同 Base URL 路由已注册的模型 key（`baseUrl` 需与某个已配置模型的路由完全一致）
3. 字面量 `apiKey`（**API Key** 字段）

若 1、2 均未命中而 `apiKey` 又为空，请求就会带一个旧/空 key 过去，被服务端以 401 拒绝。

**修复**：把 key 直接粘贴进 **API Key** 字段，`密钥来源（变量名）` 留空；保存后**刷新设置页**确认已生效。若你直接改 `~/.dsh/settings.yaml`，`vision-plugin` 段形如：

```yaml
vision-plugin:
  apiKey: ark-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   # 或 sk-... / 其他格式
  baseUrl: https://ark.cn-beijing.volces.com/api/plan/v3
  modelId: Doubao-Seed-Evolving
  apiKeyEnv: ""
  enabled: true
```

DSH 的 settings-file 服务默认热加载（`watch: true`），保存文件后即时生效。

### 报错 `400 InvalidParameter: Image dimensions are too small`

ARK 等平台对图片有最小尺寸限制（如 ARK 要求最短边 ≥ 14px）。请发送正常尺寸的图片，不要用 1×1 之类占位图测试。

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build
```

### 构建产物

| 文件 | 说明 |
|---|---|
| `lib/index.js` | Node 端 — 向 DSH 注册 settings 命名空间 |
| `lib/client.js` | 浏览器端 bundle，被 DSH 插件加载器自动加载 |
| `lib/client.js.map` | Source map |

## 技术原理

1. 通过 **settings section 插槽**在设置页导航中注册「识图模型配置」页面
2. 使用 `SettingsScopeController` 绑定 `vision-plugin` 命名空间实现配置持久化（写入 `~/.dsh/settings.yaml`，重启不丢）
3. 插件设置命名空间：`vision-plugin`（enabled、baseUrl、modelId、fallbackModelId、maxRetries、timeoutMs、apiKey、apiKeyEnv）
4. 识图请求在服务端用 **OpenAI 兼容** `POST {baseUrl}/chat/completions` 完成，带指数退避重试与备用模型切换
5. 设置页的「测试连接」与保存前自动测试在**浏览器端**执行（无需主机 RPC，跨 DSH 版本可用）

## License

MIT
