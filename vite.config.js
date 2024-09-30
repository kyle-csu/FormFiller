/** @type {import('vite').UserConfig} */
import autoprefixer from 'autoprefixer';
import { visualizer } from 'rollup-plugin-visualizer';
import tailwindcss from 'tailwindcss';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [solidPlugin(), visualizer()],
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
});
