// tools/bezier-editor/ExportPanel.ts

import type { ExportMode } from './exportPath';

export interface ExportPanelCallbacks {
    onSettingsChange(): void;
}

/** Export mode toggle, anchor/side fields for relative mode, and generated code output. */
export class ExportPanel {
    readonly root: HTMLDivElement;

    private readonly callbacks: ExportPanelCallbacks;

    private modeRelative!: HTMLInputElement;
    private anchorXInput!: HTMLInputElement;
    private anchorZInput!: HTMLInputElement;
    private sideSelect!: HTMLSelectElement;
    private relativeFieldsWrap!: HTMLDivElement;
    private output!: HTMLTextAreaElement;

    constructor(callbacks: ExportPanelCallbacks) {
        this.callbacks = callbacks;
        this.root = document.createElement('div');
        this.root.className = 'editor-panel';
        this.build();
    }

    get mode(): ExportMode {
        return this.modeRelative.checked ? 'relative' : 'absolute';
    }

    get anchorX(): number {
        return parseFloat(this.anchorXInput.value) || 0;
    }

    get anchorZ(): number {
        return parseFloat(this.anchorZInput.value) || 0;
    }

    get side(): 1 | -1 {
        return this.sideSelect.value === '-1' ? -1 : 1;
    }

    setOutput(text: string): void {
        this.output.value = text;
    }

    private build(): void {
        const heading = document.createElement('div');
        heading.className = 'editor-heading';
        heading.textContent = 'Export';
        this.root.appendChild(heading);

        const modeRow = document.createElement('div');
        modeRow.className = 'editor-mode-row';

        const modeAbsolute = document.createElement('input');
        modeAbsolute.type = 'radio';
        modeAbsolute.name = 'export-mode';
        modeAbsolute.checked = true;
        modeAbsolute.addEventListener('change', () => this.onModeChange());
        const absLabel = document.createElement('label');
        absLabel.appendChild(modeAbsolute);
        absLabel.append(' Absolute');

        this.modeRelative = document.createElement('input');
        this.modeRelative.type = 'radio';
        this.modeRelative.name = 'export-mode';
        this.modeRelative.addEventListener('change', () => this.onModeChange());
        const relLabel = document.createElement('label');
        relLabel.appendChild(this.modeRelative);
        relLabel.append(' Relative (CFG-style)');

        modeRow.appendChild(absLabel);
        modeRow.appendChild(relLabel);
        this.root.appendChild(modeRow);

        this.relativeFieldsWrap = document.createElement('div');
        this.relativeFieldsWrap.className = 'editor-field-grid';
        this.relativeFieldsWrap.style.display = 'none';
        this.anchorXInput = this.numberField(this.relativeFieldsWrap, 'Anchor X', '0');
        this.anchorZInput = this.numberField(this.relativeFieldsWrap, 'Anchor Z', '0');

        this.sideSelect = document.createElement('select');
        for (const [value, label] of [
            ['1', '+1 (right)'],
            ['-1', '-1 (left)'],
        ]) {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            this.sideSelect.appendChild(opt);
        }
        this.sideSelect.addEventListener('change', () => this.callbacks.onSettingsChange());
        const sideWrap = document.createElement('label');
        sideWrap.className = 'editor-number-field';
        sideWrap.textContent = 'Side';
        sideWrap.appendChild(this.sideSelect);
        this.relativeFieldsWrap.appendChild(sideWrap);
        this.root.appendChild(this.relativeFieldsWrap);

        const actionRow = document.createElement('div');
        actionRow.className = 'editor-toolbar';
        const genBtn = document.createElement('button');
        genBtn.textContent = 'Generate';
        genBtn.addEventListener('click', () => this.callbacks.onSettingsChange());
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => void navigator.clipboard.writeText(this.output.value));
        actionRow.appendChild(genBtn);
        actionRow.appendChild(copyBtn);
        this.root.appendChild(actionRow);

        this.output = document.createElement('textarea');
        this.output.className = 'editor-output';
        this.output.readOnly = true;
        this.root.appendChild(this.output);
    }

    private onModeChange(): void {
        this.relativeFieldsWrap.style.display = this.mode === 'relative' ? 'grid' : 'none';
        this.callbacks.onSettingsChange();
    }

    private numberField(parent: HTMLElement, label: string, initial: string): HTMLInputElement {
        const wrap = document.createElement('label');
        wrap.className = 'editor-number-field';
        wrap.textContent = label;
        const input = document.createElement('input');
        input.type = 'number';
        input.value = initial;
        input.addEventListener('input', () => this.callbacks.onSettingsChange());
        wrap.appendChild(input);
        parent.appendChild(wrap);
        return input;
    }
}
