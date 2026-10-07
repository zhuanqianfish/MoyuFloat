import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 油猴沙盒里没有 process，屏蔽相关引用
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    lib: {
      entry: 'src/main.jsx',
      formats: ['iife'],
      name: 'MoyuFloatMonkey',
      fileName: () => 'moyu-float.bundle.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
