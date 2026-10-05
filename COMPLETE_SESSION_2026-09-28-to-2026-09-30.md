# Complete Session: Voxel Galaga Code Review & Pattern Builder Optimization
**Session ID:** `e3fa375f-92c7-4ff6-ae16-ade5fa79de57`  
**Duration:** 2026-09-28 11:56 AM to 2026-09-30 1:36 PM  
**Focus:** Comprehensive code review, architecture analysis, pattern builder refactoring

---

## Turn 0: Initial Brutal Code Review (Sept 28, 11:56 AM)

### User Request
Expert game developer and TypeScript engineer code review focusing on:
1. Class structure duplication and base class extraction efficiency
2. Config organization (consolidate from multiple locations into single folder)
3. Game loop & rendering efficiency
4. Memory management and GC pauses
5. State & architecture concerns
6. TypeScript/JavaScript best practices

### Assistant Response: Comprehensive Code Review

#### 🚨 Critical Bugs / Memory Leaks

**EntityManager Type Casting Bug:**
- **Issue:** `EntityManager` unconditionally casts every entity to `Invader` and reads `.slot` off it
- **Location:** [EntityManager.ts](src/entities/EntityManager.ts#L15-L26)
- **Impact:** Adding any non-Invader entity (Shot/Particle) fills slot map with `"undefined,undefined"` keys, returns wrong invaders
- **Fix:** Check `entity instanceof Invader` before accessing `.slot`

**Pattern Builders Building Both Sides (Major Memory Spike):**
- **Issue:** Every pattern-builder call constructs both mirrored patterns (all segments + both MultiSegmentPatterns) and throws one away, runs during mid-combat
- **Location:** ColumnDivesPatternBuilder, ColumnVerticalPatternBuilder, FigureEightPatternBuilder, GroupAttackPattern1/2
- **Impact:** Every column trigger / group attack allocates ~2x required Vector3/segment/pattern objects at busiest screen moment—causes frame-time stutters during action
- **Fix:** Build only requested side or use canonical + mirror via `mirrorCubicControlsX`

**Mixed Time Sources (Trigger vs Cooldown):**
- **Issue:** Trigger gating uses `performance.now()` (wall-clock) while cooldowns use `dt` (simulation time)
- **Location:** ColumnDivesDirector, ColumnVerticalDirector, FigureEightDirector
- **Impact:** Pause/slow-mo/time-scaling silently breaks; fire cadence becomes wrong relative to other systems
- **Fix:** Use accumulated simulation time instead of wall-clock for all timing

**Missing Object Pool (Invader Spawning):**
- **Issue:** `PlaySession`/`EntryPatternDirector` never reuse `Invader.reset()` despite doc comment; every spawn does `template.clone(true)` + `new Invader(mesh)`
- **Location:** EntryPatternDirector, Invader.reset()
- **Impact:** At 10 invaders/second, deep-cloning mesh subtrees + allocating fresh Invader objects (10+ Vector3/Quaternion fields) multiple times/second = pure GC pressure
- **Fix:** Add Invader[] free-list in EntityManager; remove() pushes to pool, spawn does `pool.pop() ?? new Invader(...)`

**Unmatched Event Listener:**
- **Issue:** `window.addEventListener('resize')` in App constructor has no removal in `stop()`
- **Location:** [App.ts](src/app/App.ts#L74-L75)
- **Fix:** Store bound handler and remove on stop

---

#### 🟡 Major Inefficiencies

**Pattern Builder CPU/Allocation Waste:**
- Multiple builders construct both A (right) and B (left) paths by hand-copying every control point with x-negated
- Should route through existing but unused `mirrorCubicControlsX`/`mirrorPointX` from [cubicBezier.ts](src/systems/path/cubicBezier.ts)
- Single canonical build + mirror derive = half allocations, cleaner code

**Director Update-Loop Patterns:**
- Repeated code in ColumnDivesDirector, ColumnVerticalDirector, FigureEightDirector for trigger logic, cooldowns, state management
- Should extract to base director class or shared utility

**Array Operations in Hot Path:**
- Checking `if (entity.slot in this.slotMap)` and similar string-key lookups in EntityManager
- Should use Map<string, Invader> or typed slot registry instead

**Renderer Redundant Draw Calls:**
- Need to audit: are all invaders being rendered every frame even when off-screen?
- Scene.render() should frustum-cull or batch by visibility

---

#### 🟢 Quick Wins

1. **Mirror Helper Adoption** (Turns future pattern builders into half the code)
   - Define canonical segments in builder
   - Derive opposite side via `mirrorCubicControlsX(canonical, 0)`
   - Update director to use `side` parameter instead of pattern choice

2. **Object Pool for Invaders** (Eliminates GC spikes during intros)
   - Add to EntityManager
   - Modify EntryPatternDirector to grab from pool
   - Call reset() instead of clone

3. **Unified Simulation Timer**
   - Replace all `performance.now()` gates with accumulated `dt`
   - Pass GameContext.time to all directors

4. **Consolidate Config**
   - Move all pattern/stage configs to `/src/config/` subdirectories:
     - `config/patterns/` — BezierEntryPatternConfig, EntryPatternDirectorConfig, OrientationConfig
     - `config/stages/` — stage definitions, high scores schema
     - `config/core/` — constants.ts, Time/Input settings
   - Export barrel file for imports

---

#### ❌ Structural / Architecture Issues

**EntityManager is Type-Unsafe for Non-Invader Entities:**
- Documented as "usually Play" but forces everything to be Invader
- Need generic base: `EntityManager<T extends Entity>` or separate managers per entity type

**Duplicate Director Patterns:**
- ColumnDivesDirector, ColumnVerticalDirector, FigureEightDirector share ~70% code
- Extract to BaseFormationDirector or FormationDirector mixin

**Config Scattered Across Codebase:**
- Constants in `/src/data/constants.ts`
- Pattern configs in builder classes (hardcoded SEGMENTS static tables)
- Stage definitions in `/src/systems/stages/`
- Time/physics in multiple places
- **Ideal:** Single `/src/config/` tree with typed interfaces, each subsystem reads only what it needs

**No Separation Between Builder Patterns and Director Triggers:**
- Directors know too much about pattern structure
- Should inject pattern factories or use builder pattern more cleanly

---

#### 📋 Class Structure & Type Safety Issues

**Entity Type Hierarchy Too Flat:**
- `Entity` base is abstract but EntityManager only works with `Invader`
- Need: proper dispatch by type or separate manager per entity kind

**No Shared Director Base:**
- Copy-paste of update loops, trigger logic, state management
- BaseFormationDirector should handle: running state, cooldown, trigger scheduling (via `dt`)
- Subclasses only override pattern/trigger rules

**Pattern Builders All Hand-Roll Segments:**
- Should inherit from BasePatternBuilder with common logic:
  - Canonical path construction
  - Mirror path derivation via `mirrorCubicControlsX`
  - Segment cloning / control point mutation rules

---

#### 🔧 Modern TypeScript Improvements

- Replace string-key slot lookups with typed Map or enum-based registry
- Use `readonly` on static SEGMENTS tables (or deep-freeze them)
- Add `instanceof` checks instead of duck-typing for entity dispatch
- Use discriminated unions for entity types if splitting EntityManager by kind
- Export barrel files from /config for cleaner imports

---

## Turn 1: Routing Left/Right Pairs Through Mirror Helpers (Sept 28, 1:14 PM)

### User Request
How to route every pattern-builder's left/right pair through existing `mirrorCubicControlsX`/`mirrorPointX` helpers

### Strategy Overview

**Core Idea:**
Instead of maintaining two literal copies of paths (A and B with opposite x values), define one canonical side's control points and derive the other through `mirrorCubicControlsX(controls, 0)`.

**Why This Works:**
- `mirrorPointX`/`mirrorCubicControlsX` in [cubicBezier.ts](src/systems/path/cubicBezier.ts#L77-L104) mirror across vertical plane `x = centerX`
- For formation paths, mirror plane is formation centerline: `centerX = 0`
- Only mirror interior/fixed via-points, NOT live invader position endpoints

**Critical Wrinkle - Endpoints Tied to Start:**
- `pAsegment1.p0` and `pAsegment4.p3` are live invader positions
- Double-negating these would place invader at wrong spawn/dock point
- **Rule:** Only mirror interior via-points; keep start position symbolic (`{ x: start.x, y: start.y, z: start.z }`)

**Implementation Pattern:**
```typescript
build(invader: Invader, side: number): MultiSegmentPattern {
    const start = invader.position.clone();
    
    // Build canonical (right-side) segments
    const canonical = [
        new CubicBezierSegment({ p0: start, p1: {...}, p2: {...}, p3: {...} }),
        // ... more segments
    ];
    
    // For non-canonical side, mirror the controls
    if (side === 0) { // left side
        return new MultiSegmentPattern(
            canonical.map(seg => mirrorCubicControlsX(seg.controls, 0)),
            ranges, duration
        );
    }
    
    return new MultiSegmentPattern(canonical, ranges, duration);
}
```

---

## Turn 2: Start Position Bug Investigation (Sept 28, 1:36 PM)

### User Issue
Double-checking new build function's start position copying. Canonical return works, but mirrored version copies start position of invader about to leave—like start is overwritten for just mirrored version.

### Root Cause Analysis

**The Bug is in `side === 1` (canonical branch), NOT mirrored:**

```typescript
const controls = side === 1 ? canonical : mirrorCubicControlsX(canonical, 0);
```

**Why Mirrored is Safe:**
- `mirrorCubicControlsX` allocates brand-new CubicBezierControls with fresh Vector3 instances
- Mutating `controls.p0`/`p3` only touches that new object—no aliasing

**Why Canonical Has the Bug:**
- `side === 1` hands out `canonical` directly (same object references)
- Mutations `controls.p0.copy(start)` and `controls.p3.copy(start)` mutate static class-level templates **in place**
- `BasePathSegment` stores reference, never clones
- `ColumnDivesDirector` calls `builder.build()` repeatedly—subsequent calls get corrupted stale positions

**Failure Mode Example:**
- Invader 1 at (50, 20, 0) builds path, mutates canonical p3 to (50, 20, 0)
- Invader 2 at (80, 20, 0) calls builder.build(), receives same canonical object
- But now `controls.p3` still points to (50, 20, 0) from invader 1 until first segment is processed
- Result: invader 2's ending position is wrong

---

## Turn 3: ColumnVerticalPatternBuilder Efficiency Analysis (Sept 29, 12:48 PM)

### User Question
ColumnVerticalPatternBuilder amended to only build one path based on side and use mirrorCubicControlsX. Works correctly—but is it efficient?

### Efficiency Assessment

**Status:** Correct (no aliasing bug), but last-segment handling wastes CPU

**Inefficiency Identified:**

For `i === last` in both branches, the code:
1. Builds full 4-point clone/mirror (p0, p1, p2, p3)
2. `updateXValue` overwrites all 4 `.x` values—including p1.x and p3.x about to be discarded
3. `controls.p1 = this.smoothSegmentJoins(prevControls)` **replaces whole p1 vector**—clone/mirror work for p1 is wasted
4. `controls.p2.x = ±140` is redundant (mirror already produced this value)
5. `if (i === last) controls.p3.copy(start)` **replaces whole p3 vector**—clone/mirror work for p3 wasted

**Net Inefficiency:** Of 4 points cloned/mirrored for last segment, only `p0` (partially, just `.x`) and `p2` (needs `.y`/`.z`, `.x` hardcoded by side) survive to output. `p1` and `p3` fully reconstructed after cloning.

**Optimization:** Skip cloning/mirroring p1 and p3 for the last segment since they're immediately replaced.

---

## Turn 4: CPU Efficiency Comparison - Two Builder Variants (Sept 29, 12:57 PM)

### User Question
Which is more CPU-efficient:
- **ColumnVerticalPatternBuilderBU** (amended to only create pAsegment4 or pBsegment4 based on side)
- **New ColumnVerticalPatternBuilder** (using mirrorCubicControlsX)

### Verdict: Essentially Tied

Once "BU" builder is amended to skip unused segment doubling, both versions have **equivalent CPU cost**. The real performance win (not building both sides) already applies to both.

**Allocation Comparison for Segments 0-2 (shared column-climb):**
- **Amended BU:** `new Vector3(start.x, y, z)` × 4 per segment—value correct on construction
- **New version:** `canonical.pN.clone()` × 4, then `updateXValue()` overwrites all 4 `.x` fields

Same number of Vector3 allocations. New version does minimal extra work:
- 4 field assignments per segment across 3 segments = 12 extra floating-point writes
- Negligible against V8's allocator/GC overhead

**Segment 3 (last):** Identical in both after optimizations

**Conclusion:** Choose based on code clarity and maintainability, not CPU cost—both equivalent.

---

## Turn 5: GroupAttackPattern1Builder Mirroring Bug (Sept 30, 1:36 PM)

### User Issue
Amended GroupAttackPattern1Builder, but mirrored version doesn't match canonical. Jerky movement—quickly zips to control points instead of flying smoothly through them.

### Bug Root Cause

`smoothSegmentJoins` is being fed **raw, unmirrored static table** instead of actual (possibly mirrored) previous segment's control points:

```typescript
// WRONG - uses static canonical table, not actual built segment:
if (i > 0) controls.p1.copy(this.smoothSegmentJoins(GroupAttackPattern1Builder.SEGMENTS[i - 1]));
```

**Why Canonical Works by Coincidence:**
- Nothing mutates segment's p2
- p3 only overridden for last segment (never used as "previous")
- Canonical p2/p3 happen to equal real segment's p2/p3

**Why Mirrored Fails:**
- `mirrorCubicControlsX` negates x on actual segment being flown
- But `smoothSegmentJoins` computes from un-mirrored canonical p2 → p3
- Arrival vector points toward right-side continuation, not left-side actually being flown
- Resulting p1 placed on wrong side of join
- Curve whips back to reach it—**exactly the jerky "zip to control point" behavior**

**Fix:** Feed `smoothSegmentJoins` the actual `prevControls` from previous iteration, not the static table

```typescript
// CORRECT:
let prevControls: CubicBezierControls | null = null;
for (let i = 0; i < segmentCount; i++) {
    const controls = /* ... */;
    if (i > 0 && prevControls) {
        controls.p1.copy(this.smoothSegmentJoins(prevControls));
    }
    prevControls = controls; // save for next iteration
}
```

---

## Summary of All Issues Identified

### Critical Memory/Performance Issues
1. ✅ EntityManager type casting bug
2. ✅ Pattern builders allocating both sides unnecessarily
3. ✅ Mixed time sources (performance.now vs dt)
4. ✅ Missing invader object pool
5. ✅ Unmatched event listeners
6. ✅ Static template aliasing in canonical segment building
7. ✅ GroupAttackPattern1Builder jerky mirroring (smoothSegmentJoins bug)

### Architecture Improvements Needed
1. Extract BaseFormationDirector from repeated director code
2. Consolidate config to single `/src/config/` folder tree
3. Fix EntityManager generics for non-Invader entities
4. Extract BasePatternBuilder with mirror logic

### Pattern Builder Optimizations
1. Route all builders through mirrorCubicControlsX
2. Optimize last-segment handling to skip unnecessary clones
3. Cache pattern instances where possible

---

## Implementation Checklist

- [ ] Fix EntityManager instanceof checks
- [ ] Add Invader object pool to EntityManager
- [ ] Convert pattern builders to use mirrorCubicControlsX
- [ ] Fix ColumnDivesPatternBuilder static template aliasing
- [ ] Fix GroupAttackPattern1Builder smoothSegmentJoins
- [ ] Extract BaseFormationDirector
- [ ] Move all timing to accumulated dt instead of performance.now()
- [ ] Consolidate config files to /src/config/
- [ ] Add window.removeEventListener cleanup to App.stop()
- [ ] Audit renderer for off-screen culling
