import type { MovementPath } from '../src/config/types/types';
import { layoutBoard } from './boardLayout';
import { FORMATION_KINDS, MAX_FIELD_VALUE, parseFieldValue } from './formationKinds';
import type { FieldValues, FormationKind } from './formationKinds';
import {
    createFormationModel,
    formatGroupAttackSets,
    guessPath,
    isValidListName,
    sortSlotKeys,
} from './groupSets';
import type { FormationModel, GroupSet } from './groupSets';

const PATHS: MovementPath[] = ['left', 'center', 'right'];

interface SlotView {
    button: HTMLButtonElement;
    badge: HTMLSpanElement;
}

function requireElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Missing element #${id}`);
    }
    return element as T;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (className) {
        element.className = className;
    }
    if (text !== undefined) {
        element.textContent = text;
    }
    return element;
}

export class GroupSetApp {
    private readonly formationSelect = requireElement<HTMLSelectElement>('formation-kind');
    private readonly fieldInputs = requireElement<HTMLDivElement>('field-inputs');
    private readonly formationError = requireElement<HTMLParagraphElement>('formation-error');
    private readonly newFormationButton = requireElement<HTMLButtonElement>('new-formation-button');
    private readonly listNameInput = requireElement<HTMLInputElement>('list-name');
    private readonly selectionInfo = requireElement<HTMLParagraphElement>('selection-info');
    private readonly addSetButton = requireElement<HTMLButtonElement>('add-set-button');
    private readonly deleteSetButton = requireElement<HTMLButtonElement>('delete-set-button');
    private readonly status = requireElement<HTMLParagraphElement>('status');
    private readonly grid = requireElement<HTMLDivElement>('formation-grid');
    private readonly gridWrap = requireElement<HTMLDivElement>('grid-wrap');
    private readonly setList = requireElement<HTMLUListElement>('set-list');
    private readonly exportButton = requireElement<HTMLButtonElement>('export-button');
    private readonly copyButton = requireElement<HTMLButtonElement>('copy-button');
    private readonly exportMessage = requireElement<HTMLParagraphElement>('export-message');
    private readonly exportOutput = requireElement<HTMLTextAreaElement>('export-output');

    private kind: FormationKind = FORMATION_KINDS[0];
    private fieldElements = new Map<string, HTMLInputElement>();
    private formation: FormationModel | null = null;
    private slotViews = new Map<string, SlotView>();
    private sets: GroupSet[] = [];
    private nextSetId = 1;
    private activeSetId: number | null = null;
    private pending = new Set<string>();
    private exportVisible = false;

    constructor() {
        for (const kind of FORMATION_KINDS) {
            this.formationSelect.append(new Option(kind.label, kind.id));
        }
        this.formationSelect.addEventListener('change', () => this.onKindChanged());
        this.newFormationButton.addEventListener('click', () => this.onNewFormation());
        this.addSetButton.addEventListener('click', () => this.addSet());
        this.deleteSetButton.addEventListener('click', () => this.deleteActiveSet());
        this.listNameInput.addEventListener('input', () => this.renderExport());
        this.exportButton.addEventListener('click', () => {
            this.exportVisible = true;
            this.renderExport();
        });
        this.copyButton.addEventListener('click', () => void this.copyExport());

        this.buildFieldInputs();
        this.onNewFormation();
        window.addEventListener('resize', () => this.onWindowResize());
    }

    private onKindChanged(): void {
        this.kind = FORMATION_KINDS.find((k) => k.id === this.formationSelect.value) ?? FORMATION_KINDS[0];
        this.buildFieldInputs();
    }

    private buildFieldInputs(): void {
        this.fieldInputs.replaceChildren();
        this.fieldElements.clear();
        for (const field of this.kind.fields) {
            const label = createElement('label', 'field');
            const input = createElement('input');
            input.type = 'number';
            input.min = '1';
            input.max = String(MAX_FIELD_VALUE);
            input.step = '1';
            input.value = String(field.defaultValue);
            input.disabled = field.locked === true;
            this.fieldElements.set(field.key, input);
            label.append(createElement('span', 'field-label', field.label), input);
            this.fieldInputs.append(label);
        }
    }

