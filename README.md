# LX Music Web API

基于 Vue 3 + Express 的在线音乐搜索、下载和播放 Web 应用，兼容 lx-music-desktop 插件系统。

## 功能特性

- 多音源搜索：支持腾讯音乐（TX）、网易云音乐（WY）和酷我音乐（KW）
- 音乐搜索：支持分页搜索，聚合模式可一次搜索多音源
- 音乐下载：将歌曲下载到本地，支持 128k / 320k 音质
- 在线播放：下载后可直接在线播放
- 歌词显示：支持 LRC 格式歌词，带滚动高亮
- 收藏管理：收藏喜欢的歌曲，持久化到本地 JSON 数据库
- 插件系统：兼容 lx-music-desktop 插件脚本，可同时加载 `plugins/` 目录下的多个音源插件，按配置指定首选插件并支持失败自动回退

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + Vite |
| 后端 | Express.js |
| 数据持久化 | JSON 文件数据库 |
| 音源 | `plugins/` 目录下的 lx-music 插件脚本（vm 沙箱执行） |
| 请求库 | Axios |

## 项目结构

```
├── src/
│   ├── client/             # Vue 前端应用
│   │   └── App.vue         # 主组件（搜索/收藏/播放器/歌词）
│   ├── routes/
│   │   ├── musicRoutes.js  # 音乐相关 API 路由
│   │   └── pluginRoutes.js # 插件管理 API 路由
│   ├── plugins/            # 插件系统
│   │   ├── manager.js      # 插件管理器：加载/路由/回退/配置持久化
│   │   ├── loader.js       # 头部注解解析 + vm 沙箱执行
│   │   ├── pluginRuntime.js# 单插件运行时（lx 对象、事件表、invoke）
│   │   ├── lxUtils.js      # 提供给插件的 utils.crypto / utils.buffer / utils.zlib
│   │   ├── httpClient.js   # 提供给插件的 request（代理、超时、JSON 解析）
│   │   └── config.js       # plugins/config.json 读写与环境变量覆盖
│   ├── services/
│   │   ├── musicService.js     # 音乐搜索服务（路由到各音源）
│   │   ├── downloadService.js  # 音乐下载服务
│   │   ├── lyricService.js     # 歌词服务
│   │   ├── databaseService.js  # JSON 数据库（收藏歌曲管理）
│   │   └── httpFetcher.js      # HTTP 请求封装
│   ├── sources/
│   │   ├── tx/             # 腾讯音乐音源
│   │   │   ├── musicSearch.js  # 搜索
│   │   │   ├── lyric.js        # 歌词
│   │   │   └── request.js      # HTTP 请求
│   │   ├── wy/             # 网易云音乐音源
│   │   │   ├── musicSearch.js  # 搜索（eapi 加密请求）
│   │   │   ├── lyric.js        # 歌词
│   │   │   ├── request.js      # HTTPS 请求
│   │   │   └── crypto.js       # eapi 加密/解密
│   │   └── kw/             # 酷我音乐音源
│   │       ├── musicSearch.js  # 搜索
│   │       ├── lyric.js        # 歌词（zlib 解压 + XOR 解密 + gb18030 解码）
│   │       ├── request.js      # HTTP 请求（保留原始二进制响应）
│   │       └── util.js         # 歌手名/HTML 实体处理、逐字歌词解析
│   ├── core/useApp/
│   │   ├── useMusicService.js  # 音乐服务初始化
│   │   ├── useOpenAPI.js       # OpenAPI 路由注册
│   │   ├── useConfig.js        # 配置管理
│   │   ├── useProxy.js         # 代理配置
│   │   └── useEventListeners.js # 事件监听器
│   ├── utils/
│   │   ├── shared.js           # 通用工具（格式化时长/大小）
│   │   └── lyricParser.js      # LRC 歌词解析
│   ├── constants/
│   │   └── events.js           # 事件名称常量
│   └── server.js               # Express 服务入口
├── plugins/                    # 插件目录（音源脚本 + 配置）
│   ├── config.json             # 插件配置（首选插件/优先级/开关/settings）
│   ├── lxmusic-api.js          # 内置插件：远程 lxmusicapi 音源
│   └── *.js                    # 其它 lx-music 插件脚本
├── downloads/                  # 下载目录
│   ├── songs_db.json           # 收藏数据库
│   └── tx/ | wy/ | kw/         # 按音源分类的歌曲文件
├── vite.config.js              # Vite 配置
├── package.json
└── src/client/index.html        # 前端入口 HTML
```

