import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    main: {
        build: {
            lib: {
                entry: 'electron/main.ts'
            }
        },
        plugins: [externalizeDepsPlugin()]
    },
    preload: {
        build: {
            lib: {
                entry: 'electron/preload.ts'
            }
        },
        plugins: [externalizeDepsPlugin()]
    },
    renderer: {
        root: 'src',
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/index.html')
                }
            }
        },
        resolve: {
            alias: {
                '@renderer': resolve('src')
            }
        },
        plugins: [react()]
    }
})
