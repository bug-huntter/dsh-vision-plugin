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
- **API Key** — 实际 API 密钥（敏感信息，妥善保管）。**这是唯一的密钥来源**：留空时不会去复用其它路由的密钥，而是明确提示「未携带 API Key」（v1.2.0 起）
- **密钥格式** — 密钥的鉴权方式，必须与密钥所属服务商匹配：`openai`（`Authorization: Bearer`，适用于 OpenAI / OpenRouter / ARK / DeepSeek 及多数兼容网关）、`anthropic`（`x-api-key` + `anthropic-version`）、`gemini`（`x-goog-api-key`）、`azure`（`api-key`）

> **保存前自动测试**：点击保存时，插件会用**当前填写的内容**在浏览器里向视觉模型发一张内嵌测试图，验证连通性与图片输入支持。只有配置类错误（地址/模型错误、密钥无效、模型不支持图片）才阻止保存；429/5xx 等临时限流仍可保存，不会把你锁在设置页外。

> **v1.2.0 起「密钥来源（变量名）」已移除**：那一栏实际填的是环境变量/凭证名，却容易被当成"密钥本身"，且它优先级高于 API Key，会出现「页面上明明填了 key，发图仍 401」。现在密钥只来自 API Key 字段；旧的 `apiKeyEnv` 配置会被忽略（不再生效）。

## 支持的服务

插件内部只做一次标准的 **OpenAI 兼容** `POST {baseUrl}/chat/completions` 请求；密钥通过「密钥格式」选择的方式携带（默认 `Authorization: Bearer <key>`），因此**不限于 OpenRouter**。任何提供 OpenAI 兼容 `/chat/completions` 接口的服务都可用：

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
  apiKey: sk-or-v1-...                   # v1.2.0 起密钥只来自此字段
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
>
> **v1.2.0 起该优先级表与这条注意已作废**：`apiKeyEnv` 字段与「复用同 Base URL 路由的密钥」都已移除，密钥只来自 API Key 字段——见下方 v1.2.0 一节。


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


## v1.2.0 密钥来源收敛 + 密钥格式

这一版按「密钥只有一个来源」重做了设置项，去掉了一个会静默换 key 的间接层，并把"没带 key"变成一句能照着做的提示。

**改动**

| 项目 | v1.1.4 及更早 | v1.2.0 |
|---|---|---|
| 密钥来源 | `apiKeyEnv`（环境变量/凭证名）> `apiKey` > 复用同 Base URL 路由的密钥 | **只有 `apiKey`**（设置页 API Key 字段） |
| 「密钥来源（变量名）」栏 | 有 | **已移除**（旧的 `apiKeyEnv` 值被忽略） |
| 路由复用 | 兜底生效，会静默换成别的路由的密钥 | **彻底移除**，绝不再替换你填的 key |
| 密钥格式 | 无（固定 `Authorization: Bearer`） | **新增**：`openai` / `anthropic` / `gemini` / `azure` |
| 未填 key 时 | 可能复用路由密钥，或收到上游那句看不懂的 401 | **发请求前就报「未携带 API Key」，并指明去哪个字段填** |
| 401/403 提示 | 只提示"密钥来自路由复用" | 点名「已按 `<格式>` 携带密钥但被拒绝」，指向格式是否匹配 |
| 保存前测试 | key 为空按"无法验证"放行保存 | key 为空直接阻止保存，并给出「未携带 API Key」 |

**密钥格式一览**（端点始终是 `{baseUrl}/chat/completions`，只换鉴权头）

| 格式 | 请求头 | 适用 |
|---|---|---|
| `openai`（默认） | `Authorization: Bearer <key>` | OpenAI、OpenRouter、火山方舟 ARK、DeepSeek 及多数兼容网关 |
| `anthropic` | `x-api-key: <key>` + `anthropic-version: 2023-06-01` | Anthropic 风鉴权的网关 / 代理 |
| `gemini` | `x-goog-api-key: <key>` | Google 风鉴权的网关 / 代理 |
| `azure` | `api-key: <key>` | Azure OpenAI 风鉴权的网关 / 代理 |

> 说明：本版只切换**鉴权请求头**，不切换端点与报文（选 `anthropic` 不会改走 `/v1/messages`，选 `gemini` 不会改走 `generateContent`）。要直连官方 Anthropic / Gemini 原生协议，仍需一个把它们转成 OpenAI 兼容格式的网关。

**「未携带 API Key」提示长这样**

```
[图片转写失败：未携带 API Key：请在 设置 → 识图模型配置 的「API Key」字段填写密钥
（当前密钥格式：openai，如与密钥不匹配请在同页切换）——该图片未传递给模型]
```

主机端在**发出请求之前**就判定并写日志，浏览器端「测试连接」用的是同一条提示，因此不会再出现"图没送到模型，却只给一句看不懂的 401"。

