# 摸鱼浮画 · 油猴脚本版

`moyu-float.user.js` —— 把 [摸鱼浮画](../index.html) 的 2D 伪 3D 光影引擎装进油猴脚本，
在**任意网页**上悬停图片即可一键进入编辑。

## 功能（与 HTML 版一致）

- 深度视差 + 法线光照（WebGL 单 pass 渲染）
- 深度来源：亮度生成 / 上传深度图 / 深度画笔 / AI 生成深度（Depth Anything V2，小）
- 最多 8 盏实时灯光、逐灯 gizmo、6 个预设、6 种视图（含纯光照 / 对比分屏）
- 环境光颜色、曝光、边缘光、卡通阴影、灯光环绕
- PNG 导出

## 操作逻辑（相对 HTML 版重构）

1. 安装后任意网页右上角出现圆形悬浮按钮，点开展开面板
2. 面板内**开启开关默认关闭**；打开后显示初始化进度条（引擎预热 → 扫描图片）
3. 就绪后脚本探测页面所有 `<img>`；鼠标悬停到图片上时，图片右上角出现光影小图标
4. 点击图标 → 抓取图片（经 `GM_xmlhttpRequest`，不受 CORS 限制）→ 打开编辑器面板

## 前端

UI 采用 [reactbits.dev](https://reactbits.dev/) 组件（源码复制进 `src/components/bits/`）：

| 组件 | 用途 |
|---|---|
| SquishSwitch | 总开启开关 |
| ElectricBorder | 可展开面板边框 |
| ShinyText | 标题 |
| SpotlightCard | 编辑器功能区块 |
| GlassIcons | 图标按钮 |
| Dock | 视角 / 灯光 / 绘制模式切换 |
| StarBorder | AI 生成深度按钮 |
| ClickSpark | 点击火花 |
| GlareHover | 悬停徽标光泽 |

所有界面渲染在 **shadow DOM** 内，与宿主页面样式完全隔离。

## 开发

```bash
cd mokey
npm install
npm run build        # 输出 dist/moyu-float.user.js（油猴脚本头 + IIFE bundle 内联）
```

- `src/engine/moyuEngine.js` —— 框架无关的 WebGL 引擎（由 HTML 版移植）
- `src/components/shell/` —— 右上面板、开关、进度条、图片探测
- `src/components/editor/` —— 编辑器（舞台 + 深度/灯光/氛围/视图四个 Tab）
- `src/utils/imageFetch.js` —— 跨域图片抓取

## 安装

1. 浏览器安装 Tampermonkey / Violentmonkey
2. 打开 `dist/moyu-float.user.js` 全选复制，或直接拖进油猴面板安装
3. 首次在某域名抓图时，油猴会弹窗询问跨域权限，选「始终允许所有域名」

## 说明

- 脚本默认 `@match *://*/*`、`@noframes`，开关默认关闭，不打扰正常浏览
- AI 深度模型首次使用时从 Hugging Face 下载（约 94MB），缓存于浏览器 Cache Storage
- 小于 80px 的图片会被忽略（图标、像素埋点等）
