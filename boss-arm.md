# Boss arms

A boss can carry up to four tentacle-like arms. Each is a **joint** on the body, a chain of **segments** laid along a
spline, and a **weapon** at the tip. Everything is configured in the boss's JSON (`public/assets/vox/bosses/<id>/<id>.json`)
under the optional `arms` array. `boss3.json` is the reference example.

## Behaviour in brief

- Contact with any part of an arm kills the player (X/Z circle test, with a Y tolerance).
- Player shots that hit an arm are stopped (with sparks). Arm segments take no damage.
- The arm is destroyed by destroying its **weapon** (`weapon.hits`) or its **joint** (a boss `part`, see `jointPart`).
- Weapon destroyed: the weapon explodes and the segments are cut loose. Joint destroyed: the whole arm (weapon too) is cut loose.
- Boss destroyed: every arm is cut loose at once.
- Cut-loose pieces drift toward the camera (-z) at a constant speed with no gravity, starting in sequence. They kill the
  player on contact, are destroyed by one shot (score `debrisScore`), and are removed with no penalty once past the camera.
- A joint flashes when hit.

## Coordinates

Positions in moves are in the **boss's local space**: units from the boss's centre, +x/-x sideways, y up, **-z toward the
player**, +z toward the back of the boss. Local space rolls with the boss. `mount` is the exception: it is a voxel
coordinate in the boss model (see below).

## Arm definition

```json
{
  "id": "armL",
  "jointPart": "armWeaponJoinLeft",
  "assets": { "joint": "boss3LeftArmJoin", "segment": "boss3ArmSegment", "weapon": "boss3ArmWeapon", "lazer": "boss3lazer" },
  "mount": { "x": 31, "y": 2, "z": 13 },
  "segments": 8,
  "taper": 0.8,
  "spacing": 0.75,
  "weapon": { "type": "BossLazerA", "hits": 6, "speed": 250, "muzzle": { "x": 0, "y": -2, "z": 0 }, "scoreValue": 500 },
  "debrisScore": 50,
  "phases": ["attack", "rest"],
  "moves": [ ... ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | Unique among the boss's arms. |
| `jointPart` | yes | Id of a boss `parts` entry. That part's rects and `hits` are the joint's weak point. One arm per part. Destroying it cuts the arm loose. |
| `assets.joint` / `segment` / `weapon` | yes | `.vox` names (no extension) in the boss's folder. |
| `assets.lazer` | no | `.vox` of the shot the arm fires. Without it the arm never fires. Its long axis should be z. |
| `mount` | yes | Voxel coordinate **in the boss model** (x across, y height, z depth, z=0 at the front) where the arm starts. The centre of that voxel is used. Must lie inside the model. |
| `segments` | yes | Number of segments (2 or more). |
| `taper` | no (1) | Scale of the last segment relative to the first. |
| `spacing` | no (0.75) | Distance between segment centres as a fraction of a segment's width. With `segments`, this sets the arm's length. |
| `weapon.type` | yes | A boss weapon type from `BOSS_WEAPONS` (e.g. `BossLazerA`); sets the shot's behaviour and default speed. |
| `weapon.hits` | yes | Hits to destroy the weapon at the tip. |
| `weapon.speed` | no | Shot speed. Defaults to the weapon type's `defaultSpeed`. |
| `weapon.muzzle` | no | Where shots leave, as an offset from the weapon's centre in the weapon's own frame (x right, y up, z forward = -z). Turns with the weapon. |
| `weapon.scoreValue` | no (0) | Score for destroying the weapon. |
| `debrisScore` | no (0) | Score for each cut-loose piece that is shot. |
| `phases` | no (both) | Boss cycle phases (`attack`, `rest`) in which the moves run. In other phases (and while the boss is entering) the arm idles. |
| `moves` | no | The looping move list (below). With none, the arm just idles. |

The tip can never stray further from the mount than 95% of the arm's chain length (`BOSS_ARM.maxReach`).

## Moves and stages

`moves` is played in order and loops. A boss that leaves the arm's `phases` drops back to an idle pose and starts the
list again from the top when it returns.

Every move field except `seconds` is optional, and so is every stage: use only the ones you want.

```json
{ "stage": "strike", "seconds": 0.5, "target": { "mode": "lockedPlayer" }, "motion": "whip", "overshoot": 0.1,
  "follow": 4, "ease": "out", "wave": { "amp": 3, "freq": 1, "speed": 0.5 },
  "fire": { "mode": "tip", "rate": 0.15 } }
