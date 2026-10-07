/**
 * 跨域图片抓取：WebGL/画布需要像素级访问，跨域图片直接绘制会污染画布，
 * 导致无法生成深度图和导出 PNG。因此必须拿到干净的像素：
 *   1. 优先直连（crossOrigin="anonymous"）：CDN 若返回 CORS 头，直接可用，无需授权弹窗
 *   2. 降级走 GM_xmlhttpRequest：经油猴扩展通道下载字节到本机内存，转同源 blob URL
 * 图片全程不出本机，不上传任何服务器。
 */

export function resolveImageURL(img) {
  const src = img.currentSrc || img.src || '';
  if (!src) return '';
  try { return new URL(src, location.href).href; }
  catch { return src; }
}

function loadImage(src, crossOrigin) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(
      crossOrigin ? '服务器未返回 CORS 头（Access-Control-Allow-Origin）' : '图片加载失败'));
    img.src = src;
  });
}

function loadViaGM(url) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      responseType: 'arraybuffer',
      timeout: 30000,
      onload(res) {
        if (res.status < 200 || res.status >= 300) {
          reject(new Error('服务器返回 HTTP ' + res.status + '（可能防盗链或需登录）'));
          return;
        }
        const m = /content-type:\s*([^\r\n;]+)/i.exec(res.responseHeaders || '');
        const blob = new Blob([res.response], { type: (m && m[1].trim()) || 'image/jpeg' });
        const objUrl = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(objUrl); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('图片解码失败')); };
        img.src = objUrl;
      },
      onerror: () => reject(new Error('网络错误（检查 @connect * 授权是否允许）')),
      ontimeout: () => reject(new Error('下载超时（30s）')),
    });
  });
}

/**
 * @returns {Promise<{img: HTMLImageElement, name: string}>}
 */
export async function fetchImageElement(imgEl) {
  const url = resolveImageURL(imgEl);
  if (!url) throw new Error('图片地址为空');
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return { img: await loadImage(url, false), name: guessName(url) };
  }
  const tried = [];
  // 1) 直连 + CORS
  try {
    return { img: await loadImage(url, true), name: guessName(url) };
  } catch (e) { tried.push('直连失败：' + e.message); }
  // 2) 扩展通道
  if (typeof GM_xmlhttpRequest !== 'undefined') {
    try {
      return { img: await loadViaGM(url), name: guessName(url) };
    } catch (e) { tried.push('扩展通道失败：' + e.message); }
  } else {
    tried.push('无 GM_xmlhttpRequest（请确认脚本以油猴脚本方式安装，而非直接当普通 JS 引用）');
  }
  throw new Error(tried.join('；'));
}

function guessName(url) {
  try {
    const p = new URL(url).pathname.split('/').filter(Boolean).pop() || 'IMAGE';
    return decodeURIComponent(p).slice(0, 24);
  } catch { return 'IMAGE'; }
}
