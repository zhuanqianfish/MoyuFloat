import React, { useEffect, useState } from 'react';
import ShinyText from '../bits/ShinyText/ShinyText';
import { engine } from '../../engine/moyuEngine';
import { useEngine } from '../useEngine';
import { Stage } from './Stage';
import { DepthTab, LightsTab, AtmosTab, ViewTab } from './tabs';

const TABS = [
  { id: 'depth', name: '深度' },
  { id: 'lights', name: '灯光' },
  { id: 'atmos', name: '氛围' },
  { id: 'view', name: '视图' },
];

/** 图片编辑器：图片载入后打开的整套 2D 伪 3D 工作台 */
export function EditorModal({ img, name, onClose }) {
  useEngine();
  const [tab, setTab] = useState('depth');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    engine.reset();
    engine.setImage(img, name);
    const onKey = (e) => {
      if (/input|select|textarea/i.test(e.target.tagName)) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'v' || e.key === 'V') engine.setTool('view');
      else if (e.key === 'l' || e.key === 'L') engine.setTool('light');
      else if (e.key === 'b' || e.key === 'B') engine.setTool('paint', 1);
      else if (e.key === 'Delete' && engine.lights[engine.selected]) engine.deleteLight(engine.selected);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [img]);

  const doExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await engine.exportPNG();
      if (!blob) { engine.setNotice('导出失败'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pseudo-3d-' + Date.now() + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      engine.setNotice('PNG 已导出');
    } finally { setExporting(false); }
  };

  return (
    <div className="mf-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mf-editor" role="dialog" aria-label="摸鱼浮画图片编辑器">
        <div className="mf-editor-head">
          <ShinyText text="摸鱼浮画" speed={3} />
          {engine.hasImage && (
            <span className="mf-res-chip">{engine.imageName} · {engine.sourceW}×{engine.sourceH}</span>
          )}
          {engine.notice && (
            <span className="mf-res-chip" style={{ borderColor: 'var(--mf-accent)' }}>{engine.notice}</span>
          )}
          <div className="mf-head-actions">
            <button type="button" className="mf-btn" style={{ width: 'auto' }}
              onClick={() => { engine.reset(); engine.generateDepthFromLuminance(); }}>重置</button>
            <button type="button" className="mf-btn primary" style={{ width: 'auto' }}
              disabled={exporting} onClick={doExport}>
              {exporting ? '导出中…' : '导出 PNG'}
            </button>
            <button type="button" className="mf-head-iconbtn" aria-label="关闭" onClick={onClose}>
              <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>
        <div className="mf-editor-body">
          <Stage />
          <aside className="mf-side">
            <div className="mf-tabs">
              {TABS.map(t => (
                <button key={t.id} type="button"
                  className={'mf-tab' + (tab === t.id ? ' active' : '')}
                  onClick={() => setTab(t.id)}>{t.name}</button>
              ))}
            </div>
            <div className="mf-tabpanels">
              {tab === 'depth' && <DepthTab />}
              {tab === 'lights' && <LightsTab />}
              {tab === 'atmos' && <AtmosTab />}
              {tab === 'view' && <ViewTab />}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