    private readFieldValues(): FieldValues | null {
        const values: FieldValues = {};
        for (const field of this.kind.fields) {
            if (field.locked) {
                values[field.key] = field.defaultValue;
                continue;
            }
            const value = parseFieldValue(this.fieldElements.get(field.key)?.value ?? '');
            if (value === null) {
                this.formationError.textContent =
                    `${field.label} must be a whole number from 1 to ${MAX_FIELD_VALUE}.`;
                return null;
            }
            values[field.key] = value;
        }
        this.formationError.textContent = '';
        return values;
    }

    private onNewFormation(): void {
        const values = this.readFieldValues();
        if (!values) {
            return;
        }
        const hasWork = this.sets.length > 0 || this.pending.size > 0;
        if (hasWork && !window.confirm('Start a new formation? The current sets and selection will be discarded.')) {
            return;
        }

        this.formation = createFormationModel(this.kind.build(values));
        this.sets = [];
        this.nextSetId = 1;
        this.activeSetId = null;
        this.pending.clear();
        this.exportVisible = false;
        this.listNameInput.value = this.kind.defaultListName;
        this.status.textContent = '';
        this.buildGrid(this.formation);
        this.render();
    }

    private buildGrid(model: FormationModel): void {
        this.grid.replaceChildren();
        this.slotViews.clear();

        for (const slot of model.slots) {
            const button = createElement('button', 'slot');
            button.type = 'button';
            button.dataset.key = slot.key;
            const badge = createElement('span', 'slot-badge');
            button.append(createElement('span', 'slot-key', slot.key), badge);
            button.addEventListener('click', () => this.onSlotClick(slot.key));
            this.slotViews.set(slot.key, { button, badge });
            this.grid.append(button);
        }
        this.applyLayout(model);
    }

    /** Positions squares at their builder x/z so the shape reads as the formation. */
    private applyLayout(model: FormationModel): void {
        const wrapStyle = getComputedStyle(this.gridWrap);
        const availableWidth = this.gridWrap.clientWidth - parseFloat(wrapStyle.paddingLeft) - parseFloat(wrapStyle.paddingRight);
        const availableHeight = this.gridWrap.clientHeight - parseFloat(wrapStyle.paddingTop) - parseFloat(wrapStyle.paddingBottom);
        const layout = layoutBoard(
            model.slots.map((slot) => ({ key: slot.key, x: slot.x, z: slot.z })),
            availableWidth,
            availableHeight,
        );

        this.grid.style.width = `${layout.width}px`;
        this.grid.style.height = `${layout.height}px`;
        for (const [key, view] of this.slotViews) {
            const box = layout.boxes.get(key);
            if (!box) {
                continue;
            }
            const style = view.button.style;
            style.left = `${box.left}px`;
            style.top = `${box.top}px`;
            style.width = `${box.size}px`;
            style.height = `${box.size}px`;
            style.fontSize = `${box.fontSize}px`;
        }
    }

    private onWindowResize(): void {
        if (this.formation) {
            this.applyLayout(this.formation);
        }
    }

    private onSlotClick(key: string): void {
        if (this.pending.has(key)) {
            this.pending.delete(key);
        } else {
            this.pending.add(key);
        }
        this.render();
    }

    private takenBy(): Map<string, GroupSet> {
        const map = new Map<string, GroupSet>();
        for (const set of this.sets) {
            for (const key of set.keys) {
                map.set(key, set);
            }
        }
        return map;
    }

    private addSet(): void {
        if (!this.formation || this.pending.size === 0) {
            return;
        }
        const keys = sortSlotKeys(this.pending);
        const set: GroupSet = {
            id: this.nextSetId++,
            keys,
            path: guessPath(keys, this.formation),
        };
        this.sets.push(set);
        this.pending.clear();
        this.activeSetId = set.id;
        this.status.textContent = `Added set ${set.id} (guessed path: ${set.path}).`;
        this.render();
    }

