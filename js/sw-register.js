// 注册 Service Worker：仅 HTTPS 或本机开发环境；失败静默降级（不影响游戏）
if ('serviceWorker' in navigator) {
  const secure = location.protocol === 'https:' ||
    ['localhost', '127.0.0.1'].includes(location.hostname);
  if (secure) {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => {
        // 每次加载主动检查 SW 更新
        reg.update();
        // 新版本 SW 接管时自动刷新一次，加载最新代码（同一会话仅一次，避免循环）
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (sessionStorage.getItem('sw-updated')) return;
          sessionStorage.setItem('sw-updated', '1');
          location.reload();
        });
      })
      .catch(() => {});
  }
}
