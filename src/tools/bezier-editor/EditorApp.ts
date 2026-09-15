// tools/bezier-editor/EditorApp.ts

import type { Vector3 } from 'three';
import { EditorScene } from './EditorScene';
import { PathDocument } from './PathDocument';
import { PathRenderer } from './PathRenderer';
import { PointDragger } from './PointDragger';
import { SegmentPanel } from './SegmentPanel';
import { ExportPanel } from './ExportPanel';
import { ImportPanel } from './ImportPanel';
import { exportAbsolute, exportRelative, exportMultiSegmentSnippet } from './exportPath';
import { parseSegments } from './importPath';

export class EditorApp {
    private readonly scene: EditorScene;
    private readonly doc = new PathDocument();
    private readonly renderer: PathRenderer;
    private readonly dragger: PointDragger;
    private readonly segmentPanel: SegmentPanel;
    private readonly exportPanel: ExportPanel;
    private readonly importPanel: ImportPanel;
    private selectedPoint: number | null = null;

    constructor(container: HTMLElement, uiRoot: HTMLElement) {
        this.scene = new EditorScene(container);
        this.renderer = new PathRenderer(this.scene.scene);

        this.segmentPanel = new SegmentPanel({
            onNewPath: () =>
                this.withRefresh(() => {
                    this.doc.reset();
                    this.selectedPoint = null;
                }),
            onClearPath: () =>
                this.withRefresh(() => {
                    this.doc.clear();
                    this.selectedPoint = null;
                }),
            onAddSegment: () => this.withRefresh(() => this.doc.addSegment()),
            onRemoveLastSegment: () =>
                this.withRefresh(() => {
                    this.doc.removeLastSegment();
                    this.selectedPoint = null;
                }),
            onSelectSegment: (i) =>
                this.withRefresh(() => {
                    this.selectedPoint = i * 3;
                }),
            onPointFieldChange: (index, axis, value) =>
                this.withRefresh(() => {
                    this.doc.points[index][axis] = value;
                }),
        });

        this.exportPanel = new ExportPanel({
            onSettingsChange: () => this.refreshExport(),
        });

        this.importPanel = new ImportPanel({
            onImport: (text) => this.handleImport(text),
        });

        const layout = document.createElement('div');
        layout.className = 'editor-layout';
        layout.appendChild(this.segmentPanel.root);
        layout.appendChild(this.importPanel.root);
        layout.appendChild(this.exportPanel.root);
        uiRoot.appendChild(layout);

        this.dragger = new PointDragger(
            this.scene.domElement,
            this.scene.camera,
            () => this.renderer.handles,
            (index) =>
                this.withRefresh(() => {
                    this.selectedPoint = index;
                }),
            (index, position) =>
                this.withRefresh(() => {
                    this.doc.points[index].x = position.x;
                    this.doc.points[index].z = position.z;
                }),
        );

        this.refreshAll();
        this.loop();
    }

    dispose(): void {
        this.dragger.dispose();
        this.renderer.dispose();
        this.scene.dispose();
    }

    private withRefresh(mutate: () => void): void {
        mutate();
        this.refreshAll();
    }

    private handleImport(text: string): void {
        const parsed = parseSegments(text);
        if (parsed.points.length === 0) {
            this.importPanel.setStatus('No segments found in pasted text.', true);
            return;
        }

        this.doc.loadParsed(parsed);
        this.selectedPoint = null;
        this.refreshAll();

        const segCount = parsed.segmentWeights.length;
        const status = `Imported ${segCount} segment${segCount === 1 ? '' : 's'}.`;
        this.importPanel.setStatus(
            parsed.warnings.length > 0 ? `${status} ${parsed.warnings.join(' ')}` : status,
            parsed.warnings.length > 0,
        );
    }

    private refreshAll(): void {
        this.renderer.redraw(this.doc, this.selectedPoint);
        this.segmentPanel.refreshSegmentList(this.doc.segmentCount);
        const point: Vector3 | null = this.selectedPoint !== null ? this.doc.points[this.selectedPoint] : null;
        this.segmentPanel.setSelection(this.selectedPoint, point, this.describeRole(this.selectedPoint));
        this.refreshExport();
    }

    private describeRole(index: number | null): string {
        if (index === null) return '';
        if (index === 0) return 'Segment 1 · p0';
        const seg = Math.ceil(index / 3);
        const within = index - (seg - 1) * 3;
        const role = ['', 'p1', 'p2', 'p3'][within];
        if (within === 3 && seg < this.doc.segmentCount) {
            return `Segment ${seg} · p3  /  Segment ${seg + 1} · p0 (joint)`;
        }
        return `Segment ${seg} · ${role}`;
    }

    private refreshExport(): void {
        const mode = this.exportPanel.mode;
        const pathText =
            mode === 'absolute'
                ? exportAbsolute(this.doc)
                : exportRelative(this.doc, {
                    anchorX: this.exportPanel.anchorX,
                    anchorZ: this.exportPanel.anchorZ,
                    side: this.exportPanel.side,
                });
        const patternText = exportMultiSegmentSnippet(this.doc);
        this.exportPanel.setOutput(`${pathText}\n\n${patternText}`);
    }

    private loop = (): void => {
        requestAnimationFrame(this.loop);
        this.scene.render();
    };
}
