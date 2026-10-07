import React, { useRef, useState } from 'react';
import SpotlightCard from '../bits/SpotlightCard/SpotlightCard';
import StarBorder from '../bits/StarBorder/StarBorder';
import { engine, PRESETS, VIEW_MODES } from '../../engine/moyuEngine';
import { useEngine } from '../useEngine';
import { ParamSlider, ParamSwitch, SegButtons, MiniSwitch } from '../ui';

/* ---------------- 深度 ---------------- */
export function DepthTab() {
  useEngine();
  const fileRef = useRef(null);
  const [ai, setAi] = useState({ v: 0, label: '', running: false });

  const runAI = async () => {
    if (ai.running) return;
    setAi({ v: 1, label: '检查运行环境', running: true });
    try {
      await engine.generateAIDepth((v, label) => setAi({ v, label, running: true }));
    } catch (e) { /* 引擎已写入 notice */ }
    setAi(a => ({ ...a, running: false }));
    setTimeout(() => setAi({ v: 0, label: '', running: false }), 1800);
  };

  const onDepthFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { engine.setNotice('请选择 PNG、JPG 或 WEBP 图片'); return; }
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => engine.loadDepthImage(img);
      img.src = r.result;
    };
    r.readAsDataURL(f);
  };

  return (
    <>
      <SpotlightCard className="mf-card" spotlightColor="rgba(255,90,54,.18)">
        <h4>深度来源</h4>
        <div className="mf-btn-row" style={{ marginBottom: 8 }}>
          <button type="button" className="mf-btn" onClick={() => engine.generateDepthFromLuminance()}>亮度生成</button>
          <button type="button" className="mf-btn" onClick={() => fileRef.current.click()}>上传深度图</button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onDepthFile} />
        </div>
        <StarBorder className="mf-starbtn" color="#ff5a36" backgroundColor="#171816" textColor="#f4f3ec"
          onClick={runAI} disabled={ai.running}>
          {ai.running ? 'AI 生成中…' : engine.aiProvider ? `AI 生成深度（${engine.aiProvider}）` : 'AI 生成深度'}
        </StarBorder>
        {(ai.running || ai.label) && (
          <div className="mf-ai-progress">
            <div className="mf-ai-track"><div className="mf-ai-fill" style={{ width: ai.v + '%' }} /></div>
            <div className="mf-ai-row"><span>{ai.label}</span><span>{Math.round(ai.v)}%</span></div>
          </div>
        )}
      </SpotlightCard>

      <SpotlightCard className="mf-card" spotlightColor="rgba(255,90,54,.14)">
        <h4>深度调节</h4>
        <ParamSlider param="depthScale" label="深度强度" min={0} max={12} step={.1} format={v => v.toFixed(1) + '%'} />
        <ParamSlider param="contrast" label="对比度" min={.2} max={3} step={.05} format={v => v.toFixed(2)} />
        <ParamSlider param="normalStrength" label="法线强度" min={0} max={6} step={.1} format={v => v.toFixed(1) + '×'} />
        <ParamSwitch param="invert" label="深度反转" />
        {engine.hasImage && (
          <img className="mf-depth-thumb" src={engine.getDepthDataURL()} alt="深度预览" style={{ marginTop: 8 }} />
        )}
      </SpotlightCard>

      <SpotlightCard className="mf-card" spotlightColor="rgba(255,90,54,.14)">
        <h4>深度画笔</h4>
        <div style={{ marginBottom: 8 }}>
          <SegButtons cols={2} value={engine.toolMode === 'paint' ? engine.paintMode : 0}
            onPick={(id) => id === 0 ? engine.setTool('view') : engine.setTool('paint', id)}
            options={[{ id: 1, name: '涂近 ◐' }, { id: -1, name: '涂远 ◑' }]} />
        </div>
        <ParamSlider param="brushSize" label="画笔大小" min={10} max={220} step={1} format={v => Math.round(v) + 'px'} />
        <div className="mf-check"><span>绘制模式</span>
          <button type="button" role="switch" aria-checked={engine.toolMode === 'paint'}
            className={'mf-mini-switch' + (engine.toolMode === 'paint' ? ' on' : '')}
            onClick={() => engine.setTool(engine.toolMode === 'paint' ? 'view' : 'paint', 1)} />
        </div>
      </SpotlightCard>
    </>
  );
}

