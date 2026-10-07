import React from 'react';
import { engine } from '../engine/moyuEngine';
import { useEngine } from './useEngine';

/** 台灯/光影图标 */
export function LampIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.2 5.2l1.8 1.8M17 17l1.8 1.8M18.8 5.2L17 7M7 17l-1.8 1.8" />
    </svg>
  );
}

export function Slider({ label, value, min, max, step, format, onChange }) {
  return (
    <div className="mf-ctrl">
      <div className="mf-label-row"><span>{label}</span><output>{format ? format(value) : value}</output></div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)} />
    </div>
  );
}

export function SegButtons({ options, value, onPick, cols = 3 }) {
  return (
    <div className={`mf-seg cols${cols}`}>
      {options.map(o => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onPick(o.id)}>
          {o.name}
        </button>
      ))}
    </div>
  );
}

export function MiniSwitch({ label, checked, onToggle }) {
  return (
    <div className="mf-check">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked}
        className={'mf-mini-switch' + (checked ? ' on' : '')}
        onClick={onToggle} />
    </div>
  );
}

/** 绑定引擎参数的滑杆 */
export function ParamSlider({ param, label, min, max, step, format }) {
  useEngine();
  const v = engine.params[param];
  return <Slider label={label} value={v} min={min} max={max} step={step} format={format}
    onChange={nv => engine.setParam(param, nv)} />;
}

/** 绑定引擎布尔参数的开关 */
export function ParamSwitch({ param, label }) {
  useEngine();
  const v = engine.params[param];
  return <MiniSwitch label={label} checked={!!v} onToggle={() => engine.setParam(param, !v)} />;
}