**迁移**：升级后打开设置页，确认 **API Key** 已填、**密钥格式**与服务商匹配即可。旧行为等价于新版 `密钥格式 = openai`，OpenRouter / ARK / OpenAI 用户无需改动；`settings.yaml` 里遗留的 `apiKeyEnv` 会被忽略（可直接从配置文件中删掉）。

**回归测试**：`test/key-resolution.test.mjs`（唯一来源）、`test/auth-headers.test.mjs`（四种格式的请求头、空 key 不发鉴权头、格式归一化）、`test/commit-settings.test.mjs`（保存写入结果判定）。


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
4. **把密钥填到「API Key」字段**——这是唯一的密钥来源；留空会在发图时提示「未携带 API Key」
5. 选择 **密钥格式**（OpenRouter / OpenAI / ARK / DeepSeek 等选 `openai`；密钥由 Anthropic 风网关签发时选 `anthropic`，其余按服务商选择）
6. 开启 **启用图片识别** 开关
7. 点击 **保存**

**火山方舟 ARK 示例**（Agent Plan / Coding Plan 实测可用）：

| 字段 | 值 |
|---|---|
| Base URL | `https://ark.cn-beijing.volces.com/api/plan/v3` |
| Model ID | `Doubao-Seed-Evolving` |
| API Key | `ark-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| 密钥格式 | `openai` |

> **注意**：使用 OpenRouter 等聚合 API 时，模型名需使用该平台的完整标识符（如 `openai/gpt-4o-vision`、`qwen/qwen3.8-27b`）。

#### 4. 验证

在对话中向 AI 发送一张图片，确认它能正常识别图片内容。

## 常见问题（FAQ）

### 报错 `401 The API key format is incorrect`（或 `AuthenticationError`、`Missing Authentication header`）

**原因**：插件实际发给服务端的 key 不是当前填写的那一个，或者**发送方式与密钥不匹配**。

*历史成因（v1.1.2 及更早，已修复）*：同 Base URL 的路由复用覆盖了 API Key 字段——`settings.yaml` 里两个 provider 都写 `https://openrouter.ai/api/v1` 时，插件会取**注册顺序靠前那个路由**的密钥（见上文 v1.1.3）。

*现在的成因*（v1.2.0 起，密钥只来自 API Key 字段）：

1. **API Key 字段为空** → 现在会在发请求前直接提示「未携带 API Key」，不会走到上游 401
2. **密钥格式选错** → 例如把 Anthropic 风鉴权的 key 按 `openai`（`Authorization: Bearer`）发送；请在同页「密钥格式」中改选对应项
3. **key 本身无效/过期/欠费**，或粘贴时带入了引号
4. 历史遗留：`settings.yaml` 里还留着 `apiKeyEnv`（v1.2.0 起**已被忽略**，不再是原因）

> 区分两种 401 文案：`No cookie auth credentials found` = 请求**根本没带**鉴权头（现在意味着字段为空，会先被插件拦下）；`Missing Authentication header` = 带了头但**不是可用的凭据**（空值、多余空格，或平台不认这把 key 的格式/来源）。

**修复**：把 key 直接粘贴进 **API Key** 字段，并在「密钥格式」中选择与密钥匹配的项；保存后**刷新设置页**确认已生效。若你直接改 `~/.dsh/settings.yaml`，`vision-plugin` 段形如：

```yaml
vision-plugin:
  apiKey: ark-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx   # 或 sk-or-v1-... / 其他格式
  keyFormat: openai                                 # openai | anthropic | gemini | azure
  baseUrl: https://ark.cn-beijing.volces.com/api/plan/v3
  modelId: Doubao-Seed-Evolving
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

# 回归测试：密钥来源唯一性 + 密钥格式请求头 + 保存写入结果判定
# （test/key-resolution.test.mjs、test/auth-headers.test.mjs、test/commit-settings.test.mjs）
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
3. 插件设置命名空间：`vision-plugin`（enabled、baseUrl、modelId、fallbackModelId、maxRetries、timeoutMs、apiKey、keyFormat）
4. 识图请求在服务端用 **OpenAI 兼容** `POST {baseUrl}/chat/completions` 完成（`src/authHeaders.ts` 按 `keyFormat` 组装鉴权头，两半共用同一函数），带指数退避重试与备用模型切换
5. 设置页的「测试连接」与保存前自动测试在**浏览器端**执行（无需主机 RPC，跨 DSH 版本可用）
6. 保存走一次原子 `mutate`，并**读回宿主已解析的 section 校验是否真的落盘**（被拒的写入在 DSH 契约里不抛异常，只能这样判定），失败则保留草稿并报错（`src/client/commitSettings.ts`）

## License

MIT