/* ---------------- 灯光 ---------------- */
export function LightsTab() {
  useEngine();
  const l = engine.lights[engine.selected];

  return (
    <>
      <SpotlightCard className="mf-card" spotlightColor="rgba(255,176,58,.16)">
        <h4>灯光预设</h4>
        <div className="mf-chips">
          {Object.entries(PRESETS).map(([key, p]) => (
            <button key={key} type="button" className="mf-chip" onClick={() => engine.applyPreset(key)}>{p.name}</button>
          ))}
        </div>
      </SpotlightCard>

      <SpotlightCard className="mf-card" spotlightColor="rgba(255,176,58,.14)">
        <h4>灯光列表（{engine.lights.length} / 8）</h4>
        {engine.lights.map((lt, i) => (
          <button key={i} type="button"
            className={'mf-light-item' + (i === engine.selected ? ' active' : '')}
            onClick={() => { engine.selected = i; engine.notify(); }}>
            <span className="mf-swatch" style={{ ['--sw']: lt.color }} />
            <span>
              <span className="mf-light-name">{lt.name}{lt.on ? '' : '（关）'}</span>
              <span className="mf-light-pos" style={{ display: 'block' }}>
                X {Math.round(lt.x * 100)} · Y {Math.round(lt.y * 100)} · Z {lt.z.toFixed(2)}
              </span>
            </span>
            <span className="mf-icon-actions">
              <button type="button" aria-label="开关" onClick={(e) => { e.stopPropagation(); engine.updateLight(i, { on: lt.on ? 0 : 1 }); }}>{lt.on ? '●' : '○'}</button>
              <button type="button" aria-label="删除" onClick={(e) => { e.stopPropagation(); engine.deleteLight(i); }}>×</button>
            </span>
          </button>
        ))}
        <button type="button" className="mf-add-light" disabled={engine.lights.length >= 8}
          onClick={() => engine.addLight()}>＋ 添加灯光（双击画布也可添加）</button>
      </SpotlightCard>

      <SpotlightCard className="mf-card" spotlightColor="rgba(255,176,58,.14)">
        <h4>{l ? l.name : '选中灯光'}</h4>
        {l ? (
          <>
            <div className="mf-ctrl">
              <div className="mf-label-row"><span>颜色</span></div>
              <input type="color" value={l.color}
                onChange={e => engine.updateLight(engine.selected, { color: e.target.value })} />
            </div>
            <SliderCtl label="强度" value={l.power} min={0} max={2.5} step={.05} format={v => v.toFixed(2)}
              onChange={v => engine.updateLight(engine.selected, { power: v })} />
            <SliderCtl label="范围" value={l.radius * 100} min={5} max={100} step={1} format={v => Math.round(v) + '%'}
              onChange={v => engine.updateLight(engine.selected, { radius: v / 100 })} />
            <SliderCtl label="高度" value={l.z} min={0} max={1} step={.01} format={v => v.toFixed(2)}
              onChange={v => engine.updateLight(engine.selected, { z: v })} />
          </>
        ) : <div className="mf-label-row"><span>暂无灯光</span></div>}
      </SpotlightCard>
    </>
  );
}

function SliderCtl({ label, value, min, max, step, format, onChange }) {
  return (
    <div className="mf-ctrl">
      <div className="mf-label-row"><span>{label}</span><output>{format(value)}</output></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
    </div>
  );
}

/* ---------------- 氛围 ---------------- */
export function AtmosTab() {
  useEngine();
  return (
    <>
      <SpotlightCard className="mf-card" spotlightColor="rgba(98,168,255,.16)">
        <h4>环境与曝光</h4>
        <ParamSlider param="ambient" label="环境光" min={0} max={100} step={1} format={v => Math.round(v) + '%'} />
        <div className="mf-ctrl">
          <div className="mf-label-row"><span>环境光颜色</span></div>
          <input type="color" value={engine.params.ambientColor}
            onChange={e => engine.setParam('ambientColor', e.target.value)} />
        </div>
        <ParamSlider param="exposure" label="曝光" min={.2} max={2.5} step={.05} format={v => v.toFixed(2)} />
        <ParamSlider param="rim" label="边缘光" min={0} max={1} step={.05} format={v => v.toFixed(2)} />
      </SpotlightCard>
      <SpotlightCard className="mf-card" spotlightColor="rgba(98,168,255,.14)">
        <h4>风格</h4>
        <ParamSwitch param="cel" label="卡通阴影" />
        <ParamSwitch param="orbit" label="灯光环绕" />
        <MiniSwitch label="视角自动" checked={engine.params.auto}
          onToggle={() => engine.setParam('auto', !engine.params.auto)} />
        <div className="mf-ctrl" style={{ marginTop: 8 }}>
          <div className="mf-label-row"><span>光照混合</span></div>
          <SegButtons cols={2} value={engine.params.blend}
            onPick={(id) => engine.setParam('blend', id)}
            options={[{ id: 0, name: '原图混合' }, { id: 1, name: '纯光混合' }]} />
        </div>
        <button type="button" className="mf-btn" style={{ marginTop: 4 }}
          onClick={() => { engine.targetView = { x: 0, y: 0 }; engine.setParam('auto', false); engine.notify(); }}>
          回正视角
        </button>
      </SpotlightCard>
    </>
  );
}

/* ---------------- 视图 ---------------- */
export function ViewTab() {
  useEngine();
  return (
    <SpotlightCard className="mf-card" spotlightColor="rgba(182,239,194,.16)">
      <h4>视图模式</h4>
      <SegButtons cols={3} value={engine.params.viewMode}
        onPick={(id) => engine.setParam('viewMode', id)}
        options={VIEW_MODES.map(m => ({ id: m.id, name: m.name }))} />
      {engine.params.viewMode === 5 && (
        <div style={{ marginTop: 10 }}>
          <ParamSlider param="split" label="对比分割线" min={.04} max={.96} step={.01} format={v => Math.round(v * 100) + '%'} />
        </div>
      )}
      <div className="mf-label-row" style={{ marginTop: 10 }}>
        <span>深度：亮度 / AI / 画笔 · 法线：实时计算</span>
      </div>
    </SpotlightCard>
  );
}
