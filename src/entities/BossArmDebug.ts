import * as THREE from 'three';
import type { IBossArmMove } from '../config/interfaces/interfaces';

/** What a BossArm exposes for drawing (live references, in the boss's local space). */
export interface IBossArmDebugInfo {
    id: string;
    mount: THREE.Vector3;
    tip: THREE.Vector3;
    /** Where the move wants the tip, before the reach clamp. */
    target: THREE.Vector3;
    /** The spline's control points (x y z each) as last built, arch and ripple included. */
    controls: Float64Array;
    weapon: THREE.Vector3;
    aim: THREE.Vector3 | null;
    reach: number;
    move: IBossArmMove;
    moveIndex: number;
    moveElapsed: number;
    moveDuration: number;
}

const COLORS = {
    reach: 0x3366ff,
    target: 0xff3030,
    tip: 0x30ff30,
    chase: 0xffff00,
    spline: 0x00ffff,
    straight: 0xffffff,
    aim: 0xff40ff,
    path: 0x8080ff,
};
const MARKER_RADIUS = 2;

/**
 * Draws one boss arm's workings over the arm (a child of the arm's group, so it shares the boss's local space):
 * blue sphere = the longest the tip can reach from the mount; red = where the move wants the tip; green = where the
 * tip is; yellow line = the gap between them; cyan = the control points the curve is built from; white = the
 * straight line from mount to tip; magenta = the weapon's aim point; light blue = a sweep/pendulum's from and to.
 */
export class BossArmDebug {
    public readonly group = new THREE.Group();

    private readonly reachSphere: THREE.Mesh;
    private readonly targetMarker: THREE.Mesh;
    private readonly tipMarker: THREE.Mesh;
    private readonly aimMarker: THREE.Mesh;
    private readonly fromMarker: THREE.Mesh;
    private readonly toMarker: THREE.Mesh;
    private readonly chaseLine: THREE.Line;
    private readonly straightLine: THREE.Line;
    private readonly splineLine: THREE.Line;
    private readonly aimLine: THREE.Line;
    private readonly pathLine: THREE.Line;
    private readonly label: THREE.Sprite;
    private readonly labelCanvas = document.createElement('canvas');
    private readonly labelTexture: THREE.CanvasTexture;
    private readonly controlCount: number;
    private labelText = '';

    constructor(controlCount: number) {
        this.controlCount = controlCount;
        this.group.name = 'BossArmDebug';
        this.reachSphere = new THREE.Mesh(
            new THREE.SphereGeometry(1, 16, 10),
            new THREE.MeshBasicMaterial({ color: COLORS.reach, wireframe: true, transparent: true, opacity: 0.15, depthTest: false }),
        );
        this.targetMarker = this.marker(COLORS.target);
        this.tipMarker = this.marker(COLORS.tip);
        this.aimMarker = this.marker(COLORS.aim);
        this.fromMarker = this.marker(COLORS.path);
        this.toMarker = this.marker(COLORS.path);
        this.chaseLine = this.line(2, COLORS.chase);
        this.straightLine = this.line(2, COLORS.straight);
        this.splineLine = this.line(controlCount, COLORS.spline);
        this.aimLine = this.line(2, COLORS.aim);
        this.pathLine = this.line(2, COLORS.path);

        this.labelCanvas.width = 512;
        this.labelCanvas.height = 64;
        this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);
        this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelTexture, depthTest: false, transparent: true }));
        this.label.scale.set(40, 5, 1);
        this.label.renderOrder = 1000;

        this.group.add(
            this.reachSphere, this.targetMarker, this.tipMarker, this.aimMarker, this.fromMarker, this.toMarker,
            this.chaseLine, this.straightLine, this.splineLine, this.aimLine, this.pathLine, this.label,
        );
    }

    public update(info: IBossArmDebugInfo, visible: boolean): void {
        this.group.visible = visible;
        if (!visible) return;

        this.reachSphere.position.copy(info.mount);
        this.reachSphere.scale.setScalar(info.reach);
        this.targetMarker.position.copy(info.target);
        this.tipMarker.position.copy(info.tip);
        this.setLine(this.chaseLine, info.tip, info.target);
        this.setLine(this.straightLine, info.mount, info.tip);
        this.setLine(this.aimLine, info.weapon, info.aim ?? info.weapon);
        this.aimMarker.visible = this.aimLine.visible = info.aim !== null;
        if (info.aim) this.aimMarker.position.copy(info.aim);

        const spline = this.splineLine.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < this.controlCount * 3; i++) spline.array[i] = info.controls[i];
        spline.needsUpdate = true;

        const spec = info.move.target;
        const hasPath = !!spec?.from && !!spec.to && (spec.mode === 'pendulum' || spec.mode === 'sweep');
        this.fromMarker.visible = this.toMarker.visible = this.pathLine.visible = hasPath;
        if (hasPath) {
            this.fromMarker.position.set(spec!.from!.x, spec!.from!.y, spec!.from!.z);
            this.toMarker.position.set(spec!.to!.x, spec!.to!.y, spec!.to!.z);
            this.setLine(this.pathLine, this.fromMarker.position, this.toMarker.position);
        }

        const distance = info.mount.distanceTo(info.target);
        const over = distance > info.reach ? ` OUT OF REACH ${Math.round((distance / info.reach) * 100)}%` : '';
        this.label.position.set(info.mount.x, info.mount.y + 12, info.mount.z);
        this.setLabel(`${info.id} #${info.moveIndex} ${info.move.stage} ${info.moveElapsed.toFixed(1)}/${info.moveDuration.toFixed(1)}s${over}`, over !== '');
    }

    public dispose(): void {
        this.group.traverse((o) => {
            const item = o as THREE.Mesh;
            item.geometry?.dispose();
            const material = item.material as THREE.Material | undefined;
            material?.dispose();
        });
        this.labelTexture.dispose();
        this.group.removeFromParent();
    }

    private marker(color: number): THREE.Mesh {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(MARKER_RADIUS, 10, 8),
            new THREE.MeshBasicMaterial({ color, depthTest: false }),
        );
        mesh.renderOrder = 999;
        return mesh;
    }

    private line(points: number, color: number): THREE.Line {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points * 3), 3));
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, depthTest: false }));
        line.frustumCulled = false;
        line.renderOrder = 999;
        return line;
    }

    private setLine(line: THREE.Line, a: THREE.Vector3, b: THREE.Vector3): void {
        const position = line.geometry.getAttribute('position') as THREE.BufferAttribute;
        position.setXYZ(0, a.x, a.y, a.z);
        position.setXYZ(1, b.x, b.y, b.z);
        position.needsUpdate = true;
    }

    private setLabel(text: string, warn: boolean): void {
        if (text === this.labelText) return;
        this.labelText = text;
        const ctx = this.labelCanvas.getContext('2d')!;
        ctx.clearRect(0, 0, this.labelCanvas.width, this.labelCanvas.height);
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = warn ? '#ff5050' : '#ffffff';
        ctx.fillText(text, 6, 40);
        this.labelTexture.needsUpdate = true;
    }
}
