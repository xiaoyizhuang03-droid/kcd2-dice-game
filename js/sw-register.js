// 注册 Service Worker：仅 HTTPS 或本机开发环境；失败静默降级（不影响游戏）
if ('serviceWorker' in navigator) {
  const secure = location.protocol === 'https:' ||
    ['localhost', '127.0.0.1'].includes(location.hostname);
  if (secure) {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => {
        // 每次加载主动检查 SW 更新，让新版本（含新缓存）尽快接管
        reg.update();
      })
      .catch(() => {});
  }
}
