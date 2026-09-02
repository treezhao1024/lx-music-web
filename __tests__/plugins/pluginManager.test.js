import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { PluginManager } from '../../src/plugins/manager.js';

const FIXTURES = {
  'plugin-a.js': `/*!
 * @name 测试插件A
 * @description 总是失败，用于验证回退
 * @version 1.0.0
 * @author tester
 */
const { EVENT_NAMES, on, send } = globalThis.lx
on(EVENT_NAMES.request, () => Promise.reject(new Error('plugin-a always fails')))
send(EVENT_NAMES.inited, {
  status: true,
  sources: { tx: { name: 'TX-A', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } },
})
`,
  'plugin-b.js': `/*!
 * @name 测试插件B
 * @version 2.0.0
 */
const { EVENT_NAMES, on, send } = globalThis.lx
on(EVENT_NAMES.request, ({ action, source, info }) => {
  if (action !== 'musicUrl') return Promise.reject(new Error('action not support: ' + action))
  return Promise.resolve('url-from-b:' + source + ':' + info.type)
})
send(EVENT_NAMES.inited, {
  status: true,
  sources: {
    tx: { name: 'TX-B', type: 'music', actions: ['musicUrl'], qualitys: ['128k', '320k'] },
    kw: { name: 'KW-B', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] },
  },
})
`,
  'plugin-legacy.js': `/*!
 * @name 旧式响应事件插件
 * @version 1.0.0
 */
const { EVENT_NAMES, on, send } = globalThis.lx
on(EVENT_NAMES.request, ({ requestId, source }) => {
  send(EVENT_NAMES.request + ':response', { requestId, result: 'legacy-ok:' + source })
})
send(EVENT_NAMES.inited, {
  status: true,
  sources: { mg: { name: 'MG', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } },
})
`,
  'plugin-runtime.js': `/*!
 * @name 运行时能力插件
 * @version 1.0.0
 */
const { EVENT_NAMES, on, send, utils, env, version, settings } = globalThis.lx
on(EVENT_NAMES.request, () => {
  const cipher = utils.crypto.aesEncrypt('hello', 'aes-128-ecb', 'e82ckenh8dichen8', '')
  return Promise.resolve({
    greeting: settings.greeting,
    md5: utils.crypto.md5('abc'),
    aes: utils.buffer.bufToString(cipher, 'hex'),
    env,
    version,
    hasProcess: typeof process !== 'undefined',
    canRequireFs: (() => { try { require('fs'); return true } catch (e) { return false } })(),
  })
})
send(EVENT_NAMES.inited, {
  status: true,
  sources: { wy: { name: 'WY', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } },
})
`,
  'plugin-empty.js': `/*!
 * @name 空结果插件
 * @version 1.0.0
 */
const { EVENT_NAMES, on, send } = globalThis.lx
on(EVENT_NAMES.request, () => Promise.resolve(undefined))
send(EVENT_NAMES.inited, {
  status: true,
  sources: { tx: { name: 'TX-EMPTY', type: 'music', actions: ['musicUrl'], qualitys: ['128k'] } },
})
`,
  'plugin-broken.js': `throw new Error('boom at load time')
`,
};