    private deleteActiveSet(): void {
        if (this.activeSetId === null) {
            return;
        }
        const deletedId = this.activeSetId;
        this.sets = this.sets.filter((set) => set.id !== deletedId);
        this.activeSetId = null;
        this.status.textContent = `Deleted set ${deletedId}. Its squares are selectable again.`;
        this.render();
    }

    private render(): void {
        this.refreshGrid();
        this.renderSetList();
        this.renderControls();
        this.renderExport();
    }

    private refreshGrid(): void {
        const takenBy = this.takenBy();
        for (const [key, view] of this.slotViews) {
            const set = takenBy.get(key);
            const classes = ['slot'];
            let title = `Slot ${key}`;

            if (set) {
                classes.push('slot--taken', `slot--${set.path}`);
                if (set.id === this.activeSetId) {
                    classes.push('slot--active');
                }
                title = `In set ${set.id} (${set.path})`;
            } else if (this.pending.has(key)) {
                classes.push('slot--pending');
                title = `Selected: ${key}`;
            } else {
                classes.push('slot--free');
            }

            view.button.className = classes.join(' ');
            view.button.disabled = set !== undefined;
            view.button.title = title;
            view.badge.textContent = set ? String(set.id) : '';
        }
    }

    private renderSetList(): void {
        this.setList.replaceChildren();
        if (this.sets.length === 0) {
            this.setList.append(createElement('li', 'set-empty', 'No sets yet.'));
            return;
        }

        for (const set of this.sets) {
            const item = createElement('li', `set-item set-item--${set.path}`);
            item.classList.toggle('set-item--active', set.id === this.activeSetId);
            item.addEventListener('click', () => {
                this.activeSetId = set.id;
                this.render();
            });

            const select = createElement('select', 'set-path');
            for (const path of PATHS) {
                select.append(new Option(path, path));
            }
            select.value = set.path;
            // Keep the row click from firing, which would re-render and close the dropdown.
            select.addEventListener('click', (event) => event.stopPropagation());
            select.addEventListener('change', () => {
                set.path = select.value as MovementPath;
                this.render();
            });

            const header = createElement('div', 'set-header');
            header.append(
                createElement('span', 'set-title', `Set ${set.id}`),
                createElement('span', 'set-count', `${set.keys.length} squares`),
                select,
            );
            item.append(header, createElement('div', 'set-keys', set.keys.join(' ')));
            this.setList.append(item);
        }
    }

    private renderControls(): void {
        const total = this.formation?.slots.length ?? 0;
        const inSets = this.takenBy().size;
        this.selectionInfo.textContent =
            `${this.pending.size} selected · ${inSets} of ${total} squares in sets`;
        this.addSetButton.disabled = this.pending.size === 0;
        this.deleteSetButton.disabled = this.activeSetId === null;
    }

    private renderExport(): void {
        const name = this.listNameInput.value.trim();

        if (!this.exportVisible) {
            this.setExport('', 'Press Export to generate the code.');
        } else if (!isValidListName(name)) {
            this.setExport('', 'The id must be a valid name: letters, digits, _ or $, not starting with a digit.');
        } else if (this.sets.length === 0) {
            this.setExport('', 'Add at least one set before exporting.');
        } else {
            this.setExport(
                formatGroupAttackSets(name, this.sets),
                `${this.sets.length} set(s) ready. Paste over the matching list in GroupAttackSets.ts.`,
            );
        }
    }

    private setExport(text: string, message: string): void {
        this.exportOutput.value = text;
        this.exportMessage.textContent = message;
        this.copyButton.disabled = text === '';
    }

    private async copyExport(): Promise<void> {
        const text = this.exportOutput.value;
        if (!text) {
            return;
        }
        try {
            await navigator.clipboard.writeText(text);
            this.exportMessage.textContent = 'Copied to clipboard.';
        } catch {
            this.exportOutput.select();
            this.exportMessage.textContent = 'Clipboard unavailable. The text is selected; press Ctrl+C.';
        }
    }
}
