import './style.css'
import * as THREE from 'three';
import { GameScene } from './scene/Scene';
import { GameCamera } from './scene/Camera';
import { GameRenderer } from './scene/Renderer';
import { VoxelWorld } from './voxel/VoxelWorld';
import { VoxParser, ParsedVoxModel } from './voxel/VoxParser';
import { VoxelGeometry } from './voxel/VoxelGeometry';
import { TerrainGenerator } from './voxel-landscape/TerrainGenerator';
import { DEFAULT_TERRAIN_CONFIG } from './voxel-landscape/TerrainConfig';

const scene = new GameScene();
const renderer = new GameRenderer(scene, null);
const camera = new GameCamera(renderer);
renderer.setCamera(camera);  // Set camera after creation

// Start animation loop
renderer.startAnimation();

// Add simple FPS counter
const fpsDisplay = document.createElement('div');
fpsDisplay.style.cssText = `
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: #00ff00;
  padding: 10px 15px;
  font-family: monospace;
  font-size: 12px;
  z-index: 100;
  border: 1px solid #00ff00;
`;
document.body.appendChild(fpsDisplay);

let lastTime = performance.now();
let frameCount = 0;

renderer.renderer.setAnimationLoop(() => {
  frameCount++;

  const now = performance.now();
  if (now >= lastTime + 1000) {
    fpsDisplay.textContent = `FPS: ${frameCount}`;
    frameCount = 0;
    lastTime = now;
  }
});

// Load terrain and create scene
async function initializeTerrain() {
  try {

    // Generate terrain from preset config
    const generator = new TerrainGenerator(DEFAULT_TERRAIN_CONFIG);
    const terrain = generator.generate();

    // Create voxel world and populate with terrain data
    const world = new VoxelWorld();
    VoxParser.populateWorld(world, terrain);

    // Create mesh from terrain
    const terrainMesh = VoxelGeometry.createMesh(world, terrain.colors);
    const terrainWidth = terrain.size.x;
    const terrainDepth = terrain.size.z;
    const terrainHeight = terrain.size.y;

    terrainMesh.position.set(-terrainWidth * 0.5, 0, -terrainDepth * 0.5);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;

    scene.addTerrainMesh(terrainMesh, { w: terrainWidth, h: terrainHeight, d: terrainDepth });
    scene.createLights();

    // ===== CAMERA =====
    const angleDeg = 33;
    const angleRad = angleDeg * Math.PI / 180;
    const distance = Math.max(terrainWidth, terrainDepth) * 0.65;
    const cameraY = terrainHeight * 0.5 + (distance * 1.25) * Math.sin(angleRad);
    const cameraZ = -distance * Math.cos(angleRad);

    camera.camera.position.set(0, cameraY, cameraZ);
    camera.controls.target.set(0, -50, 0);
    camera.controls.update();

    // ===== INVADERS GRID =====
    const parsedModel = await VoxParser.loadVoxFile('assets/vox/inv5.vox');
    console.log('Loaded inv2.vox:', parsedModel.size);

    const modelWidth = parsedModel.size.x;
    const spacing = modelWidth * 1.25;

    const cols = 10;
    const rows = 6;

    // Create template mesh
    const invaderWorld = new VoxelWorld();
    VoxParser.populateWorld(invaderWorld, parsedModel);
    const templateMesh = VoxelGeometry.createMesh(invaderWorld, parsedModel.colors);

    // Center template
    const bounds = invaderWorld.getBounds();
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    templateMesh.position.set(-centerX, -centerY, -centerZ);

    // Create grid instances centered at (0, 0)
    const startX = 50;
    const startZ = 50;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const instance = templateMesh.clone();

        // Rotate to lie flat
        instance.rotation.x = Math.PI / 2;

        // Position in grid, centered at x=0, z=0
        const x = startX + (col - (cols - 1) / 2) * spacing;
        const z = startZ + (row - (rows - 1) / 2) * spacing;

        const y = terrainHeight + 8; // Place on top of terrain

        instance.position.set(x, y, z);
        instance.castShadow = true;
        instance.receiveShadow = true;

        scene.scene.add(instance);
      }
    }

    console.log(`Grid created: ${cols}×${rows} = ${cols * rows} invaders`);


  } catch (error) {
    console.error('Failed to generate terrain:', error);
  }
}

initializeTerrain();

// Handle window resize
window.addEventListener('resize', () => {
  camera.onWindowResize();
  renderer.onWindowResize();
});
