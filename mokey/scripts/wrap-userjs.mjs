/**
 * 把 Vite 产出的 IIFE bundle 包上油猴脚本头，生成 dist/moyu-float.user.js
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const header = `// ==UserScript==
// @name         摸鱼浮画 · 2D 伪 3D 光影
// @namespace    https://github.com/zhuanqianfish/MoyuFloat
// @version      ${pkg.version}
// @description  在任意网页悬停图片，一键进入 2D 伪 3D 光影编辑（深度视差 × 法线光照 × 多灯光）
// @author       zhuanqianfish
// @homepage     https://github.com/zhuanqianfish/MoyuFloat
// @match        *://*/*
// @noframes
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-idle
// @license      MIT
// ==/UserScript==
`;

const bundle = readFileSync(join(root, 'dist', 'moyu-float.bundle.js'), 'utf8');
writeFileSync(join(root, 'dist', 'moyu-float.user.js'), header + '\n' + bundle);
const kb = Math.round(Buffer.byteLength(header + bundle) / 1024);
console.log(`wrote dist/moyu-float.user.js (${kb} KB)`);
