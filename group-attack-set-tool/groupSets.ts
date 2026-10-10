import type { IFormationDescriptor } from '../src/config/interfaces/interfaces';
import type { MovementPath } from '../src/config/types/types';

export interface GroupSet {
    id: number;
    /** Slot keys ("col,row"), sorted row-then-col. */
    keys: string[];
    path: MovementPath;
}

export interface FormationSlot {
    key: string;
    col: number;
    row: number;
    /** World-space position from the builder. x also drives the path guess. */
    x: number;
    z: number;
}

export interface FormationModel {
    /** Sorted row-then-col. */
    slots: FormationSlot[];
    slotByKey: Map<string, FormationSlot>;
    colCount: number;
    rowCount: number;
    minX: number;
    maxX: number;
}

const LIST_NAME_PATTERN = /^[A-Za-z_$][\w$]*$/;

export function parseSlotKey(key: string): { col: number; row: number } {
    const [col, row] = key.split(',').map(Number);
    return { col, row };
}

export function sortSlotKeys(keys: Iterable<string>): string[] {
    return [...keys].sort((a, b) => {
        const pa = parseSlotKey(a);
        const pb = parseSlotKey(b);
        return pa.row - pb.row || pa.col - pb.col;
    });
}

export function createFormationModel(descriptor: IFormationDescriptor): FormationModel {
    const slots: FormationSlot[] = [];
    for (const [key, pos] of descriptor.map) {
        const { col, row } = parseSlotKey(key);
        slots.push({ key, col, row, x: pos.x, z: pos.z });
    }
    slots.sort((a, b) => a.row - b.row || a.col - b.col);

    const slotByKey = new Map<string, FormationSlot>(slots.map((s): [string, FormationSlot] => [s.key, s]));
    const xs = slots.map((s) => s.x);

    return {
        slots,
        slotByKey,
        colCount: slots.reduce((max, s) => Math.max(max, s.col + 1), 0),
        rowCount: slots.reduce((max, s) => Math.max(max, s.row + 1), 0),
        minX: xs.length > 0 ? Math.min(...xs) : 0,
        maxX: xs.length > 0 ? Math.max(...xs) : 0,
    };
}

/**
 * Guesses left/center/right from where the squares sit across the formation.
 * Uses the mean physical x rather than the column index, because the ring and
 * spiral builders index slots by angle, not by left-to-right position.
 */
export function guessPath(keys: string[], model: FormationModel): MovementPath {
    const xs = keys
        .map((key) => model.slotByKey.get(key)?.x)
        .filter((x): x is number => x !== undefined);
    const width = model.maxX - model.minX;
    if (xs.length === 0 || width <= 0) {
        return 'center';
    }

    const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length;
    const t = (meanX - model.minX) / width;
    if (t < 1 / 3) {
        return 'left';
    }
    if (t > 2 / 3) {
        return 'right';
    }
    return 'center';
}

export function isValidListName(name: string): boolean {
    return LIST_NAME_PATTERN.test(name);
}

export function formatGroupAttackSets(listName: string, sets: GroupSet[]): string {
    const lines = sets.map((set) => {
        const keys = set.keys.map((key) => `"${key}"`).join(', ');
        return `    { group: [${keys}], path: "${set.path}" },`;
    });
    return [`const ${listName}: IInvaderGroup[] = [`, ...lines, '];', ''].join('\n');
}
