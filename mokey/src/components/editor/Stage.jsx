import React, { useEffect, useRef } from 'react';
import Dock from '../bits/Dock/Dock';
import { engine, VIEW_MODES } from '../../engine/moyuEngine';
import { useEngine } from '../useEngine';
import { LampIcon } from '../ui';

const ViewIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" /><circle cx="12" cy="12" r="2.6" />
  </svg>
);
const PaintIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 20c2.5 0 4-1.2 4.8-2.6L19 7.2a2.1 2.1 0 0 0-3-3L5.8 14.4C4.6 15.4 4 17 4 20Z" /><path d="M13.5 6.5l3 3" />
  </svg>
);

/** 舞台：WebGL 画布 + 灯光 gizmo + 模式 Dock + HUD */
export function Stage() {
  useEngine();
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const drag = useRef(false);
  const last = useRef(null);
  const blankClickAt = useRef(0);
  const splitDrag = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    engine.attach(canvas);
    const onResize = () => engine.resize();
    window.addEventListener('resize', onResize);
    // wheel 需要非 passive 才能 preventDefault
    const onWheel = (e) => {
      if (engine.toolMode !== 'light' || !engine.lights[engine.selected]) return;
      e.preventDefault();
      const l = engine.lights[engine.selected];
      engine.updateLight(engine.selected, { z: Math.max(0, Math.min(1, l.z - e.deltaY * .001)) });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('wheel', onWheel);
      engine.stop();
    };
  }, []);

  const toolTip = engine.toolMode === 'view' ? '拖动改变视角'
    : engine.toolMode === 'light' ? '拖动移动灯光 · 滚轮调高度 · 双击添加灯光'
    : '按住拖动绘制深度（Dock 切换涂近/涂远）';

  const onPointerDown = (e) => {
    const canvas = canvasRef.current;
    canvas.setPointerCapture(e.pointerId);
    drag.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    const r = canvas.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    if (engine.toolMode === 'paint') {
      engine.paintDepth(fx, fy, engine.params.brushSize, engine.paintMode);
    } else if (engine.toolMode === 'light') {
      const hit = engine.hitLight(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
      if (hit >= 0) { engine.selected = hit; engine.notify(); }
      else blankClickAt.current = performance.now();
      engine.moveSelectedLight(fx, fy);
    } else {
      canvas.classList.add('dragging');
    }
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const canvas = canvasRef.current;
    const r = canvas.getBoundingClientRect();
    if (engine.toolMode === 'paint') {
      engine.paintDepth((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, engine.params.brushSize, engine.paintMode);
      return;
    }
    if (engine.toolMode === 'light') {
      engine.moveSelectedLight((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      return;
    }
    engine.setParam('auto', false);
    const dx = (e.clientX - last.current.x) / r.width * 2;
    const dy = (e.clientY - last.current.y) / r.height * 2;
    engine.targetView.x = Math.max(-1, Math.min(1, engine.targetView.x + dx));
    engine.targetView.y = Math.max(-1, Math.min(1, engine.targetView.y - dy));
    last.current = { x: e.clientX, y: e.clientY };
  };
  const endDrag = () => {
    drag.current = false;
    canvasRef.current.classList.remove('dragging');
  };
  const onDoubleClick = (e) => {
    if (engine.toolMode !== 'light' || performance.now() - blankClickAt.current > 650) return;
    const r = canvasRef.current.getBoundingClientRect();
    engine.addLight(
      Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)));
    blankClickAt.current = 0;
  };

  const setSplitFromClient = (clientX) => {
    const r = wrapRef.current.getBoundingClientRect();
    engine.setParam('split', Math.max(.04, Math.min(.96, (clientX - r.left) / r.width)));
  };

  const dockItems = [
    { icon: <ViewIcon />, label: '视角', className: engine.toolMode === 'view' ? 'mf-tool-active' : '', onClick: () => engine.setTool('view') },
    { icon: <LampIcon />, label: '灯光', className: engine.toolMode === 'light' ? 'mf-tool-active' : '', onClick: () => engine.setTool('light') },
    { icon: <PaintIcon />, label: '绘制', className: engine.toolMode === 'paint' ? 'mf-tool-active' : '', onClick: () => engine.setTool('paint', 1) },
  ];

  const vm = VIEW_MODES.find(m => m.id === engine.params.viewMode);

  return (
    <div className="mf-stage">
      <div ref={wrapRef} className="mf-canvas-wrap"
        style={engine.sourceW ? { aspectRatio: engine.sourceW + ' / ' + engine.sourceH } : undefined}>
        <canvas ref={canvasRef} className={
          'gl' + (engine.toolMode === 'paint' ? ' painting' : '') + (engine.toolMode === 'light' ? ' light-moving' : '')
        }
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={endDrag} onPointerCancel={endDrag} onDoubleClick={onDoubleClick} />
        <div className="mf-gizmos">
          {engine.lights.map((l, i) => (
            <button key={i} type="button" className={'mf-gizmo' + (i === engine.selected ? ' sel' : '')}
              style={{ left: (l.x * 100) + '%', top: (l.y * 100) + '%', ['--mk']: l.color }}
              title={l.name}
              onClick={(e) => { e.stopPropagation(); engine.selected = i; engine.notify(); }}>
              {i + 1}
            </button>
          ))}
        </div>
        {engine.params.viewMode === 5 && (
          <div className="mf-compare" style={{ left: (engine.params.split * 100) + '%' }}
            onPointerDown={(e) => { e.stopPropagation(); splitDrag.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (splitDrag.current) setSplitFromClient(e.clientX); }}
            onPointerUp={() => splitDrag.current = false} />
        )}
        <div className="mf-hud">
          <span className="mf-hud-chip">{vm ? vm.name : ''}</span>
          <span className="mf-hud-chip">{engine.lights.length} 灯</span>
        </div>
        <div className="mf-tip">{toolTip}</div>
      </div>
      <div className="mf-dockrow">
        <Dock items={dockItems} panelHeight={60} baseItemSize={44} magnification={60} distance={160} />
      </div>
    </div>
  );
}
