# @dsh/vision-plugin

DSH 图片识别插件 — 为 AI 会话添加图片理解能力。

在设置的 **插件** 页面查看识别功能开关，在 **识图模型配置** 页面配置视觉模型的 Base URL、Model ID 和 API Key。

## 效果展示

### ① 插件配置页（设置 → 识图模型配置）

<img src="./img/vision-plugin2.png" alt="识图模型配置面板" width="700" />

在设置面板左侧导航的「识图模型配置」中，您可以配置：
- **启用图片识别** — 主开关，开启后 AI 可以识别并理解用户上传的图片内容
- **Base URL** — 视觉模型 API 的基础地址
- **Model ID** — 用于视觉任务的模型标识符
- **密钥来源（变量名）** — 环境变量或凭证名，留空自动复用同路由已配置的密钥
- **API Key** — 实际 API 密钥（敏感信息，妥善保管）

### ② 插件列表页（设置 → 插件）

<img src="./img/vision-plugin1.png" alt="插件列表中的图片识别功能卡片" width="700" />

在「设置 → 插件」面板中，您可以看到「图片识别功能」卡片，展示插件的启停状态与基本信息。

## 安装

### 前置条件

- 已安装 [DSH](https://github.com/deepseek-ai/dsh)（版本 ≥ rc.7）
- 可用的视觉模型 API 端点（如 OpenRouter、OpenAI-compatible 服务）

### 步骤

#### 1. 安装插件包

```bash
# 选项 A：从 npm registry 安装（推荐）
dsh plugin add @dsh/vision-plugin

# 选项 B：从本地路径安装
cd /path/to/vision-plugin
npm pack   # 生成 .tgz 包
dsh plugin add file:./deepseek-vision-plugin-0.1.0.tgz

# 选项 C：从 Git 仓库安装
dsh plugin add github:your-org/dsh-vision-plugin
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
4. 填写 **API Key** 或设置密钥来源变量名
5. 开启 **启用图片识别** 开关
6. 点击 **保存**

> **注意**：使用 OpenRouter 等聚合 API 时，模型名需使用该平台的完整标识符（如 `openai/gpt-4o-vision`、`qwen/qwen3.8-27b`）。

#### 4. 验证

在对话中向 AI 发送一张图片，确认它能正常识别图片内容。

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
2. 通过 **plugins tab 插槽**在插件列表注册「图片识别功能」卡片
3. 使用 `SettingsScopeController` 绑定 `vision-plugin` 命名空间实现配置持久化
4. 插件设置命名空间：`vision-plugin`（enabled、baseUrl、modelId、apiKey）

## License

MIT