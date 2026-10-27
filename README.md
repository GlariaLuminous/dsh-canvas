# dsh Canvas

把 DeepSeek Harness 对话里的成果，变成可以整理、批注、比较和继续修改的画布。

**这是实际运行在 DSH 里的插件。** 不另起聊天服务，不配置第二份模型密钥；直接使用当前会话的模型、消息队列和权限设置。

## 安装

当前验证环境：**DeepSeek Harness 0.2.1-rc.2，Web 界面，Node.js 22.18+**。DSH 的扩展接口仍在变化，其他版本与桌面内嵌界面尚未验证。

下载构建好的 `dsh-canvas-workbench-0.1.0.tgz`，在终端执行（路径替换为实际位置）：

```powershell
dsh plugin --profile web add "C:/path/to/dsh-canvas-workbench-0.1.0.tgz" --ignore-scripts
dsh web
```

如果 DSH 已在运行，安装后重新启动。打开一个已有会话，或先在新会话发一条消息，然后点击会话顶部的 **Canvas** 标签。

源码本地安装：

```powershell
npm ci --ignore-scripts
npm run check
npm pack --ignore-scripts
dsh plugin --profile web add "link:C:/absolute/path/to/dsh-canvas" --ignore-scripts
```

`npm run build` 会显式运行 esbuild。生产安装包已包含 `lib/`，安装插件不需要运行构建脚本。项目目前未发布到 npm。

## 完成一次迭代

1. 导入 `.md`、`.txt`、`.html` 或 PNG/JPEG/WebP/GIF；也可以点击「新建」粘贴 Markdown 或 HTML。
2. 打开成果，点击「选择区域批注」，在页面上点击元素，填写并保存修改意见。批注绑定到当时的版本。
3. 点击「让 DSH 按批注修改」。也可以在画布勾选最多 8 个成果，在右侧输入具体要求并发送。
4. DSH 用原生 `canvas_get` 和 `canvas_publish` 工具读写成果。新版本完成后，画布会自动更新。
5. 点击「比较版本」查看双栏预览或文本差异；采用任意历史版本都保留已有历史。

不导入文件也可以在普通 DSH 对话中要求：

> 请用 canvas_publish 创建一个 Markdown 成果，标题「发布清单」，包含准备、验证和发布三个部分。

其他交互：拖动卡片标题移动、拖动空白区域框选、勾选多项、平移、缩放、适应画布、搜索标题、整理布局、编辑源码生成新版本、导出原始文件。聚焦画布后，方向键移动选中成果，Shift + 方向键加大步长，Ctrl/Cmd + A 全选；右侧输入框支持 Ctrl/Cmd + Enter 发送。

## 数据与预览边界

- 成果按 DSH 会话独立保存到 `<DSH_HOME>/storages/canvas-workbench/boards/`。默认 DSH_HOME 为 `~/.dsh`；文件名为会话 ID 的 SHA-256。备份此目录可保留画布数据，存储内容未加密。
- 修改前校验画布 revision 和成果 base version。过期修改会报冲突，避免静默覆盖；历史内容不可变，恢复只切换当前版本。
- **HTML 是静态预览**：保留样式，清洗内容，再放入无同源权限的 iframe；禁用用户脚本、外部网络资源、表单、弹窗和下载。它用于审阅页面成果，不承载任意 React 应用的运行环境。外部图片、字体和 CDN 样式不会加载。
- 文本单版本最多 1 MiB，图片最多 5 MiB；单画布最多 100 个成果、500 条批注、25 MiB，每个成果最多 100 个版本。当前界面没有成果删除或跨会话移动功能，接近上限时请导出并使用新会话。
- 每 2 秒读取一次当前可见画布的 revision。模型处理有实际延迟；未配置模型、权限被拒或连接失败时会显示错误，不生成假结果。
- 发送时传递所选成果的 ID、当前版本及批注。文本/HTML 由工具读取；图片作为 DSH 原生消息附件发送，能否理解图片取决于当前模型。
- 面向本机、单个 DSH host。不要让多个进程同时写同一个 DSH_HOME；目前不提供跨进程锁或多人协同。
- Canvas API 使用 DSH Connection 的原生身份验证与 owner 限制；持有该 DSH 实例完整权限的用户可以访问该实例的画布。

## 开发与验证

```powershell
npm ci --ignore-scripts
npm run check
npm audit
```

`check` 包含 TypeScript、存储/冲突/选中上下文/差异算法测试，以及 host 和浏览器插件构建。

真实 DSH HTTP 集成测试需另起一个**隔离的测试实例**，不要使用日常数据目录：

```powershell
$env:DSH_HOME = "C:/temp/dsh-canvas-test-home"
dsh plugin --profile web add "link:C:/absolute/path/to/dsh-canvas" --ignore-scripts
dsh web --no-open --port 3391 > C:/temp/dsh-canvas-startup.log
# 在另一个终端运行：
npm run test:integration -- C:/temp/dsh-canvas-startup.log
```

测试脚本从启动日志读取本机认证 URL，使用原生认证建立测试会话，只创建并移除自己的临时成果，不打印令牌。启动日志本身包含认证信息，请保密。

真实模型、导入、批注、预览隔离及版本恢复的人工验证记录见 [VALIDATION.md](./VALIDATION.md)。

## 模块

`src/host` 注册 DSH 工具和已鉴权 API，负责校验、原子保存及冲突控制；`src/client` 提供 `conversation.view` 会话视图、画布及沙箱预览；`src/shared` 定义存储模型与行差异算法。React 和 DSH 服务由宿主提供，不打包第二份运行时。

对接依据：[官方仓库](https://github.com/deepseek-ai/deepseek-harness)、[插件开发](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cordis-tutorial/01-first-plugin.md)、[Web 样式约定](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/web-styling.md)。安装包以 npm 的 `0.2.1-rc.2` 真实运行验证为准。

MIT License.