describe('PluginManager', () => {
  let dir;
  let manager;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lx-plugins-'));
    for (const [name, content] of Object.entries(FIXTURES)) {
      await fs.writeFile(path.join(dir, name), content, 'utf-8');
    }
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // 清掉上一个用例写入的配置，保证用例之间互不影响
    await fs.rm(path.join(dir, 'config.json'), { force: true });
    manager = new PluginManager();
    await manager.initialize({ dir });
  });

  const songInfo = { songmid: 'abc123', source: 'tx' };

  test('加载插件目录并解析头部注解', () => {
    const pluginB = manager.listPlugins().find(p => p.id === 'plugin-b');

    expect(pluginB).toBeDefined();
    expect(pluginB.name).toBe('测试插件B');
    expect(pluginB.version).toBe('2.0.0');
    expect(pluginB.author).toBe('');
    expect(pluginB.sources.map(s => s.id)).toEqual(['tx', 'kw']);
  });

  test('加载失败的插件被记录且不影响其它插件', () => {
    const broken = manager.listPlugins().find(p => p.id === 'plugin-broken');

    expect(broken.error).toContain('boom at load time');
    expect(manager.getPlugin('plugin-b')).not.toBeNull();
  });

  test('聚合可用音源，首选插件的定义优先', async () => {
    await manager.setActivePlugin('plugin-b');
    const sources = manager.getAvailableSources();

    expect(Object.keys(sources).sort()).toEqual(['kw', 'mg', 'tx', 'wy']);
    expect(sources.tx.pluginId).toBe('plugin-b');
    expect(sources.tx.qualitys).toEqual(['128k', '320k']);
  });

  test('请求路由到首选插件', async () => {
    await manager.setActivePlugin('plugin-b');

    await expect(manager.request('musicUrl', 'tx', { type: '320k', musicInfo: songInfo }))
      .resolves.toBe('url-from-b:tx:320k');
  });

  test('首选插件失败时回退到下一个插件', async () => {
    await manager.setActivePlugin('plugin-a');

    await expect(manager.request('musicUrl', 'tx', { type: '128k', musicInfo: songInfo }))
      .resolves.toBe('url-from-b:tx:128k');
  });

  test('插件返回空结果时继续回退', async () => {
    await manager.setActivePlugin('plugin-empty');

    await expect(manager.request('musicUrl', 'tx', { type: '128k', musicInfo: songInfo }))
      .resolves.toBe('url-from-b:tx:128k');
  });

  test('关闭 fallback 后不再尝试其它插件，且保留沙箱内的错误信息', async () => {
    await manager.setActivePlugin('plugin-a');
    await manager.setFallback(false);

    await expect(manager.request('musicUrl', 'tx', { type: '128k', musicInfo: songInfo }))
      .rejects.toThrow('所有插件均失败（1 个）\n测试插件A: plugin-a always fails');
  });

  test('禁用的插件不参与路由与音源聚合', async () => {
    await manager.updatePlugin('plugin-b', { enabled: false });

    expect(Object.keys(manager.getAvailableSources())).not.toContain('kw');
    await expect(manager.request('musicUrl', 'kw', { type: '128k', musicInfo: songInfo }))
      .rejects.toThrow(/没有插件可处理/);
  });

  test('sourceOverrides 可以让指定音源绕过首选插件', async () => {
    await manager.setActivePlugin('plugin-a');
    await manager.setSourceOverride('tx', 'plugin-b');

    await expect(manager.request('musicUrl', 'tx', { type: '128k', musicInfo: songInfo }))
      .resolves.toBe('url-from-b:tx:128k');
  });

  test('不支持该 action 的插件不会被选中', async () => {
    await manager.setActivePlugin('plugin-b');

    await expect(manager.request('getLyric', 'tx', { musicInfo: songInfo }))
      .rejects.toThrow(/没有插件可处理/);
  });

  test('兼容通过响应事件回传结果的旧式插件', async () => {
    await expect(manager.request('musicUrl', 'mg', { type: '128k', musicInfo: {} }))
      .resolves.toBe('legacy-ok:mg');
  });

  test('注入 settings / utils / env / version，且不泄露宿主全局', async () => {
    await manager.updateSettings('plugin-runtime', { greeting: 'hi-from-config' });
    const result = await manager.request('musicUrl', 'wy', { type: '128k', musicInfo: {} });

    const cipher = crypto.createCipheriv('aes-128-ecb', Buffer.from('e82ckenh8dichen8'), null);
    const expectedAes = Buffer.concat([cipher.update('hello'), cipher.final()]).toString('hex');

    expect(result.greeting).toBe('hi-from-config');
    expect(result.md5).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(result.aes).toBe(expectedAes);
    expect(result.env).toBe('desktop');
    expect(result.version).toBeTruthy();
    expect(result.hasProcess).toBe(false);
    expect(result.canRequireFs).toBe(false);
  });

  test('settings 更新会写入插件目录的 config.json 并在重载后生效', async () => {
    await manager.updateSettings('plugin-runtime', { greeting: 'persisted' });

    const saved = JSON.parse(await fs.readFile(path.join(dir, 'config.json'), 'utf-8'));
    expect(saved.plugins['plugin-runtime'].settings.greeting).toBe('persisted');

    const reloaded = new PluginManager();
    await reloaded.initialize({ dir });
    const result = await reloaded.request('musicUrl', 'wy', { type: '128k', musicInfo: {} });
    expect(result.greeting).toBe('persisted');
  });

  test('active / enabled / priority 持久化到 config.json', async () => {
    await manager.setActivePlugin('plugin-b');
    await manager.updatePlugin('plugin-a', { enabled: false, priority: 5 });

    const saved = JSON.parse(await fs.readFile(path.join(dir, 'config.json'), 'utf-8'));
    expect(saved.active).toBe('plugin-b');
    expect(saved.plugins['plugin-a']).toEqual({ enabled: false, priority: 5 });
  });

  test('拒绝切换到不存在的插件', async () => {
    await expect(manager.setActivePlugin('nope')).rejects.toThrow(/插件不存在/);
  });

  test('getMusicUrl 便捷方法透传音质与歌曲信息', async () => {
    await manager.setActivePlugin('plugin-b');

    await expect(manager.getMusicUrl(songInfo, '128k')).resolves.toBe('url-from-b:tx:128k');
  });
});
