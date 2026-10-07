import React, { useEffect, useRef, useState } from 'react';
import GlareHover from '../bits/GlareHover/GlareHover';
import { LampIcon } from '../ui';
import { fetchImageElement } from '../../utils/imageFetch';

const MIN = 80;

/**
 * 图片探测层：phase=ready 时监听鼠标悬停，
 * 在符合条件的 <img> 右上角显示光影徽标，点击后抓图并打开编辑器。
 */
export function HoverLayer({ active, onPick, onError }) {
  const [badge, setBadge] = useState(null); // {x, y, el}
  const [loading, setLoading] = useState(false);
  const badgeRef = useRef(null);
  badgeRef.current = badge;

  useEffect(() => {
    if (!active) { setBadge(null); return; }

    const isCandidate = (el) => {
      if (!(el instanceof HTMLImageElement)) return false;
      const r = el.getBoundingClientRect();
      return r.width >= MIN && r.height >= MIN &&
        r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    };
    const place = (el) => {
      const r = el.getBoundingClientRect();
      setBadge({ x: Math.max(8, r.right - 40), y: Math.max(8, r.top + 8), el });
    };
    const onOver = (e) => {
      if (loading) return;
      const t = e.target;
      if (t && t.closest && t.closest('#moyufloat-shell')) return;
      const img = t && t.closest ? t.closest('img') : null;
      if (img && isCandidate(img)) {
        const cur = badgeRef.current;
        if (!cur || cur.el !== img) place(img);
      } else {
        setBadge(null);
      }
    };
    const hide = () => setBadge(null);

    document.addEventListener('mouseover', onOver, { passive: true });
    window.addEventListener('scroll', hide, { passive: true, capture: true });
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('mouseover', onOver);
      window.removeEventListener('scroll', hide, { capture: true });
      window.removeEventListener('resize', hide);
    };
  }, [active, loading]);

  const onBadgeClick = async (e) => {
    e.stopPropagation();
    const b = badgeRef.current;
    if (!b || loading) return;
    setLoading(true);
    try {
      const { img, name } = await fetchImageElement(b.el);
      setBadge(null);
      onPick(img, name);
    } catch (err) {
      onError(err && err.message ? err.message : '图片读取失败');
    } finally {
      setLoading(false);
    }
  };

  if (!active || !badge) return null;
  return (
    <div className="mf-hoverlayer">
      <button type="button"
        className={'mf-badge' + (loading ? ' loading' : '')}
        style={{ left: badge.x + 'px', top: badge.y + 'px' }}
        title="用摸鱼浮画编辑光影" aria-label="编辑图片光影"
        onClick={onBadgeClick}>
        <GlareHover width="32px" height="32px" borderRadius="50%" background="transparent" borderColor="transparent" glareSize={40}>
          <LampIcon />
        </GlareHover>
      </button>
    </div>
  );
}
