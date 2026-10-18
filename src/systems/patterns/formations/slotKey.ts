import { SLOT_KEY_STRIDE } from '../../../config/data/constants';
import type { SlotKey } from '../../../config/types/types';

/**
 * A formation slot (col, row) is identified by one integer: col * SLOT_KEY_STRIDE + row.
 * Integer keys hash and compare faster than "col,row" strings and need no string building or
 * parsing per lookup. Rows must stay below SLOT_KEY_STRIDE so every (col, row) pair is unique.
 * A row outside 0..SLOT_KEY_STRIDE-1 (e.g. -1) gives a key no real slot owns, so lookups simply miss.
 */
export function slotKey(col: number, row: number): SlotKey {
    return col * SLOT_KEY_STRIDE + row;
}

export function slotCol(key: SlotKey): number {
    return Math.floor(key / SLOT_KEY_STRIDE);
}

export function slotRow(key: SlotKey): number {
    return key % SLOT_KEY_STRIDE;
}

/** Converts a hand-authored "col,row" string (e.g. in GroupAttackSets) to a SlotKey. Use at load time, not per frame. */
export function slotKeyFromText(text: string): SlotKey {
    const [col, row] = text.split(',').map(Number);
    return slotKey(col, row);
}