## API 接口

### 音乐搜索

```
GET /api/music/search?q=关键词&page=1&limit=30&source=tx|wy|kw|all
```

- `q`: 搜索关键词
- `source`: 音源（`tx` 腾讯 / `wy` 网易云 / `kw` 酷我 / `all` 聚合）
- 返回 `{ list, total, allPage, limit, source }`

### 获取音乐 URL

```
GET /api/music/url?songId=xxx&source=tx|wy|kw&quality=320k
```

由插件系统按配置路由到具体插件获取播放链接。

### 可用音源

```
GET /api/music/sources
```

返回所有已启用插件聚合出的音源：`[{ id, name, type, actions, qualitys, pluginId }]`。

### 下载音乐

```
GET /api/music/download?songId=xxx&source=tx|wy|kw&name=歌名&singer=歌手
```

将歌曲下载到 `downloads/{source}/` 目录，返回文件路径。

### 收藏歌曲

```
POST /api/music/love
{ "song": { songId, name, singer, source, ... }, "source": "tx|wy|kw" }
```

下载歌曲和歌词，并保存到数据库。

### 获取收藏列表

```
GET /api/music/loved
```

### 歌词

```
GET /api/music/lyric?songId=xxx&source=tx|wy|kw&name=歌名&singer=歌手
```

### 插件管理

```
GET  /api/plugins                  # 插件列表 + 当前配置 + 聚合音源
POST /api/plugins/reload           # 重新扫描插件目录并重载全部插件
POST /api/plugins/active           # { "id": "插件id" }        指定首选插件
POST /api/plugins/fallback         # { "fallback": true }      失败时是否回退到其它插件
POST /api/plugins/source-override  # { "source": "kw", "pluginId": "插件id" }
POST /api/plugins/:id              # { "enabled": true, "priority": 100, "settings": { ... } }
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
{ "query": "关键词", "page": 1, "limit": 30, "source": "tx|wy|kw" }
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发环境

```bash
# 同时启动后端 API (端口 3100) 和前端 Vite (端口 51173)
npm run dev

# 或分别启动
npm run dev:api   # 后端 API
npm run dev:vue   # 前端 Vite 开发服务器
```

- 后端 API 运行在 `http://localhost:3100`
- 前端开发服务器运行在 `http://localhost:51173`（代理 `/api` 请求到 3100 端口）

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

也可通过环境变量 `PORT` 设置后端端口，默认 3100。
设置 HTTP 代理环境变量 `HTTP_PROXY` / `https_proxy` 可启用代理。

插件系统另有独立的环境变量（优先级低于 `plugins/config.json` 中已写入的值）：

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PLUGIN_DIR` | `plugins` | 插件脚本目录 |
| `PLUGIN_ACTIVE` | `''` | 首选插件 id，留空则按优先级自动选择 |
| `PLUGIN_FALLBACK` | `true` | 首选插件失败时是否回退到其它插件 |
| `PLUGIN_REQUEST_TIMEOUT` | `60000` | 单次插件请求超时（毫秒） |
| `PLUGIN_TLS_VERIFY` | `false` | 是否校验音源站点的 TLS 证书 |

## 插件系统

音源解析逻辑全部放在外部插件脚本里，应用本身不再内置任何音源地址或密钥。

### 安装插件

把 lx-music 风格的自定义源脚本（`.js`）直接放进 `plugins/` 目录，然后调用
`POST /api/plugins/reload` 或重启服务即可。每个文件对应一个插件，插件 id 就是去掉
`.js` 后的文件名，例如 `plugins/墨澜音乐源v2.3.0.js` → id `墨澜音乐源v2.3.0`。

插件通过 `globalThis.lx` 与宿主交互：

```js
const { EVENT_NAMES, request, on, send, utils, settings, env, version, currentScriptInfo } = globalThis.lx

on(EVENT_NAMES.request, ({ action, source, info }) => {
  // action: 'musicUrl' | 'getLyric'
  return request(url, { method: 'GET' }).then(({ body }) => body)
})

