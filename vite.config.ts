import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// Multi-page build: game (index.html) + standalone Bezier path editor tool.
export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolvePath('./index.html'),
                'bezier-editor': resolvePath('./bezier-editor.html'),
            },
        },
    },
});