```

| Field | Meaning |
|---|---|
| `stage` | A label: `idle`, `track`, `windup`, `strike`, `sweep`, `recover`. It does not change the maths except for the no-target rule below; it names the intent. |
| `seconds` | Duration: a number, or `[min, max]` for a random duration each time the move plays. |
| `target` | Where the tip goes (below). Without one, the arm holds its pose, except `idle` and `recover`, which return to the rest pose. |
| `follow` | How quickly the tip chases its target, per second (default 4). Low is lazy, high is snappy. It also drives how much the body of the arm trails the tip. |
| `motion` | `smooth` (default) or `whip` (see below). |
| `overshoot` | `whip` only: how far past the target the tip swings, as a fraction of the distance travelled (default 0.1). |
| `ease` | `in`, `out` or `inOut`. Shapes a timed move (see below) and the position along a `sweep`. |
| `wave` | A ripple along the arm: `amp` (sideways size at the tip), `freq` (ripples along the length), `speed` (cycles per second). Without one, a gentle default ripple applies. Changes blend smoothly between moves. |
| `fire` | Shots fired while the move runs (below). |

### Targets

| `mode` | Meaning | Fields |
|---|---|---|
| `local` | A fixed point in boss space. | `pos` (required) |
| `player` | Continuously tracks the player's current position. | `offset` (optional, added to the player's position) |
| `lockedPlayer` | Captures the player's position at the **start** of the move, then goes to that fixed point. Good for a strike the player can dodge. | `offset` (optional) |
| `sweep` | The tip travels from one point to another over the move's duration. | `from`, `to` (required); `pingPong: true` goes there and back; `ease` shapes the travel |

With no player in play, `player` holds the current pose and `lockedPlayer` locks to the tip's current position.

### How the tip moves

- **Timed moves:** a `local` or `lockedPlayer` target with `ease` or `motion: "whip"` goes from where the tip started to
  the target over exactly `seconds`.
  - `ease` shapes the progress.
  - `whip` is a fast snap that overshoots by `overshoot` and settles back on the target.
- **Chasing moves:** everything else (`player`, `sweep`, and `local` or `lockedPlayer` without `ease` or `whip`) chases its target at the `follow` rate. A `sweep` moves its target along the line, and the tip follows it.

### Stage guide (suggested use)

| Stage | Typical use |
|---|---|
| `idle` | Gentle writhing near the rest pose. Give `wave`, no target. |
| `track` | Follow the player (`player` target) with a low `follow`. |
| `windup` | Pull back to a fixed pose (`local`), a telegraph before a strike. |
| `strike` | Fast lunge at a `lockedPlayer` point with `whip`. |
| `sweep` | Drag the tip across the field (`sweep` target) with `ease`. |
| `recover` | No target: returns to the rest pose. |

## Firing

`fire` goes on a move and applies while that move runs. Shots are spawned from the weapon at the tip, offset by
`weapon.muzzle`, at the weapon's speed. They fly flat on the X/Z plane and are lethal like the boss's other lazers.

| Field | Meaning |
|---|---|
| `mode` | `down`: straight toward the camera (-z). `random`: a random direction within `coneDeg` of down. `aim`: at the player's position at the moment of firing (down if there is no player). `tip`: the way the weapon is facing. |
| `rate` | Seconds between shots. The first shot is fired as the move starts. |
| `coneDeg` | `random` only: half-angle of the cone in degrees (default 30). |

A move with no `fire` does not fire. The arm stops firing once it is cut loose.

## Tuning constants

Shared settings that are not per-boss are in `BOSS_ARM` in `src/config/data/constants.ts`: segment spacing and spline
detail, the rest pose, the default `follow`, collision radii and Y tolerances, the flash, and the fall speed, stagger,
spin and removal depth of cut-loose pieces.

## Checklist for a new arm

1. Add a `parts` entry for the joint, and set its `hits`.
2. Put the `.vox` files (joint, segment, weapon, optionally lazer) in the boss's folder.
3. Add the arm with `jointPart`, `assets`, `mount`, `segments` and `weapon`.
4. Add moves, starting with an `idle` and a `track`, then telegraphed strikes.
5. Watch it in play: check the weapon's facing, the mount position, and that moves stay within reach.
