# Session: Pattern Builder Optimization & Bug Fixes
**Session ID:** `e3fa375f-92c7-4ff6-ae16-ade5fa79de57`  
**Date:** 2026-09-28 to 2026-09-30  
**Focus:** Voxel Galaga pattern builder refactoring, memory optimization, and mirroring bugs

---

## Turn 0: Initial Code Review Request
**Timestamp:** 2026-09-28T11:56:04.168Z

### User Request
Expert game developer and TypeScript engineer code review focusing on:
1. Class structure duplication and base class extraction
2. Config organization (consolidate from multiple locations)
3. Game loop & rendering efficiency
4. Memory management and GC pauses
5. State & architecture concerns
6. TypeScript/JavaScript best practices

### Key Findings

#### 🚨 Critical Bugs / Memory Leaks

**EntityManager type casting bug:**
- `EntityManager` unconditionally casts every entity to `Invader` and reads `.slot` off it
- Location: [EntityManager.ts](src/entities/EntityManager.ts#L15-L26)
- Impact: Adding any non-Invader entity (Shot/Particle) will cause slot map to fill with `"undefined,undefined"` keys, returning wrong invaders
- Fix: Check `entity instanceof Invader` before accessing `.slot`

**Pattern builders building both sides:**
- Every pattern-builder call constructs both mirrored patterns and throws one away
- Runs from `director.update()` during mid-combat
- Massive waste of CPU cycles for formation changes

---

## Turn 1: Routing Left/Right Pairs Through Mirror Helpers
**Timestamp:** 2026-09-28T13:14:58.998Z

### User Request
How to route every pattern-builder's left/right pair through existing `mirrorCubicControlsX`/`mirrorPointX` helpers

### Solution Overview

**Core idea:** Instead of maintaining two literal copies (A and B paths with opposite x values), define one canonical side's control points and derive the other through `mirrorCubicControlsX(controls, 0)`.

**Key points:**
- `mirrorPointX`/`mirrorCubicControlsX` in [cubicBezier.ts](src/systems/path/cubicBezier.ts#L77-L104) mirror across vertical plane `x = centerX`
- For formation paths, mirror plane is formation centerline: `centerX = 0`
- **Critical wrinkle:** Endpoints tied to `start` position should NOT be mirrored:
  - `pAsegment1.p0` and `pAsegment4.p3` are live invader positions
  - Double-negating would place invader at wrong spawn/dock point
  - Only mirror interior/fixed via-points

---

## Turn 2: Bug Check - Start Position Copying
**Timestamp:** 2026-09-28T13:36:08.198Z

### User Issue
Double-checking new build function's start position copying. Canonical return to start works, but mirrored version seems to copy start position of invader about to leave—like start is overwritten for just the mirrored version.

### Root Cause Found

**Bug is in `side === 1` (canonical) branch, NOT mirrored:**

```typescript
const controls = side === 1 ? canonical : mirrorCubicControlsX(canonical, 0);
```

**Why mirrored is safe:**
- `mirrorCubicControlsX` allocates brand-new `CubicBezierControls` with fresh `Vector3` instances
- Mutating `controls.p0`/`p3` only touches that new object—no leakage

**Why canonical has the bug:**
- `side === 1` hands out `canonical` directly (same object)
- Mutations `controls.p0.copy(start)` and `controls.p3.copy(start)` mutate static class-level templates in place
- `BasePathSegment` stores reference, never clones
- `ColumnDivesDirector` calls `builder.build()` repeatedly—subsequent calls get corrupted stale positions

---

## Turn 3: ColumnVerticalPatternBuilder Efficiency Analysis
**Timestamp:** 2026-09-29T12:48:05.899Z

### User Question
ColumnVerticalPatternBuilder has been amended to only build one path based on side and use mirrorCubicControlsX. Works, but is it as efficient as it could be?

### Analysis

**Status:** Works correctly (no aliasing bug), but last-segment handling wastes CPU.

**For `i === last` in both branches:**
1. Build full 4-point clone/mirror (p0, p1, p2, p3)
2. `updateXValue` overwrites all 4 `.x` values—including p1.x and p3.x about to be discarded
3. `controls.p1 = this.smoothSegmentJoins(prevControls)` **replaces whole p1 vector**—clone/mirror work for p1 is waste
4. `controls.p2.x = ±140` is redundant re-assertion (mirror already produced this)
5. `if (i === last) controls.p3.copy(start)` **replaces whole p3 vector**—clone/mirror work for p3 wasted

**Net inefficiency:** Of 4 points cloned/mirrored for last segment, only `p0` (partially, just needs `.x`) and `p2` (needs `.y`/`.z`, `.x` hardcoded) survive to output. `p1` and `p3` are fully reconstructed after cloning.

---

## Turn 4: CPU Efficiency Comparison - Two Builder Variants
**Timestamp:** 2026-09-29T12:57:52.357Z

### User Question
Which is more efficient CPU-wise:
- ColumnVerticalPatternBuilderBU.ts (amended to only create pAsegment4 or pBsegment4 based on side)
- New ColumnVerticalPatternBuilder.ts?

### Verdict: Essentially Tied

Once "BU" builder is amended to skip unused segment doubling, both versions have **equivalent CPU cost**. The performance win (not building both sides) already applied to both.

**Allocation comparison for segments 0-2 (shared column-climb):**
- Amended BU: `new Vector3(start.x, y, z)` × 4 per segment—value correct on construction
- New version: `canonical.pN.clone()` × 4, then `updateXValue()` overwrites all 4 `.x` fields

Same number of Vector3 allocations. New version does minimal extra work (4 field assignments per segment across 3 segments = 12 extra floating-point writes). Negligible against V8's allocator/GC overhead.

**Segment 3 (last):** Identical in both versions after optimizations

---

## Turn 5: GroupAttackPattern1Builder Mirroring Bug
**Timestamp:** 2026-09-30T13:36:31.347Z

### User Issue
Amended GroupAttackPattern1Builder, but mirrored version doesn't match canonical. Jerky movement—quickly zips to control points instead of flying smoothly through them.

### Bug Found

`smoothSegmentJoins` is being fed **raw, unmirrored static table** instead of actual (possibly mirrored) previous segment's control points:

```typescript
// WRONG:
if (i > 0) controls.p1.copy(this.smoothSegmentJoins(GroupAttackPattern1Builder.SEGMENTS[i - 1]));
```

`GroupAttackPattern1Builder.SEGMENTS[i - 1]` is always canonical (right-side) literal data—never mirrored, not the actual controls object built in previous iteration.

**Why canonical works:** Nothing mutates segment's p2; p3 only overridden for last segment (never used as "previous")—canonical p2/p3 happen to equal real segment's p2/p3.

**Why mirrored fails:** 
- `mirrorCubicControlsX` negates x on actual segment
- But `smoothSegmentJoins` computes from un-mirrored canonical p2 → p3
- Arrival vector points toward right-side continuation, not left-side actually being flown
- Resulting p1 placed on wrong side of join
- Curve must whip back to reach it—the jerky "zip to control point" behavior

**Fix:** Feed `smoothSegmentJoins` the actual `prevControls` from previous iteration, not the static table.

---

## Summary of Changes Made

1. **EntityManager:** Add `instanceof Invader` checks in add()/remove()
2. **Pattern Builders:** Eliminate pattern duplication by using mirrorCubicControlsX for non-canonical sides
3. **ColumnDivesPatternBuilder:** Fix static template aliasing bug (clone before mutating canonical branch)
4. **ColumnVerticalPatternBuilder:** Optimized last-segment handling (partial improvement in new version)
5. **GroupAttackPattern1Builder:** Fix smoothSegmentJoins to use actual prevControls instead of static table