send(EVENT_NAMES.inited, {
  status: true,
  openDevTools: false,
  sources: {
    tx: { name: '腾讯音乐', type: 'music', actions: ['musicUrl'], qualitys: ['128k', '320k'] },
  },
})
```

沙箱内可用：`request`（HTTP 客户端）、`utils.crypto` / `utils.buffer` / `utils.zlib`、
`settings`（`config.json` 里该插件的配置）、`console`（自动加 `[plugin:名称]` 前缀）、
`Buffer` / `URL` / `TextEncoder` 等标准对象，以及一个只放通
`crypto`/`zlib`/`buffer`/`querystring`/`url`/`util`/`events`/`stream` 的 `require`。
`fs`、`child_process`、`process` 均不可用。

> 插件在 Node `vm` 沙箱中运行，沙箱只用于隔离与限制误用，**不是安全边界**。
> 请只加载来源可信的脚本。

### 配置文件

`plugins/config.json` 由 `/api/plugins` 接口维护，也可以手工编辑后 reload：

```json
{
  "dir": "plugins",
  "active": "墨澜音乐源v2.3.0",
  "fallback": true,
  "requestTimeout": 60000,
  "tlsVerify": false,
  "sourceOverrides": { "kw": "另一个插件id" },
  "plugins": {
    "墨澜音乐源v2.3.0": { "enabled": true, "priority": 100 },
    "lxmusic-api": {
      "enabled": true,
      "priority": 10,
      "settings": {
        "apiUrl": "https://lxmusicapi.onrender.com",
        "apiKey": "share-v3",
        "qualitys": { "tx": ["128k", "320k"], "wy": ["128k", "320k"] }
      }
    }
  }
}
```

新发现的插件会自动补上 `{ "enabled": true, "priority": 50 }`，被删除的插件条目会被清理。

### 选择插件

请求某个音源时，候选插件按以下顺序解析：

1. `sourceOverrides[source]` 指定的插件（若它支持该音源）
2. `active` 指定的首选插件
3. 其余启用且声明支持该音源的插件，按 `priority` 从大到小

`fallback: true` 时逐个尝试直到成功；`fallback: false` 时只用第一个候选。
插件返回空结果视为失败，会继续回退。

### 需要 Cookie 的音源

部分插件从脚本头部的 `/*! ... */` 注解里读取自己的配置项。例如 `墨澜音乐源v2.3.0`
支持 `@tx_cookie` / `@wy_cookie`，默认没有这两行，需要自己加进头部注解：

```js
/*!
 * @name 墨澜聚合音源
 * @tx_cookie 你的 QQ 音乐 Cookie
 * @wy_cookie 你的网易云 Cookie
 */
```

改完调用 `POST /api/plugins/reload` 即可生效。各插件支持哪些注解由插件自身决定，
脚本里可通过 `lx.currentScriptInfo.rawScript` 读到完整源码。

## 数据持久化

- 收藏数据：`downloads/songs_db.json`
- 下载歌曲：`downloads/tx/` 和 `downloads/wy/`
- 歌词文件：`downloads/tx/` 和 `downloads/wy/`

## 音源说明

内置模块（`src/sources/`）只负责**搜索**和**歌词**，歌曲播放地址统一由插件解析。

### 腾讯音乐（TX）

- 搜索：直接调用 QQ 音乐 API
- 支持音质：128k, 320k

### 网易云音乐（WY）

- 搜索：通过网易云 eapi 加密请求
- 支持音质：128k, 320k

### 播放地址

由 `plugins/` 下的插件提供，实际可用的音源与音质取决于插件声明。随仓库附带两个插件：

- `墨澜音乐源v2.3.0`：聚合音源，支持 tx / wy / kw / kg / mg
- `lxmusic-api`：调用 lx-music 分享接口，支持 tx / wy，地址与密钥写在 `config.json` 的
  该插件 `settings` 中

`kw` / `kg` / `mg` 可以解析播放地址，但没有对应的内置搜索模块，因此无法直接搜索。
调用 `GET /api/music/sources` 可查看当前聚合出的音源列表及其来源插件。

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
│  /api/plugins    插件管理                     │
│  /api/settings   配置管理                     │
│  /api/search     搜索（OpenAPI）              │
│  /api/lyrics     歌词                         │
└──────┬──────────────────────────────────────┘
       │
       ├──► musicService.js  ──► sources/tx/  (腾讯搜索/歌词)
       │                         sources/wy/  (网易云搜索/歌词)
       │
       ├──► downloadService.js ──► 下载歌曲文件
       │
       ├──► lyricService.js  ──► 获取歌词
       │
       ├──► plugins/manager.js ──► 插件调度（active / priority / 回退）
       │        │
       │        ├──► plugins/loader.js     扫描 plugins/*.js
       │        ├──► plugins/pluginRuntime.js  vm 沙箱 + globalThis.lx
       │        ├──► plugins/httpClient.js     插件 HTTP 客户端
       │        └──► plugins/config.json       插件配置
       │
       └──► databaseService.js ──► JSON 数据库