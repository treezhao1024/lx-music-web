/**
 * 插件管理接口
 *
 * GET  /api/plugins                    插件列表 + 当前配置 + 聚合音源
 * POST /api/plugins/reload             重新扫描插件目录并重载
 * POST /api/plugins/active             { id } 指定首选插件
 * POST /api/plugins/fallback           { fallback } 是否允许失败回退到其它插件
 * POST /api/plugins/source-override    { source, pluginId } 指定某音源固定使用的插件
 * POST /api/plugins/:id                { enabled?, priority?, settings? } 更新插件开关/优先级/设置
 */

import express from 'express'
import pluginManager from '../plugins/index.js'

const router = express.Router()

const wrap = handler => (req, res) => Promise.resolve(handler(req, res)).catch(error => {
  console.error('[PluginRoutes]', error)
  const status = /插件不存在/.test(error.message ?? '') ? 404 : 500
  res.status(status).json({ success: false, error: error.message })
})

const snapshot = () => ({
  config: pluginManager.getConfig(),
  plugins: pluginManager.listPlugins(),
  sources: pluginManager.getAvailableSources(),
})

router.get('/', wrap(async (req, res) => {
  await pluginManager.initialize()
  res.json({ success: true, ...snapshot() })
}))

router.post('/reload', wrap(async (req, res) => {
  await pluginManager.reload()
  res.json({ success: true, ...snapshot() })
}))

router.post('/active', wrap(async (req, res) => {
  const { id } = req.body ?? {}
  if (!id) {
    return res.status(400).json({ success: false, error: '缺少参数 id' })
  }

  await pluginManager.setActivePlugin(id)
  res.json({ success: true, ...snapshot() })
}))

router.post('/fallback', wrap(async (req, res) => {
  await pluginManager.setFallback((req.body ?? {}).fallback !== false)
  res.json({ success: true, ...snapshot() })
}))

router.post('/source-override', wrap(async (req, res) => {
  const { source, pluginId } = req.body ?? {}
  if (!source) {
    return res.status(400).json({ success: false, error: '缺少参数 source' })
  }
  await pluginManager.setSourceOverride(source, pluginId || null)
  res.json({ success: true, ...snapshot() })
}))

router.post('/:id', wrap(async (req, res) => {
  const { id } = req.params
  const { enabled, priority, settings } = req.body ?? {}

  if (enabled === undefined && priority === undefined && !settings) {
    return res.status(400).json({ success: false, error: '需要 enabled / priority / settings 中的至少一项' })
  }

  if (enabled !== undefined || priority !== undefined) {
    await pluginManager.updatePlugin(id, { enabled, priority })
  }
  if (settings) {
    await pluginManager.updateSettings(id, settings)
  }

  res.json({ success: true, ...snapshot() })
}))

export default router
