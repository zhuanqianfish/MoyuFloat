import React, { useCallback, useEffect, useRef, useState } from 'react';
import ClickSpark from '../bits/ClickSpark/ClickSpark';
import { FloatPanel } from './FloatPanel';
import { HoverLayer } from './HoverLayer';
import { EditorModal } from '../editor/EditorModal';
import { engine } from '../../engine/moyuEngine';

const tick = (ms) => new Promise(r => setTimeout(r, ms));

export function Shell() {
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);       // 总开关（默认关闭）
  const [phase, setPhase] = useState('off');           // off | init | ready
  const [progress, setProgress] = useState({ v: 0, label: '' });
  const [imgCount, setImgCount] = useState(0);
  const [editing, setEditing] = useState(null);        // {img, name}
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(0);
  const warmCanvas = useRef(null);

  const showNotice = useCallback((msg) => {
    setNotice(msg);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2200);
  }, []);

  const initSequence = useCallback(async () => {
    setPhase('init');
    try {
      setProgress({ v: 6, label: '注入界面样式' });
      await tick(250);
      setProgress({ v: 38, label: '初始化 WebGL 引擎' });
      // 预热：编译 shader，确认 WebGL 可用
      if (!warmCanvas.current) warmCanvas.current = document.createElement('canvas');
      engine.attach(warmCanvas.current);
      engine.stop(); // 预热后暂停，等编辑器打开再跑
      await tick(200);
      setProgress({ v: 72, label: '扫描页面图片' });
      const imgs = [...document.images].filter(im => {
        const r = im.getBoundingClientRect();
        return r.width >= 80 && r.height >= 80;
      });
      setImgCount(imgs.length);
      await tick(250);
      setProgress({ v: 100, label: '就绪' });
      await tick(300);
      setPhase('ready');
    } catch (err) {
      setPhase('off');
      setEnabled(false);
      showNotice('初始化失败：' + (err && err.message ? err.message : '未知错误'));
    }
  }, [showNotice]);

  const teardown = useCallback(() => {
    setPhase('off');
    setEditing(null);
    setImgCount(0);
    engine.stop();
  }, []);

  const onToggle = useCallback((next) => {
    setEnabled(next);
    if (next) initSequence();
    else teardown();
  }, [initSequence, teardown]);

  const onPick = useCallback((img, name) => {
    setEditing({ img, name });
  }, []);

  const status = phase === 'ready'
    ? `已就绪 · 发现 <b>${imgCount}</b> 张图片`
    : phase === 'init' ? '正在初始化…' : '开关默认关闭';

  return (
    <div className="mf-root">
      <ClickSpark sparkColor="#ffb03a" sparkSize={9} sparkRadius={16}>
        <FloatPanel
          expanded={expanded} setExpanded={setExpanded}
          enabled={enabled} onToggle={onToggle}
          phase={phase} progress={progress} status={status} />
        <HoverLayer active={phase === 'ready' && !editing} onPick={onPick} onError={showNotice} />
        {editing && (
          <EditorModal
            img={editing.img} name={editing.name}
            onClose={() => setEditing(null)} />
        )}
        {notice && <div className="mf-notice">{notice}</div>}
      </ClickSpark>
    </div>
  );
}
