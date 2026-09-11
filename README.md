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
- **密钥来源（变量名）** — 环境变量或凭证名；留空则使用下面的 API Key 字段，两者都留空才自动复用同路由已配置的密钥（优先级：密钥来源 > API Key > 复用路由）
- **API Key** — 实际 API 密钥（敏感信息，妥善保管）；填写后即用于识图请求，优先于路由复用

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
```

## v1.1.3 密钥优先级修复

**症状**：设置页里填好了 API Key、点「测试连接」也通过，但实际发图仍然失败，报 `401 Missing Authentication header`，而且错误信息里**没有**"未携带 API Key"那句提示。

**原因**：取 key 的优先级原先把「复用同 Base URL 路由的密钥」放在了字面量 `apiKey` **之前**。当 `settings.yaml` 里有多个 provider 共用同一个 Base URL（例如两个都写 `https://openrouter.ai/api/v1`）时，插件会取**注册顺序靠前那个路由**的密钥，把你在设置页里填的那把悄悄换掉。聚合平台对"格式不属于自己的 key"回的正是 `Missing Authentication header`（真正没带 header 时它回的是 `No cookie auth credentials found`，两者语义完全不同）。

**修复**（v1.1.3）——路由复用降级为兜底，不再覆盖显式配置：

| 优先级 | 来源 | 说明 |
|---|---|---|
| 1 | `apiKeyEnv` | 显式指定的环境变量 / 凭证名，解析成功即采用 |
| 2 | `apiKey` | 设置页 **API Key** 字段里实际填写的密钥；前后空白会被去掉，纯空白视为未填 |
| 3 | 路由复用 | 仅当前两者都没填时，才复用同 Base URL 路由已注册的凭证 |

配套改进：

- **不再无声无息**：走路由复用时，插件日志会写明用了哪个路由的密钥、以及原因是没配显式密钥
- **错误指向明确**：401/403 且密钥来自路由复用时，提示会点名该路由并指向 API Key 字段
- **提示不会被截断吞掉**：可操作的中文提示现在跟在被截断的错误正文之后
- **回归测试**：`npm test` 运行 `test/key-resolution.test.mjs`，覆盖上述全部优先级场景（含本 bug 的复现场景）

> 注意：设置页的「测试连接」在**浏览器里用当前填写的 key** 直接请求，而服务端运行时还会考虑 `apiKeyEnv` 与路由复用。v1.1.3 之后，只要 API Key 字段非空，两者就一致了；若你把 key 填进了「密钥来源（变量名）」字段（那是变量名，不是 key），浏览器测试无法复现服务端的解析结果。


## v1.1.4 保存静默失败修复

**症状**：在「设置 → 识图模型配置」里填好配置、点「测试连接」显示绿色通过，再点**保存**却像是没反应——**没有任何报错**，输入框自己弹回旧值，而且**保存按钮变灰点不动**了（"填完测试是绿的，然后就是保存不了"）。

**原因**：DSH 的客户端设置契约里，被宿主**拒绝**的写入**不会抛异常**。`SettingsScope.mutate()` 的实现是：

```js
const response = await this.ctx.remote.settings.mutate(ns, ops, revision)
if (!response.ok) { await this.recover(generation); return }   // 只重读宿主状态，不 throw
```

也就是"写入被拒 = 重新读一次宿主状态后正常返回"（契约原文：*a rejected or failed latest write reloads Host state instead*）。最常见的拒绝原因是**修订号（revision）过期**：宿主对设置了版本栅栏的命名空间会回 `settings/conflict`（`settings namespace "vision-plugin" changed since it was read (expected revision N, now M)`）。

而本插件的保存逻辑原先是这样写的：

```js
try {
  for (const draft of drafts) await scope.set(field, value)
  drafts.clear()            // ← 无论写入是否真的成功，都清空草稿
} catch (error) { failed = true }   // ← 永远不会进入：被拒不抛异常
```

于是被拒时三件事同时发生：**没有任何提示**（没抛异常）、**草稿被丢弃**（弹回旧值）、**保存按钮变灰**（没有 dirty 字段可存）。用户看到的就是"绿着，然后保存不了"。

**修复**（v1.1.4）——让写入结果**可判定**，而不是靠 try/catch 猜：

- **原子写入**：所有脏字段合成**一次** `mutate`（共享同一个版本栅栏），因此不存在"存了一半"的状态
- **写入后校验**：写完读回宿主已解析的 section，逐字段确认值真的落盘
- **自动重试一次**：被拒的那次写入自身已完成恢复性重读（刷新了版本栅栏），因此重试通常直接成功——这正是"页面 Revision 过期"场景的治愈方式
- **仍然失败就明说**：保留用户草稿（不清空、按钮不置灰），并在面板上给出可操作提示"保存失败：配置未写入（多为页面持有的配置版本已过期），请重试或刷新页面后再保存"
- **回归测试**：`test/commit-settings.test.mjs` 锁定上述行为，包括"被拒一次后重试成功"与"始终被拒时必须报错而非静默丢弃"两条

> 遇到这个报错的用户：**刷新一次设置页**（Ctrl+R）即可让页面拿到最新版本栅栏；v1.1.4 之后即便再次遇到并发写入，也会自动重试或明确报错，而不会再默默丢掉你的输入。


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

### 报错 `401 The API key format is incorrect`（或 `AuthenticationError`、`Missing Authentication header`）

**原因**：插件实际发给服务端的 key 不是当前填写的那一个。最常见的情况是——把 key 填进了 **「密钥来源（变量名）」** 字段，或**同 Base URL 的路由复用覆盖了 API Key 字段**（v1.1.2 及更早；见上文 v1.1.3）。插件按以下优先级取 key（v1.1.3 起）：

1. `apiKeyEnv`（密钥来源/变量名）——填的是**变量名或凭证名**（如 `OPENROUTER_API_KEY`、`A2W_API_KEY`），不是 key 本身；解析失败则跳过
2. 字面量 `apiKey`（**API Key** 字段）——显式填写即采用
3. 复用同 Base URL 路由已注册的模型 key（`baseUrl` 需与某个已配置模型的路由完全一致）

若 1、2 均未命中而 `apiKey` 又为空，请求就会带一个旧/空 key 过去，被服务端以 401 拒绝。

> 区分两种 401 文案：`No cookie auth credentials found` = 请求**根本没带** `Authorization` 头；`Missing Authentication header` = 带了头但**不是可用的 Bearer token**（空值、多余空格，或平台不认这把 key 的格式）。后者最常见的成因就是密钥被路由复用换成了别的平台的 key。

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

# 构建（node + client 两半产物）
pnpm build

# 回归测试：API Key 来源优先级 + 保存写入结果判定
# （test/key-resolution.test.mjs、test/commit-settings.test.mjs）
npm test

# 把构建产物同步进本机所有已安装的 DSH profile
# 仅改客户端（设置页）时刷新页面即可；改主机端需重启 DSH
pnpm sync
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
