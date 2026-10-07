/**
 * 摸鱼浮画 WebGL 引擎（油猴脚本版）
 * 由 MoyuFloat HTML 版移植：深度视差 + 法线光照 + 8 灯光，单 pass WebGL shader。
 * 框架无关：React 只通过 setParam / subscribe 与之交互。
 */

export const PRESETS = {
  standard: { name: '标准双灯', ambient: 72, lights: [['暖主灯', .30, .30, '#ff955d', 1.15, .48, .62], ['冷轮廓', .74, .62, '#62a8ff', .75, .42, .50]] },
  sunset:   { name: '落日', ambient: 45, lights: [['低角度橙光', .12, .58, '#ff7a2d', 1.35, .55, .45], ['弱蓝补光', .80, .30, '#3a5a8c', .35, .50, .60]] },
  night:    { name: '夜晚', ambient: 30, lights: [['顶部冷光', .50, .18, '#7a9cc6', .90, .50, .70]] },
  top:      { name: '顶光', ambient: 60, lights: [['顶光', .50, .15, '#fff2df', 1.20, .50, .75]] },
  bottom:   { name: '底光', ambient: 55, lights: [['底光', .50, .85, '#ff9a5d', 1.20, .50, .55]] },
  anime:    { name: '赛璐璐', ambient: 80, lights: [['亮主光', .35, .25, '#ffffff', 1.25, .55, .60], ['补光', .70, .55, '#bcd6ff', .60, .50, .50]] },
};

export const VIEW_MODES = [
  { id: 0, name: '合成' }, { id: 1, name: '深度' }, { id: 2, name: '法线' },
  { id: 3, name: '原图' }, { id: 4, name: '纯光照' }, { id: 5, name: '对比' },
];

const VS = `attribute vec2 aPos; varying vec2 vUv; void main(){vUv=aPos*.5+.5;gl_Position=vec4(aPos,0.,1.);}`;
const FS = `precision highp float;
varying vec2 vUv; uniform sampler2D uImage,uDepth; uniform vec2 uView,uTexel; uniform float uScale,uContrast,uNormalStrength,uInvert,uAmbient,uTime,uSplit,uExposure,uRim,uCel; uniform int uMode;
uniform vec3 uAmbientColor; uniform vec3 uLightPos[8]; uniform vec3 uLightColor[8]; uniform float uLightPower[8]; uniform float uLightRadius[8]; uniform float uLightEnabled[8]; uniform float uBlend;
float depthAt(vec2 uv){float d=texture2D(uDepth,clamp(uv,0.,1.)).r;d=mix(d,1.-d,uInvert);return clamp((d-.5)*uContrast+.5,0.,1.);}
void main(){
  vec2 base=mix(vec2(.035),vec2(.965),vUv);
  float d0=depthAt(base); vec2 uv=base-uView*uScale*(d0-.28); float d=depthAt(uv);
  uv=clamp(base-uView*uScale*(d-.28),.002,.998); d=depthAt(uv);
  float dx=depthAt(uv+vec2(uTexel.x,0.))-depthAt(uv-vec2(uTexel.x,0.));
  float dy=depthAt(uv+vec2(0.,uTexel.y))-depthAt(uv-vec2(0.,uTexel.y));
  vec3 n=normalize(vec3(-dx*uNormalStrength/uTexel.x*.006,-dy*uNormalStrength/uTexel.y*.006,1.));
  if(uMode==1){gl_FragColor=vec4(vec3(d),1.);return;} if(uMode==2){gl_FragColor=vec4(n*.5+.5,1.);return;}
  vec3 original=texture2D(uImage,vUv).rgb; if(uMode==3){gl_FragColor=vec4(original,1.);return;}
  vec3 baseColor=uMode==4?vec3(1.):texture2D(uImage,uv).rgb; vec3 lit=baseColor*uAmbient*uAmbientColor; float maxNdl=0.;
  for(int i=0;i<8;i++){
    vec3 surface=vec3(vUv,d*.18); vec3 delta=uLightPos[i]-surface; float dist=length(delta.xy);
    float fall=pow(clamp(1.-dist/max(uLightRadius[i],.01),0.,1.),1.7); float ndl=max(dot(n,normalize(delta)),0.);
    if(uCel>.5) ndl=ndl<.35?.06:(ndl<.7?.55:1.); maxNdl=max(maxNdl,ndl*uLightEnabled[i]);
    float amount=(.16+ndl*.84)*fall*uLightPower[i]*uLightEnabled[i];
    if(uBlend<.5) lit+=baseColor*uLightColor[i]*amount*.72; else lit+=uLightColor[i]*amount*.62;
  }
  lit+=vec3(1.)*pow(1.-maxNdl,2.5)*uRim*.6; float vignette=smoothstep(1.12,.28,length(vUv-.5)); lit*=mix(.93,1.,vignette); lit*=uExposure;
  vec3 composite=pow(clamp(lit,0.,1.),vec3(.98)); if(uMode==5&&vUv.x<uSplit) composite=original;
  gl_FragColor=vec4(composite,1.);
}`;

