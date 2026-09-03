# @dsh/vision-plugin

DSH 图片识别插件 — 为 AI 会话添加图片识别能力。

## 功能

- **设置 → 插件 → 图片识别功能**：查看识别功能开关状态
- **设置 → 识图模型配置**：配置视觉模型的 base_url、model_id、api_key
- 插件设置命名空间：`vision-plugin`（enabled、baseUrl、modelId、apiKey）

## 安装

```bash
# 通过 npm registry 安装
dsh plugin add @dsh/vision-plugin

# 或从本地路径安装
dsh plugin add file:./path/to/@dsh/vision-plugin

# 或从 git 仓库安装
dsh plugin add github:your-org/dsh-vision-plugin
```

## 开发

```bash
# 安装依赖
pnpm install

# 构建（需要 tsdown 打包工具）
pnpm build
```

## 构建产物

- `lib/index.js` — Node 端（Host-side）注册 settings 命名空间
- `lib/client.js` — 浏览器端 bundle，被 DSH 插件加载器自动加载
- `lib/client.js.map` — Source map

## 技术原理

1. 通过 **settings section** 插槽注册"识图模型配置"导航页面
2. 通过 **plugins tab** 插槽注册"图片识别功能"选项卡卡片
3. 使用 `SettingsScopeController` 绑定 `vision-plugin` 命名空间实现配置持久化
4. 从 `connection.api.host.describe()` 读取版本信息的 API 同理可扩展