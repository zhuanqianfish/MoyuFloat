import React from 'react';
import { createRoot } from 'react-dom/client';
import cssText from './styles/shadow.css?inline';
import { Shell } from './components/shell/Shell';

const HOST_ID = 'moyufloat-shell';

(function boot() {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement('div');
  host.id = HOST_ID;
  // 宿主：全屏透明层，只承载 shadow UI，不拦截页面事件
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = cssText;
  shadow.appendChild(style);
  const mount = document.createElement('div');
  shadow.appendChild(mount);
  createRoot(mount).render(<Shell />);
})();