const AI_MODEL_URL = 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx';
const AI_CACHE_NAME = 'depth-anything-v2-small-v2';
const ORT_CDN = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/ort.all.min.js';
const ORT_WASM_PATH = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

function hexRgb(h) {
  return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
}

const defaultParams = () => ({
  depthScale: 4, contrast: 1.2, normalStrength: 2.4, invert: false,
  ambient: 72, ambientColor: '#ffffff', exposure: 1, rim: .25,
  cel: false, orbit: false, auto: true, blend: 0,
  viewMode: 0, split: .5, brushSize: 60,
});
const defaultLights = () => ([
  { name: '暖色主灯', x: .28, y: .28, z: .62, color: '#ff955d', power: 1.1, radius: .48, on: 1 },
  { name: '冷色轮廓', x: .76, y: .62, z: .5, color: '#62a8ff', power: .72, radius: .42, on: 1 },
]);

let seq = 0;

export class MoyuEngine {
  constructor() {
    this.canvas = null; this.gl = null; this.U = null;
    this.imageTex = null; this.depthTex = null;
    this.sourceCanvas = document.createElement('canvas');
    this.depthCanvas = document.createElement('canvas');
    this.sourceW = 0; this.sourceH = 0;
    this.hasImage = false;
    this.params = defaultParams();
    this.lights = defaultLights();
    this.selected = 0;
    this.toolMode = 'view'; this.paintMode = 0;
    this.view = { x: 0, y: 0 }; this.targetView = { x: 0, y: 0 };
    this._raf = 0; this._running = false; this._lastOrbit = 0;
    this._listeners = new Set(); this._version = 0;
    this._aiSession = null; this._aiProvider = ''; this._aiBusy = false; this._aiRetryFresh = false;
    this._notice = '';
  }

  /* ---------- 订阅 ---------- */
  subscribe(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  getSnapshot() { return this._version; }
  notify() { this._version++; this._listeners.forEach(fn => fn()); }
  setNotice(msg) { this._notice = msg; this.notify(); }
  get notice() { return this._notice; }

  setParam(key, value) { this.params[key] = value; this.notify(); }
  setTool(mode, paintValue) {
    this.toolMode = mode;
    this.paintMode = mode === 'paint' ? (paintValue || this.paintMode || 1) : 0;
    this.notify();
  }

  /* ---------- WebGL ---------- */
  attach(canvas) {
    if (this.canvas === canvas && this.gl) { this.resize(); return; }
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, alpha: false, antialias: true })
      || canvas.getContext('experimental-webgl', { preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL 不可用');
    this.gl = gl;
    const shader = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(program); gl.useProgram(program);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ['uImage', 'uDepth', 'uView', 'uTexel', 'uScale', 'uContrast', 'uNormalStrength', 'uInvert', 'uAmbient', 'uAmbientColor', 'uExposure', 'uRim', 'uCel', 'uSplit', 'uTime', 'uMode', 'uLightPos', 'uLightColor', 'uLightPower', 'uLightRadius', 'uLightEnabled', 'uBlend']
      .forEach(n => U[n] = gl.getUniformLocation(program, n));
    this.U = U;
    const makeTexture = (unit) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    };
    this.imageTex = makeTexture(0); this.depthTex = makeTexture(1);
    gl.uniform1i(U.uImage, 0); gl.uniform1i(U.uDepth, 1);
    if (this.hasImage) {
      this.uploadTexture(this.imageTex, this.sourceCanvas, 0);
      this.uploadTexture(this.depthTex, this.depthCanvas, 1);
    }
    this.resize();
    this.start();
  }

