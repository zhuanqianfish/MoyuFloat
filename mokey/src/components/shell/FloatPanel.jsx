import React from 'react';
import SquishSwitch from '../bits/SquishSwitch/SquishSwitch';
import ShinyText from '../bits/ShinyText/ShinyText';
import ElectricBorder from '../bits/ElectricBorder/ElectricBorder';
import { LampIcon } from '../ui';

/**
 * 右上角可展开面板
 * phase: off | init | ready
 */
export function FloatPanel({ expanded, setExpanded, enabled, onToggle, phase, progress, status }) {
  return (
    <div className="mf-float">
      {!expanded ? (
        <button type="button" className={'mf-fab' + (enabled ? ' on' : '')}
          title="摸鱼浮画" aria-label="展开摸鱼浮画面板"
          onClick={() => setExpanded(true)}>
          <LampIcon />
        </button>
      ) : (
        <ElectricBorder color="#ff5a36" speed={0.6} chaos={0.08} borderRadius={14} style={{ width: 304 }}>
          <div className="mf-panel">
            <div className="mf-panel-head">
              <ShinyText text="摸鱼浮画" speed={3} />
              <button type="button" className="mf-collapse" aria-label="收起"
                onClick={() => setExpanded(false)}>—</button>
            </div>
            <div className="mf-switch-row">
              <div className="mf-switch-label">
                <strong>图片光影探测</strong>
                <span>{phase === 'ready' ? '悬停任意图片试试' : '开启后扫描页面图片'}</span>
              </div>
              <SquishSwitch checked={enabled} onChange={onToggle}
                trackColor="#2a2c27" trackOnColor="#b6efc2" width={64} height={32} />
            </div>
            <div className="mf-status" dangerouslySetInnerHTML={{ __html: status }} />
            {phase === 'init' && (
              <div className="mf-progress">
                <div className="mf-progress-track">
                  <div className="mf-progress-fill" style={{ width: progress.v + '%' }} />
                </div>
                <div className="mf-progress-row">
                  <span>{progress.label}</span><span>{progress.v}%</span>
                </div>
              </div>
            )}
            <div className="mf-panel-foot">2D 伪 3D · 深度视差 × 法线光照 · 页面图片无需上传</div>
          </div>
        </ElectricBorder>
      )}
    </div>
  );
}
