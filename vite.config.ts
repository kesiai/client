import { defineConfig } from 'vite'
import { resolve } from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import dts from 'vite-plugin-dts'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react({ 
      jsxRuntime: 'classic' 
    }),
    dts({
      insertTypesEntry: true,
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts', 'src/**/*.spec.tsx'],
      rollupTypes: true,
      compilerOptions: {
        removeComments: true
      }
    }),
    // visualizer({
    //   filename: '.build_stats.html',
    //   title: 'Build Analysis',
    //   open: true,
    // })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'KesiClient',
      fileName: (format) => `kesi-client.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      output: {
        globals: {
          // 如果有外部依赖，在这里配置全局变量名
          'react': 'React',
          'react-dom': 'ReactDOM',
          'react-router': 'ReactRouter',
          'react-router-dom': 'ReactRouterDOM',
          'axios': 'axios'
        }
      },
      external: [
        // 在这里添加不希望打包进库的依赖
        // 例如: 'react', 'react-dom'
        'react', 'react-dom', 'react-router', 'react-router-dom',
        // axios 外置：让消费方与应用共享同一 axios 实例，
        // 以便应用层装配全局响应拦截器（如 401 登录态失效处理）
        'axios'
      ]
    },
    sourcemap: true,
    minify: 'esbuild'
  }
})
