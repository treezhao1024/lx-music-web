// 事件名称常量
export default {
  // 插件初始化完成事件
  inited: 'lx:inited',
  // 请求事件（用于处理各种动作，如 musicUrl）
  request: 'lx:request',
  // 请求响应事件（旧式插件通过该事件回传结果）
  requestResponse: 'lx:request:response',
  // 插件状态更新事件
  updateStatus: 'lx:updateStatus',
  // 环境类型
  env: 'lx:env',
  // 版本信息
  version: 'lx:version'
}
