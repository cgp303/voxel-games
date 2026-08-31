import { App } from './app/App';

/**
 * Thin entry: construct App and start the engine + Demo screen.
 * World content (terrain, invaders) migrates in Phase 2.
 */
const app = new App();
void app.start();
