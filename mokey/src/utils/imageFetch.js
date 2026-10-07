/**
 * 跨域图片抓取：Tampermonkey 的 GM_xmlhttpRequest 不受 CORS 限制，
 * 把任意 <img> 的像素拿出来送进 WebGL。
 */

export function resolveImageURL(img) {
  const src = img.currentSrc || img.src || '';
  if (!src) return '';
  try { return new URL(src, location.href).href; }
  catch { return src; }
}

function loadDirect(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = src;
  });
}

/**
 * @returns {Promise<{img: HTMLImageElement, name: string}>}
 */
export function fetchImageElement(imgEl) {
  const url = resolveImageURL(imgEl);
  if (!url) return Promise.reject(new Error('图片地址为空'));
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return loadDirect(url).then(img => ({ img, name: guessName(url) }));
  }
  const hasGM = typeof GM_xmlhttpRequest !== 'undefined';
  if (!hasGM) {
    // 降级：同源图可直接画（可能污染 canvas，仅尽力）
    return loadDirect(url).then(img => ({ img, name: guessName(url) }));
  }
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      timeout: 30000,
      onload(res) {
        if (res.status < 200 || res.status >= 300) {
          reject(new Error('图片下载失败 HTTP ' + res.status));
          return;
        }
        const m = /content-type:\s*([^\r\n;]+)/i.exec(res.responseHeaders || '');
        const blob = new Blob([res.response], { type: (m && m[1].trim()) || 'image/jpeg' });
        const objUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(objUrl); resolve({ img, name: guessName(url) }); };
        img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('图片解码失败')); };
        img.src = objUrl;
      },
      onerror: () => reject(new Error('图片下载失败')),
      ontimeout: () => reject(new Error('图片下载超时')),
    });
  });
}

function guessName(url) {
  try {
    const p = new URL(url).pathname.split('/').filter(Boolean).pop() || 'IMAGE';
    return decodeURIComponent(p).slice(0, 24);
  } catch { return 'IMAGE'; }
}