  uploadTexture(tex, src, unit) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }

  resize() {
    if (!this.canvas || !this.gl) return;
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w; this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  /* ---------- 图像与深度 ---------- */
  setImage(img, name) {
    const max = 1800, scale = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    this.sourceW = Math.max(2, Math.round((img.naturalWidth || img.width) * scale));
    this.sourceH = Math.max(2, Math.round((img.naturalHeight || img.height) * scale));
    this.sourceCanvas.width = this.sourceW; this.sourceCanvas.height = this.sourceH;
    this.sourceCanvas.getContext('2d').drawImage(img, 0, 0, this.sourceW, this.sourceH);
    if (this.gl) this.uploadTexture(this.imageTex, this.sourceCanvas, 0);
    this.generateDepthFromLuminance();
    this.hasImage = true;
    this.imageName = (name || 'IMAGE').toUpperCase().slice(0, 16);
    this.setNotice('已载入图像 · 亮度深度');
  }

  generateDepthFromLuminance() {
    const { sourceW: W, sourceH: H } = this;
    this.depthCanvas.width = W; this.depthCanvas.height = H;
    const d = this.depthCanvas.getContext('2d', { willReadFrequently: true });
    d.drawImage(this.sourceCanvas, 0, 0);
    const im = d.getImageData(0, 0, W, H), p = im.data;
    for (let i = 0; i < p.length; i += 4) {
      const y = p[i] * .2126 + p[i + 1] * .7152 + p[i + 2] * .0722;
      const row = Math.floor(i / 4 / W) / H;
      const v = Math.max(0, Math.min(255, y * .72 + row * 72));
      p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255;
    }
    d.putImageData(im, 0, 0);
    d.filter = 'blur(10px)'; d.drawImage(this.depthCanvas, 0, 0); d.filter = 'none';
    if (this.gl) this.uploadTexture(this.depthTex, this.depthCanvas, 1);
    this.setNotice('已生成亮度深度，可用画笔修正');
  }

  loadDepthImage(img) {
    const { sourceW: W, sourceH: H } = this;
    const t = document.createElement('canvas'); t.width = W; t.height = H;
    const c = t.getContext('2d'); c.drawImage(img, 0, 0, W, H);
    const im = c.getImageData(0, 0, W, H), p = im.data;
    for (let i = 0; i < p.length; i += 4) {
      const y = p[i] * .2126 + p[i + 1] * .7152 + p[i + 2] * .0722;
      p[i] = p[i + 1] = p[i + 2] = y; p[i + 3] = 255;
    }
    c.putImageData(im, 0, 0);
    this.depthCanvas = t;
    if (this.gl) this.uploadTexture(this.depthTex, this.depthCanvas, 1);
    this.setNotice('已载入深度图');
  }

  paintDepth(fx, fy, sizePx, mode) {
    // fx, fy: 相对画布 0~1 坐标；mode: 1 涂近 / -1 涂远
    if (!this.hasImage) return;
    const x = fx * this.sourceW, y = fy * this.sourceH;
    const size = sizePx * this.sourceW / 900;
    const c = this.depthCanvas.getContext('2d');
    c.save();
    c.fillStyle = mode === 1 ? 'rgba(255,255,255,.14)' : 'rgba(0,0,0,.14)';
    c.beginPath(); c.arc(x, y, size, 0, Math.PI * 2); c.fill();
    c.restore();
    if (this.gl) this.uploadTexture(this.depthTex, this.depthCanvas, 1);
  }

  getDepthDataURL() {
    return this.hasImage ? this.depthCanvas.toDataURL() : '';
  }

  /* ---------- AI 深度 ---------- */
  aiFailureMessage(err) {
    const msg = String((err && err.message) || err || '').toLowerCase();
    if (msg.includes('runtime-unavailable')) return 'AI 组件未加载，请检查网络后重试';
    if (msg.includes('model-network') || msg.includes('model-download')) return 'AI 模型下载失败，请检查网络后重试';
    if (msg.includes('model-incomplete')) return 'AI 模型下载不完整，再点一次即可重新下载';
    if (msg.includes('memory') || msg.includes('allocation')) return '设备内存不足，请关闭其他页面后重试';
    return 'AI 推理失败，再点一次将重新载入模型';
  }

  async ensureOrt() {
    if (window.ort) return;
    await loadScript(ORT_CDN);
    if (!window.ort) throw new Error('runtime-unavailable');
  }

  async fetchModelBytes(forceNetwork, onProgress) {
    let response = null, fromCache = false, cache = null, cacheWrite = null;
    if ('caches' in window) {
      try {
        cache = await caches.open(AI_CACHE_NAME);
        if (forceNetwork) await cache.delete(AI_MODEL_URL);
        else { response = await cache.match(AI_MODEL_URL); fromCache = !!response; }
      } catch (e) { cache = null; }
    }
    if (!response) {
      try { response = await fetch(AI_MODEL_URL, { mode: 'cors', cache: forceNetwork ? 'reload' : 'force-cache' }); }
      catch (e) { throw new Error('model-network'); }
      if (!response.ok) throw new Error('model-download-' + response.status);
      if (cache) { try { cacheWrite = cache.put(AI_MODEL_URL, response.clone()).catch(() => {}); } catch (e) {} }
    }
    const total = +(response.headers.get('content-length') || 0), reader = response.body && response.body.getReader();
    if (!reader) {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength < 20000000) throw new Error('model-incomplete');
      onProgress(76, fromCache ? '本地模型已就绪' : '模型下载完成');
      return { bytes: buffer, fromCache };
    }
    const chunks = []; let loaded = 0;
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      chunks.push(part.value); loaded += part.value.byteLength;
      const ratio = total ? loaded / total : Math.min(.94, loaded / 105000000);
      onProgress(5 + ratio * 71, (fromCache ? '读取本地模型 ' : '下载 AI 模型 ') + (loaded / 1048576).toFixed(1) + ' MB');
    }
    if (loaded < 20000000) throw new Error('model-incomplete');
    const merged = new Uint8Array(loaded); let offset = 0;
    chunks.forEach(chunk => { merged.set(chunk, offset); offset += chunk.byteLength; });
    if (cacheWrite) cacheWrite.catch(() => {});
    onProgress(76, fromCache ? '本地模型已就绪' : '模型下载完成');
    return { bytes: merged.buffer, fromCache };
  }

  async ensureAISession(onProgress) {
    if (this._aiSession) return this._aiSession;
    await this.ensureOrt();
    const ort = window.ort;
    ort.env.wasm.wasmPaths = ORT_WASM_PATH; ort.env.wasm.numThreads = 1; ort.env.wasm.simd = true;
    let model = await this.fetchModelBytes(this._aiRetryFresh, onProgress);
    this._aiRetryFresh = false;
    const create = async (bytes) => {
      let hasWebGPU = false;
      if (navigator.gpu && navigator.gpu.requestAdapter) { try { hasWebGPU = !!(await navigator.gpu.requestAdapter()); } catch (e) {} }
      const providers = hasWebGPU ? ['webgpu', 'wasm'] : ['wasm'];
      onProgress(80, hasWebGPU ? '初始化 WebGPU / WASM' : '初始化 WASM 推理引擎');
      try {
        const s = await ort.InferenceSession.create(bytes, { executionProviders: providers, graphOptimizationLevel: 'all' });
        this._aiProvider = hasWebGPU ? 'WebGPU' : 'WASM';
        return s;
      } catch (firstError) {
        if (!hasWebGPU) throw firstError;
        onProgress(82, 'WebGPU 初始化失败，改用 WASM');
        const s = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
        this._aiProvider = 'WASM';
        return s;
      }
    };
    try { this._aiSession = await create(model.bytes); }
    catch (err) {
      if (!model.fromCache) throw err;
      onProgress(8, '缓存模型不可用，正在重新下载');
      model = await this.fetchModelBytes(true, onProgress);
      this._aiSession = await create(model.bytes);
    }
    return this._aiSession;
  }

  async generateAIDepth(onProgress) {
    if (this._aiBusy || !this.hasImage) return;
    this._aiBusy = true; this.notify();
    onProgress(1, '检查运行环境');
    try {
      const session = await this.ensureAISession(onProgress);
      const ort = window.ort;
      const all = session.inputMetadata;
      const meta = Array.isArray(all) ? all[0] : (all && all[session.inputNames[0]]);
      const dims = meta && (meta.dimensions || meta.dims);
      const fixed = dims && Number(dims[dims.length - 1]);
      const size = (Number.isFinite(fixed) && fixed > 0) ? fixed : (navigator.deviceMemory && navigator.deviceMemory <= 4 ? 252 : 392);
      const prep = document.createElement('canvas'); prep.width = size; prep.height = size;
      const pc = prep.getContext('2d', { willReadFrequently: true });
      pc.drawImage(this.sourceCanvas, 0, 0, size, size);
      const pixels = pc.getImageData(0, 0, size, size).data;
      const data = new Float32Array(3 * size * size), mean = [.485, .456, .406], std = [.229, .224, .225];
      onProgress(87, '准备 ' + size + ' × ' + size + ' 图像');
      for (let i = 0; i < size * size; i++) {
        data[i] = (pixels[i * 4] / 255 - mean[0]) / std[0];
        data[size * size + i] = (pixels[i * 4 + 1] / 255 - mean[1]) / std[1];
        data[size * size * 2 + i] = (pixels[i * 4 + 2] / 255 - mean[2]) / std[2];
      }
      onProgress(91, 'AI 正在估算空间层次');
      const inputName = session.inputNames[0], feeds = {};
      feeds[inputName] = new ort.Tensor('float32', data, [1, 3, size, size]);
      const outputs = await session.run(feeds);
      const result = outputs[session.outputNames[0]], values = result.data, odims = result.dims;
      const outW = odims[odims.length - 1], outH = odims[odims.length - 2];
      let min = Infinity, max = -Infinity;
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
      }
      if (!Number.isFinite(min) || max <= min) throw new Error('invalid-depth');
      const map = document.createElement('canvas'); map.width = outW; map.height = outH;
      const mc = map.getContext('2d'), image = mc.createImageData(outW, outH), range = max - min;
      for (let i = 0; i < outW * outH; i++) {
        const v = Math.max(0, Math.min(255, Math.round((values[i] - min) / range * 255)));
        image.data[i * 4] = image.data[i * 4 + 1] = image.data[i * 4 + 2] = v; image.data[i * 4 + 3] = 255;
      }
      mc.putImageData(image, 0, 0);
      this.depthCanvas.width = this.sourceW; this.depthCanvas.height = this.sourceH;
      const dc = this.depthCanvas.getContext('2d');
      dc.imageSmoothingEnabled = true; dc.imageSmoothingQuality = 'high';
      dc.drawImage(map, 0, 0, this.sourceW, this.sourceH);
      if (this.gl) this.uploadTexture(this.depthTex, this.depthCanvas, 1);
      onProgress(100, 'AI 深度已生成 · ' + this._aiProvider);
      this.setNotice('AI 深度已生成 · ' + this._aiProvider + '，可用画笔修正');
    } catch (err) {
      console.error('AI depth failed', err);
      this._aiSession = null; this._aiProvider = ''; this._aiRetryFresh = true;
      onProgress(0, '未改变当前深度 · 可直接重试');
      this.setNotice(this.aiFailureMessage(err));
      throw err;
    } finally { this._aiBusy = false; this.notify(); }
  }
  get aiBusy() { return this._aiBusy; }
  get aiProvider() { return this._aiProvider; }

  /* ---------- 灯光 ---------- */
  addLight(x = .5, y = .42) {
    if (this.lights.length >= 8) { this.setNotice('最多支持 8 盏实时灯光'); return; }
    const colors = ['#ff955d', '#62a8ff', '#b3ff9e', '#c99eff'], n = this.lights.length + 1;
    this.lights.push({ name: '灯光 ' + n, x, y, z: .55, color: colors[(n - 1) % colors.length], power: .8, radius: .38, on: 1 });
    this.selected = this.lights.length - 1;
    this.notify();
  }
  deleteLight(i) {
    if (i < 0 || i >= this.lights.length) return;
    this.lights.splice(i, 1);
    this.selected = Math.min(this.selected, this.lights.length - 1);
    this.setNotice('已删除灯光'); this.notify();
  }
  updateLight(i, patch) { Object.assign(this.lights[i], patch); this.notify(); }
  applyPreset(key) {
    const p = PRESETS[key]; if (!p) return;
    this.lights = p.lights.map(x => ({ name: x[0], x: x[1], y: x[2], color: x[3], power: x[4], radius: x[5], z: x[6], on: 1 }));
    this.selected = 0;
    this.params.ambient = p.ambient;
    this.setNotice('已应用「' + p.name + '」预设'); this.notify();
  }
  hitLight(px, py, w, h) {
    let hit = -1, best = 24;
    this.lights.forEach((l, i) => {
      const d = Math.hypot(px - l.x * w, py - l.y * h);
      if (d <= best) { best = d; hit = i; }
    });
    return hit;
  }
  moveSelectedLight(fx, fy) {
    const l = this.lights[this.selected]; if (!l) return;
    l.x = Math.max(0, Math.min(1, fx)); l.y = Math.max(0, Math.min(1, fy));
    this.notify();
  }

  /* ---------- 渲染循环 ---------- */
  start() {
    if (this._running || !this.gl) return;
    this._running = true;
    const loop = (t) => {
      if (!this._running) return;
      this.render(t);
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }
  stop() { this._running = false; cancelAnimationFrame(this._raf); }

  render(t) {
    const gl = this.gl, U = this.U, P = this.params;
    if (!gl || !U || !this.hasImage) return;
    if (P.orbit) {
      const dt = this._lastOrbit ? Math.min((t - this._lastOrbit) / 1000, .05) : 0;
      const angle = dt * .24, cs = Math.cos(angle), sn = Math.sin(angle);
      this.lights.forEach(l => {
        if (!l.on) return;
        const x = l.x - .5, y = l.y - .5;
        l.x = .5 + x * cs - y * sn; l.y = .5 + x * sn + y * cs;
      });
      if (dt) this.notify();
    }
    this._lastOrbit = t;
    // 视角平滑
    this.view.x += (this.targetView.x - this.view.x) * .12;
    this.view.y += (this.targetView.y - this.view.y) * .12;

    gl.uniform2f(U.uView, this.view.x, this.view.y);
    gl.uniform2f(U.uTexel, 1 / this.sourceW, 1 / this.sourceH);
    gl.uniform1f(U.uScale, P.depthScale / 100);
    gl.uniform1f(U.uContrast, P.contrast);
    gl.uniform1f(U.uNormalStrength, P.normalStrength);
    gl.uniform1f(U.uInvert, P.invert ? 1 : 0);
    gl.uniform1f(U.uAmbient, P.ambient / 100);
    gl.uniform3fv(U.uAmbientColor, new Float32Array(hexRgb(P.ambientColor)));
    gl.uniform1f(U.uExposure, P.exposure);
    gl.uniform1f(U.uRim, P.rim);
    gl.uniform1f(U.uCel, P.cel ? 1 : 0);
    gl.uniform1f(U.uSplit, P.viewMode === 5 ? P.split : -1);
    gl.uniform1f(U.uTime, t / 1000);
    gl.uniform1i(U.uMode, P.viewMode);
    gl.uniform1f(U.uBlend, P.blend);
    const lp = [], lc = [], pw = [], ra = [], en = [];
    for (let i = 0; i < 8; i++) {
      const l = this.lights[i];
      if (l) { lp.push(l.x, l.y, l.z); const c = hexRgb(l.color); lc.push(c[0], c[1], c[2]); pw.push(l.power); ra.push(l.radius); en.push(l.on); }
      else { lp.push(0, 0, 0); lc.push(0, 0, 0); pw.push(0); ra.push(1); en.push(0); }
    }
    gl.uniform3fv(U.uLightPos, new Float32Array(lp));
    gl.uniform3fv(U.uLightColor, new Float32Array(lc));
    gl.uniform1fv(U.uLightPower, new Float32Array(pw));
    gl.uniform1fv(U.uLightRadius, new Float32Array(ra));
    gl.uniform1fv(U.uLightEnabled, new Float32Array(en));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /* ---------- 导出 / 重置 ---------- */
  exportPNG() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        this.render(performance.now());
        this.canvas.toBlob(blob => resolve(blob), 'image/png');
      });
    });
  }

  reset() {
    this.params = defaultParams();
    this.lights = defaultLights();
    this.selected = 0;
    this.toolMode = 'view'; this.paintMode = 0;
    this.view = { x: 0, y: 0 }; this.targetView = { x: 0, y: 0 };
    this.notify();
  }
}

/** 单例：脚本生命周期内复用（AI 模型只加载一次） */
export const engine = new MoyuEngine();
