// tools/bezier-editor/main.ts

import './editor.css';
import { EditorApp } from './EditorApp';

const container = document.getElementById('editor-container');
const uiRoot = document.getElementById('editor-ui');
if (!container || !uiRoot) {
    throw new Error('bezier-editor: missing #editor-container or #editor-ui element');
}

new EditorApp(container, uiRoot);
