export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  LEVEL_UP = 'LEVEL_UP',
  GAME_OVER = 'GAME_OVER',
  RESTARTING = 'RESTARTING',
  WIN = 'WIN'
}

export enum FishType {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  PUFFER = 'PUFFER'
}

export enum PowerUpType {
  SPEED = 'SPEED',
  IMMUNITY = 'IMMUNITY'
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Fish extends Entity {
  type: FishType;
  vx: number;
  vy: number;
  startTime: number;
  duration: number;
  peakHeight: number;
  startX: number;
  targetX: number;
  caught: boolean;
}

export interface PowerUp extends Entity {
  type: PowerUpType;
  vy: number;
  collected: boolean;
}

export interface GameStats {
  score: number;
  level: number;
  timeLeft: number;
  targetScore: number;
}
