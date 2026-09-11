// tools/bezier-editor/SegmentPanel.ts

import type { Vector3 } from 'three';

export interface SegmentPanelCallbacks {
    onNewPath(): void;
    onClearPath(): void;
    onAddSegment(): void;
    onRemoveLastSegment(): void;
    onSelectSegment(index: number): void;
    onPointFieldChange(index: number, axis: 'x' | 'y' | 'z', value: number): void;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

/** Toolbar + segment list + selected-point inspector. */
export class SegmentPanel {
    readonly root: HTMLDivElement;

    private segmentListEl!: HTMLDivElement;
    private roleLabel!: HTMLDivElement;
    private xInput!: HTMLInputElement;
    private yInput!: HTMLInputElement;
    private zInput!: HTMLInputElement;
    private selectedIndex: number | null = null;

    constructor(private readonly callbacks: SegmentPanelCallbacks) {
        this.root = document.createElement('div');
        this.root.className = 'editor-panel';
        this.build();
    }

    refreshSegmentList(segmentCount: number): void {
        this.segmentListEl.innerHTML = '';
        for (let i = 0; i < segmentCount; i++) {
            const btn = document.createElement('button');
            btn.className = 'editor-segment-btn';
            btn.textContent = `Segment ${i + 1}`;
            btn.addEventListener('click', () => this.callbacks.onSelectSegment(i));
            this.segmentListEl.appendChild(btn);
        }
    }

    setSelection(index: number | null, point: Vector3 | null, roleText: string): void {
        this.selectedIndex = index;
        this.roleLabel.textContent = point ? roleText : 'None selected';
        this.xInput.value = point ? String(round2(point.x)) : '';
        this.yInput.value = point ? String(round2(point.y)) : '';
        this.zInput.value = point ? String(round2(point.z)) : '';
        this.xInput.disabled = !point;
        this.yInput.disabled = !point;
        this.zInput.disabled = !point;
    }

    private build(): void {
        const toolbar = document.createElement('div');
        toolbar.className = 'editor-toolbar';
        toolbar.appendChild(this.button('New Path', () => this.callbacks.onNewPath()));
        toolbar.appendChild(this.button('Clear Path', () => this.callbacks.onClearPath()));
        toolbar.appendChild(this.button('Add Segment', () => this.callbacks.onAddSegment()));
        toolbar.appendChild(this.button('Remove Last', () => this.callbacks.onRemoveLastSegment()));
        this.root.appendChild(toolbar);

        this.root.appendChild(this.heading('Segments'));
        this.segmentListEl = document.createElement('div');
        this.segmentListEl.className = 'editor-segment-list';
        this.root.appendChild(this.segmentListEl);

        this.root.appendChild(this.heading('Selected Point'));
        this.roleLabel = document.createElement('div');
        this.roleLabel.className = 'editor-role-label';
        this.roleLabel.textContent = 'None selected';
        this.root.appendChild(this.roleLabel);

        const grid = document.createElement('div');
        grid.className = 'editor-field-grid';
        this.xInput = this.numberField(grid, 'X', 'x');
        this.yInput = this.numberField(grid, 'Y', 'y');
        this.zInput = this.numberField(grid, 'Z', 'z');
        this.root.appendChild(grid);
    }

    private heading(text: string): HTMLDivElement {
        const el = document.createElement('div');
        el.className = 'editor-heading';
        el.textContent = text;
        return el;
    }

    private button(label: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.addEventListener('click', onClick);
        return btn;
    }

    private numberField(parent: HTMLElement, label: string, axis: 'x' | 'y' | 'z'): HTMLInputElement {
        const wrap = document.createElement('label');
        wrap.className = 'editor-number-field';
        wrap.textContent = label;
        const input = document.createElement('input');
        input.type = 'number';
        input.disabled = true;
        input.addEventListener('input', () => {
            if (this.selectedIndex === null) return;
            this.callbacks.onPointFieldChange(this.selectedIndex, axis, parseFloat(input.value) || 0);
        });
        wrap.appendChild(input);
        parent.appendChild(wrap);
        return input;
    }
}
