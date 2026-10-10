import type { IFormationDescriptor } from '../src/config/interfaces/interfaces';
import {
    makeCircleFormation,
    makeDiamondFormation,
    makeGridFormation,
    makeSpiralFormation,
    makeStaggeredFormation,
    makeThreeRingCircleFormation,
    makeVFormation,
    makeXFormation,
} from '../src/systems/patterns/formations/formationBuilders';

/** Matches the spacing the game passes to its grid-style builders. */
const GRID_SPACING = 12;

// Ring and spiral geometry is chosen here for the tool only. It affects the
// left/center/right guess, not the game, which does not use these builders.
const CIRCLE_RADIUS = 50;
const SPIRAL_RADIUS_STEP = 4;
const SPIRAL_ANGLE_STEP = 0.5;
const RING_RADII = { inner: 20, middle: 35, outer: 50 } as const;

export const MAX_FIELD_VALUE = 100;

export type FieldValues = Record<string, number>;

export interface FormationField {
    key: string;
    label: string;
    defaultValue: number;
    /** Shown for information only; the builder ignores the input. */
    locked?: boolean;
}

export interface FormationKind {
    id: string;
    label: string;
    defaultListName: string;
    fields: FormationField[];
    build: (values: FieldValues) => IFormationDescriptor;
}

const gridFields = (cols: number, rows: number): FormationField[] => [
    { key: 'cols', label: 'Cols', defaultValue: cols },
    { key: 'rows', label: 'Rows', defaultValue: rows },
];

const singleRingFields = (slots: number): FormationField[] => [
    { key: 'slots', label: 'Slots', defaultValue: slots },
    { key: 'rows', label: 'Rows', defaultValue: 1, locked: true },
];

export const FORMATION_KINDS: FormationKind[] = [
    {
        id: 'grid',
        label: 'Grid',
        defaultListName: 'groupGrid',
        fields: gridFields(10, 6),
        build: (v) => makeGridFormation(v.cols, v.rows, GRID_SPACING),
    },
    {
        id: 'x',
        label: 'X',
        defaultListName: 'groupX',
        fields: gridFields(10, 6),
        build: (v) => makeXFormation(v.cols, v.rows, GRID_SPACING),
    },
    {
        id: 'v',
        label: 'V',
        defaultListName: 'groupV',
        fields: gridFields(10, 6),
        build: (v) => makeVFormation(v.cols, v.rows, GRID_SPACING),
    },
    {
        id: 'diamond',
        label: 'Diamond',
        defaultListName: 'groupDiamond',
        fields: gridFields(10, 6),
        build: (v) => makeDiamondFormation(v.cols, v.rows, GRID_SPACING),
    },
    {
        id: 'staggered',
        label: 'Staggered',
        defaultListName: 'groupStaggered',
        fields: gridFields(10, 6),
        build: (v) => makeStaggeredFormation(v.cols, v.rows, GRID_SPACING),
    },
    {
        id: 'circle',
        label: 'Circle',
        defaultListName: 'groupCircle',
        fields: singleRingFields(60),
        build: (v) => makeCircleFormation(v.slots, CIRCLE_RADIUS),
    },
    {
        id: 'spiral',
        label: 'Spiral',
        defaultListName: 'groupSpiral',
        fields: singleRingFields(30),
        build: (v) => makeSpiralFormation(v.slots, SPIRAL_RADIUS_STEP, SPIRAL_ANGLE_STEP),
    },
    {
        id: 'threeRingCircle',
        label: 'Three ring circle',
        defaultListName: 'groupThreeRingCircle',
        fields: [
            { key: 'inner', label: 'Inner ring slots', defaultValue: 6 },
            { key: 'middle', label: 'Middle ring slots', defaultValue: 12 },
            { key: 'outer', label: 'Outer ring slots', defaultValue: 18 },
        ],
        build: (v) => makeThreeRingCircleFormation(
            v.inner,
            v.middle,
            v.outer,
            RING_RADII.inner,
            RING_RADII.middle,
            RING_RADII.outer,
        ),
    },
];

/** Returns the whole number in 1..MAX_FIELD_VALUE, or null if the text is not one. */
export function parseFieldValue(raw: string): number | null {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
        return null;
    }
    const value = Number(trimmed);
    return value >= 1 && value <= MAX_FIELD_VALUE ? value : null;
}
