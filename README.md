# Voxel Game - Proof of Concept

A Three.js-based voxel game engine built with TypeScript and Vite. This PoC demonstrates loading and rendering MagicaVoxel (.vox) files with full 3D camera controls.

## Features

- **3D Voxel Rendering**: Efficient voxel geometry generation using face culling (~83% geometry reduction)
- **VOX File Support**: Parse and render MagicaVoxel format files
- **Full Camera Controls**: 
  - Rotate: Left-click drag
  - Pan: Right-click drag (or Ctrl+click)
  - Zoom: Mouse scroll wheel
- **Real-time Rendering**: 60 FPS WebGL rendering via Three.js
- **Responsive UI**: File loader with status display

## Tech Stack

- **Three.js r185+** - 3D graphics rendering
- **TypeScript 5+** - Static typing and IDE support
- **Vite** - Lightning-fast build tooling
- **vox-parser** - MagicaVoxel file format parsing
- **WebGL** - GPU-accelerated rendering backend

## Project Structure

```
src/
  main.ts              # Application entry point
  style.css            # Global styles
  scene/
    Scene.ts           # Three.js scene setup (lights, fog)
    Camera.ts          # Camera + OrbitControls
    Renderer.ts        # WebGL renderer configuration
  voxel/
    VoxParser.ts       # VOX file parsing
    VoxelWorld.ts      # Sparse 3D voxel storage
    VoxelGeometry.ts   # Geometry generation with face culling
  ui/
    FileLoader.ts      # File input UI component
assets/
  vox/                 # VOX model files (place your .vox files here)
```

## Getting Started

### Install Dependencies

```bash
cd c:\voxel-game
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
npm run preview
```

## How to Use

1. Click the **"📂 Load .vox File"** button in the top-left corner
2. Select a `.vox` file from your computer
3. The voxel model will load and render in the viewport
4. Use camera controls to explore the model:
   - **Rotate**: Click and drag (left mouse button)
   - **Pan**: Right-click and drag (or Ctrl + left-click)
   - **Zoom**: Scroll wheel

## Adding VOX Files

Place your MagicaVoxel (.vox) files in the `assets/vox/` folder, or use the file dialog to load them from anywhere on your system.

### Recommended Free VOX Models

- [MagicaVoxel Official Gallery](https://ephtracy.github.io/index.html?p=gallery)
- [Sketchfab VOX Models](https://sketchfab.com/) (filter by voxel)

## Performance Notes

- **Face Culling**: Only visible faces are rendered (~83% vertex reduction)
- **Sparse Voxel Storage**: Uses object-based sparse array (memory efficient)
- **Single Merged Geometry**: All voxels combined into one mesh per load

Typical performance:
- 5,000 voxels: 60+ FPS on modern hardware
- 50,000 voxels: 30-60 FPS depending on hardware

## Known Limitations

- **Single Model**: Only one voxel model loaded at a time
- **No Editing**: Voxels cannot be placed/removed (PoC phase)
- **Flat Lighting**: Simple ambient + directional lighting (no dynamic shadows)
- **No Physics**: No gravity or collision detection

## Future Enhancements

- [ ] Voxel editing (place/remove)
- [ ] Chunked world system for large models
- [ ] Physics engine integration
- [ ] Multiple models in scene
- [ ] Save/export functionality
- [ ] Mobile touch controls
- [ ] Advanced materials and textures
- [ ] Minimap / camera presets

## Troubleshooting

### White/Blank Screen
- Check browser console (F12) for JavaScript errors
- Ensure WebGL is supported in your browser
- Try a different browser (Chrome, Firefox, Edge)

### VOX File Won't Load
- Verify the file is a valid MagicaVoxel format (.vox)
- Check browser console for parsing errors
- Try a different sample VOX file

### Performance Issues
- Reduce the size of loaded VOX models
- Close other applications to free up GPU memory
- Use a newer GPU/browser for better WebGL support

## Architecture Notes

### Face Culling Algorithm

For each voxel, the renderer checks 6 adjacent positions (±X, ±Y, ±Z). If an adjacent cell is empty (no voxel), that face is added to the geometry. This reduces vertex count by ~83% compared to rendering all faces of all voxels.

### Sparse Voxel Storage

Voxels are stored in a Map using `"x,y,z"` string keys rather than a dense 3D array. This saves memory for models with empty space.

### VOX File Parsing

The `vox-parser` library handles binary VOX format decoding. The parsed data includes:
- Voxel positions (x, y, z) and color indices
- Dimension data (size.x, size.y, size.z)
- Color palette (RGBA)

## License

This project is open source. Three.js is licensed under MIT.

## References

- [Three.js Documentation](https://threejs.org/docs/)
- [Three.js Examples](https://threejs.org/examples/)
- [OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls)
- [MagicaVoxel](https://ephtracy.github.io/)
