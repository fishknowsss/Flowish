# Flowish

Flowish 是一个纯前端的个人计划面板，用来整理今日重点、积压事项、固定节律、日历信号和重要日期。项目使用 React、TypeScript 与 Vite，不需要后端或账号系统。

视觉沿用 Solid Glass 的边缘高光与实体表面，提供暖灰绿浅色和深色主题，无渐变。保留今日工作区、时间板和收纳区的位置，布局按内容与屏幕尺寸适配。当前修复及验收见 [docs/ui-review-2026-10-22.md](docs/ui-review-2026-10-22.md)，来源及许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 功能

- 管理今日重点和积压事项，支持完成、编辑、删除与排序；可拖动，也可点击排序手柄或用方向键调整。
- 记录固定节律及连续完成天数。
- 查看月历、节假日、节气、农历节日和重要日期。
- 搜索任务、节律和重要日期。
- 提供番茄钟、主题、动效与短句设置。
- 导入、导出本地 JSON 数据。
- 生产环境注册 Service Worker，可安装为 PWA。

## 数据与隐私

Flowish 没有内置云同步。任务、短记、节律记录、重要日期和偏好设置都保存在当前站点来源的 `localStorage` 中，主数据键为 `flowish_app`。检测到损坏或过新版本的数据时，应用会先把原始内容保存在 `flowish_app_recovery`，再回退到可启动状态。

导入通过校验的备份前，应用会把当前数据保存在 `flowish_app_import_backup`。这个副本仍属于浏览器站点数据，不能替代手动导出的 JSON 文件。

- 浏览器清除该站点数据后，本地记录会一并删除。清理前请先导出 JSON 备份。
- 顶栏的导出和导入按钮用于手动迁移或恢复数据。导出文件可能包含私人内容，请自行妥善保管。
- `localStorage` 按来源隔离，不按 URL 路径隔离。在 GitHub Pages 上，`https://fishknowsss.github.io/Flowish/` 与同一 `fishknowsss.github.io` 来源下的其他项目共享访问边界。不要在 Flowish 中保存密码、令牌等秘密；如需与其他项目严格隔离，应部署到独立域名或子域名。
- 当前应用不包含账号、分析脚本或主动上传数据的功能。以后若增加网络服务，应同步更新本节和安全策略。

## PWA 与离线使用

生产构建通过 `vite-plugin-pwa` 生成 Service Worker，并预缓存生产静态资源。首次使用及版本更新时需要联网；离线可用程度取决于浏览器已经缓存的版本。PWA 缓存不是数据备份，重要数据仍应定期导出。

不同浏览器对安装入口和后台缓存的支持有所不同。开发服务器不会注册 Service Worker，需使用生产构建验证安装、离线和更新行为。

## 本地开发

环境要求：Node.js 24 和 npm 11。版本约束同时记录在 `.nvmrc` 与 `package.json` 中。

```bash
npm ci
npm run dev
```

也可以运行 `npm run open:local`，或在 macOS、Windows 上分别打开 `open-local-site.command`、`open-local-site.cmd`。脚本会从 4173 开始寻找可用端口并打开浏览器。

提交前运行完整检查：

```bash
npm run check
```

该命令依次执行 ESLint、带覆盖率门槛的单元测试、TypeScript 项目构建检查和 Vite 生产构建。预览生产产物：

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

## 目录

```text
src/components/   页面组件
src/lib/          日期、节假日、存储等逻辑
src/store/        数据结构与默认数据
src/styles/       设计变量与全局样式
public/           图标等静态资源
.github/          CI、Pages 发布和协作模板
```

## 发布到 GitHub Pages

1. 在仓库 `Settings -> Pages` 中把来源设为 `GitHub Actions`。
2. 推送到 `main`。
3. Pages 工作流会执行 `npm ci` 与 `npm run check`，检查通过后上传并部署 `dist`。

Vite 会在 GitHub Actions 中根据仓库名设置基础路径。当前项目地址为：

<https://fishknowsss.github.io/Flowish/>

Pull Request 和普通 push 会由独立 CI 工作流执行同一套检查。依赖更新由 Dependabot 每周检查一次。

## 参与开发与安全问题

提交改动前请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。安全问题请按 [SECURITY.md](./SECURITY.md) 私下报告，不要在公开 Issue 中披露漏洞细节或私人数据。

本仓库暂未添加 `LICENSE`，许可证由维护者后续决定。
