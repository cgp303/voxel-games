import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// Multi-page build: game (index.html), standalone Bezier path editor tool,
// and the group attack set tool.
export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: resolvePath('./index.html'),
                'bezier-editor': resolvePath('./bezier-editor.html'),
                'group-attack-set-tool': resolvePath('./group-attack-set-tool/index.html'),
            },
        },
    },
});
