# LX Music Web API

基于 Vue 3 + Express 的在线音乐搜索、下载和播放 Web 应用，兼容 lx-music-desktop 插件系统。

## 功能特性

- 多音源搜索：支持腾讯音乐（TX）和网易云音乐（WY）
- 音乐搜索：支持分页搜索，聚合模式可一次搜索多音源
- 音乐下载：将歌曲下载到本地，支持 128k / 320k 音质
- 在线播放：下载后可直接在线播放
- 歌词显示：支持 LRC 格式歌词，带滚动高亮
- 收藏管理：收藏喜欢的歌曲，持久化到本地 JSON 数据库
- 插件系统：实现 lx-music-desktop 插件接口，通过远程 API 获取音源

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite |
| 后端 | Express.js |
| 数据持久化 | JSON 文件数据库 |
| 音源 API | lxmusicapi.onrender.com |
| 请求库 | Axios |

## 项目结构

```
├── src/
│   ├── client/             # Vue 前端应用
│   │   └── App.vue         # 主组件（搜索/收藏/播放器/歌词）
│   ├── routes/
│   │   └── musicRoutes.js  # Express API 路由
│   ├── services/
│   │   ├── musicService.js     # 音乐搜索服务（路由到各音源）
│   │   ├── downloadService.js  # 音乐下载服务
│   │   ├── lyricService.js     # 歌词服务
│   │   ├── databaseService.js  # JSON 数据库（收藏歌曲管理）
│   │   └── pluginSystem.js     # lx-music 插件系统
│   ├── sources/
│   │   ├── tx/             # 腾讯音乐音源
│   │   │   ├── musicSearch.js  # 搜索
│   │   │   ├── lyric.js        # 歌词
│   │   │   └── request.js      # HTTP 请求
│   │   └── wy/             # 网易云音乐音源
│   │       ├── musicSearch.js  # 搜索（eapi 加密请求）
│   │       ├── lyric.js        # 歌词
│   │       ├── request.js      # HTTPS 请求
│   │       └── crypto.js       # eapi 加密/解密
│   ├── core/useApp/
│   │   ├── useMusicService.js  # 音乐服务初始化
│   │   ├── useOpenAPI.js       # OpenAPI 路由注册
│   │   ├── useConfig.js        # 配置管理
│   │   ├── useProxy.js         # 代理配置
│   │   └── useEventListeners.js # 事件监听器
│   ├── services/
│   │   ├── httpFetcher.js      # HTTP 请求封装
│   │   └── pluginSystem.js     # 插件系统（已在上方列出）
│   ├── utils/
│   │   ├── shared.js           # 通用工具（格式化时长/大小）
│   │   └── lyricParser.js      # LRC 歌词解析
│   ├── constants/
│   │   └── events.js           # 事件名称常量
│   └── server.js               # Express 服务入口
├── downloads/                  # 下载目录
│   ├── songs_db.json           # 收藏数据库
│   └── tx/ | wy/               # 按音源分类的歌曲文件
├── vite.config.js              # Vite 配置
├── package.json
└── src/client/index.html        # 前端入口 HTML
```

## API 接口

### 音乐搜索

```
GET /api/music/search?q=关键词&page=1&limit=30&source=tx|wy|all
```

- `q`: 搜索关键词
- `source`: 音源（`tx` 腾讯 / `wy` 网易云 / `all` 聚合）
- 返回 `{ list, total, allPage, limit, source }`

### 获取音乐 URL

```
GET /api/music/url?songId=xxx&source=tx|wy&quality=320k
```

### 下载音乐

```
GET /api/music/download?songId=xxx&source=tx|wy&name=歌名&singer=歌手
```

将歌曲下载到 `downloads/{source}/` 目录，返回文件路径。

### 收藏歌曲

```
POST /api/music/love
{ "song": { songId, name, singer, source, ... }, "source": "tx|wy" }
```

下载歌曲和歌词，并保存到数据库。

### 获取收藏列表

```
GET /api/music/loved
```

### 歌词

```
GET /api/music/lyric?songId=xxx&source=tx|wy&name=歌名&singer=歌手
```

### 设置

```
GET  /api/settings
POST /api/settings  { "key": "value", ... }
GET  /api/config
```

### 搜索（OpenAPI）

```
POST /api/search
{ "query": "关键词", "page": 1, "limit": 30, "source": "tx|wy" }
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
# 同时启动后端 API (端口 3000) 和前端 Vite (端口 5173)
npm run dev

# 或分别启动
npm run dev:api   # 后端 API
npm run dev:vue   # 前端 Vite 开发服务器
```

- 后端 API 运行在 `http://localhost:3000`
- 前端开发服务器运行在 `http://localhost:5173`（代理 `/api` 请求到 3000 端口）

### 构建生产版本

```bash
# 构建前端
npm run build

# 之后启动 API 服务即可访问（静态文件从 dist/ 目录提供）
npm run dev:api
```

## 运行环境

- Node.js 18+
- npm

## 配置

通过 `/api/settings` 接口管理应用配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `network.proxy.enable` | `false` | 是否启用代理 |
| `network.proxy.host` | `''` | 代理主机地址 |
| `network.proxy.port` | `''` | 代理端口 |
| `common.apiSource` | `'tx'` | 默认音源 |
| `theme.id` | `'default'` | 主题 ID |
| `common.fontSize` | `14` | 字体大小 |

也可通过环境变量 `PORT` 设置后端端口，默认 3000。
设置 HTTP 代理环境变量 `HTTP_PROXY` / `https_proxy` 可启用代理。

## 数据持久化

- 收藏数据：`downloads/songs_db.json`
- 下载歌曲：`downloads/tx/` 和 `downloads/wy/`
- 歌词文件：`downloads/tx/` 和 `downloads/wy/`

## 音源说明

### 腾讯音乐（TX）

- 直接调用 QQ 音乐 API
- 支持音质：128k, 320k

### 网易云音乐（WY）

- 通过网易云 eapi 加密请求
- 支持音质：128k, 320k
- 音乐 URL 通过 lxmusicapi.onrender.com 代理获取

## 测试

```bash
npm test
```

## 架构说明

```
┌─────────────────────────────────────────────┐
│                  Vue 前端                     │
│  (搜索 / 收藏 / 播放器 / 歌词)               │
└──────────────────┬──────────────────────────┘
                   │ HTTP
                   ▼
┌─────────────────────────────────────────────┐
│              Express API 服务                 │
│  /api/music/*    音乐相关接口                  │
│  /api/settings   配置管理                     │
│  /api/search     搜索（OpenAPI）              │
│  /api/lyrics     歌词                         │
└──────┬──────────────────────────────────────┘
       │
       ├──► musicService.js  ──► sources/tx/  (腾讯)
       │                         sources/wy/  (网易云)
       │
       ├──► downloadService.js ──► 下载歌曲文件
       │
       ├──► lyricService.js  ──► 获取歌词
       │
       ├──► pluginSystem.js  ──► lx-music 插件系统
       │                          ──► 调用 lxmusicapi.onrender.com
       │
       └──► databaseService.js ──► JSON 数据库