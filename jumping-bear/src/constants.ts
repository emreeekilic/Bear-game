import { FishType } from './types';

export const GAME_WIDTH = 400;
export const GAME_HEIGHT = 700;

export const BEAR_WIDTH = 60;
export const BEAR_HEIGHT = 60;
export const BEAR_SPEED = 5;
export const JUMP_FORCE = -15;
export const GRAVITY = 0.6;

export const FISH_CONFIG = {
  [FishType.SMALL]: { points: 1, size: 20, color: '#60A5FA' },
  [FishType.MEDIUM]: { points: 2, size: 30, color: '#3B82F6' },
  [FishType.LARGE]: { points: 3, size: 40, color: '#1D4ED8' },
  [FishType.PUFFER]: { points: -2, size: 35, color: '#EF4444' },
};

export const LEVEL_TIME = 30;
export const MAX_LEVELS = 20;

export const POWERUP_DURATION = {
  SPEED: 5000,
  IMMUNITY: 2000,
};
