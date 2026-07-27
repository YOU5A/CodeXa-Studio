/** 字母粒子数据 */
export interface LetterParticleData {
  id: number;
  letter: string;
  x: number;
  y: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  swayPhase: number;
  swayAmplitude: number;
  scale: number;
  delay: number;
  isTarget: boolean;
  isCollected: boolean;
}

/** 游戏阶段 */
export type GamePhase = "playing" | "success" | "failed";

/** 游戏状态 */
export interface GameState {
  phase: GamePhase;
  targetSequence: string[];
  currentTargetIndex: number;
  collectedLetters: string[];
  startTime: number;
  lastInteractionTime: number;
}