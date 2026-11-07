import type { IParsedVoxModel, ITerrainStyle, ITerrainStyleDef } from '../../config/interfaces/interfaces.ts';
import type { TerrainStyleId } from '../../config/types/types.ts';
import type { ChunkLibrary } from './ChunkLibrary.ts';
import { buildHandAuthoredStyle } from './HandAuthoredStyle.ts';
import { buildProceduralStyle } from './ProceduralStyleBuilder.ts';

/**
 * The terrain styles a game can show, by id. Each is built once, the first time it is asked for, into the shared
 * `library`: a style only stores chunk ids, so every style on screen has to come from the same library. Asking
 * again returns the same style object, so switching back and forth never adds chunks twice.
 */
export class TerrainStyleRegistry {
    private readonly library: ChunkLibrary;
    private readonly defs: Readonly<Record<TerrainStyleId, ITerrainStyleDef>>;
    private readonly getModel: (key: string) => IParsedVoxModel | undefined;
    private readonly built = new Map<TerrainStyleId, ITerrainStyle>();

    /** `getModel` gives a hand-authored tile's parsed model by its manifest key; the tiles must already be loaded. */
    constructor(
        library: ChunkLibrary,
        defs: Readonly<Record<TerrainStyleId, ITerrainStyleDef>>,
        getModel: (key: string) => IParsedVoxModel | undefined,
    ) {
        this.library = library;
        this.defs = defs;
        this.getModel = getModel;
    }

    public get(id: TerrainStyleId): ITerrainStyle {
        const known = this.built.get(id);
        if (known) return known;

        const def = this.defs[id];
        if (!def) throw new RangeError(`TerrainStyleRegistry: no terrain style "${id}"`);
        const style = def.kind === 'procedural' ? buildProceduralStyle(this.library, def.options) : this.buildHandAuthored(def.spec);
        this.built.set(id, style);
        return style;
    }

    /** Builds every style now (for example behind a loading screen) so a later get() never costs a hitch mid-game. */
    public buildAll(): void {
        for (const id of Object.keys(this.defs) as TerrainStyleId[]) this.get(id);
    }

    private buildHandAuthored(spec: Parameters<typeof buildHandAuthoredStyle>[1]): ITerrainStyle {
        const models: Record<string, IParsedVoxModel> = {};
        for (const key of spec.tiles) {
            const model = this.getModel(key);
            if (!model) throw new RangeError(`TerrainStyleRegistry: tile model "${key}" for style ${spec.name} is not loaded`);
            models[key] = model;
        }
        return buildHandAuthoredStyle(this.library, spec, models);
    }
}
