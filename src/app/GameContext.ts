import type { GameScene } from '../scene/Scene';
import type { GameCamera } from '../scene/Camera';
import type { GameRenderer } from '../scene/Renderer';
import type { Input } from '../core/Input';
import type { EventBus } from '../core/EventBus';
import type { AssetManager } from '../assets/AssetManager';
import type { PlayField } from '../world/PlayField';
import type { Game } from './Game';
import type { ScreenManager } from '../screens/ScreenManager';

/**
 * Shared dependencies injected into every screen on enter().
 */
export interface GameContext {
  scene: GameScene;
  camera: GameCamera;
  renderer: GameRenderer;
  input: Input;
  events: EventBus;
  assets: AssetManager;
  game: Game;
  /** Shared play field (terrain + invaders), built at App start */
  playField: PlayField;
  /** Allows screens to request mode changes without importing App */
  screens: ScreenManager;
}
