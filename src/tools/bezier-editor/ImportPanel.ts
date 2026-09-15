// tools/bezier-editor/ImportPanel.ts

export interface ImportPanelCallbacks {
    onImport(text: string): void;
}

/** Paste segment code (optionally with a MultiSegmentPattern call) to replace the current path. */
export class ImportPanel {
    readonly root: HTMLDivElement;

    private readonly callbacks: ImportPanelCallbacks;

    private input!: HTMLTextAreaElement;
    private statusEl!: HTMLDivElement;

    constructor(callbacks: ImportPanelCallbacks) {
        this.callbacks = callbacks;
        this.root = document.createElement('div');
        this.root.className = 'editor-panel';
        this.build();
    }

    setStatus(text: string, isWarning = false): void {
        this.statusEl.textContent = text;
        this.statusEl.style.color = isWarning ? '#ffaa33' : '#7cff7c';
    }

    private build(): void {
        const heading = document.createElement('div');
        heading.className = 'editor-heading';
        heading.textContent = 'Import';
        this.root.appendChild(heading);

        this.input = document.createElement('textarea');
        this.input.className = 'editor-output';
        this.input.placeholder = 'Paste CubicBezierSegment / MultiSegmentPattern code here…';
        this.root.appendChild(this.input);

        const actionRow = document.createElement('div');
        actionRow.className = 'editor-toolbar';
        const parseBtn = document.createElement('button');
        parseBtn.textContent = 'Parse & Replace';
        parseBtn.addEventListener('click', () => this.callbacks.onImport(this.input.value));
        actionRow.appendChild(parseBtn);
        this.root.appendChild(actionRow);

        this.statusEl = document.createElement('div');
        this.statusEl.className = 'editor-role-label';
        this.statusEl.textContent = '';
        this.root.appendChild(this.statusEl);
    }
}
