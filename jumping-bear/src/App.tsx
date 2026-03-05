/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Timer, Star, Zap, Shield, Play, RotateCcw, ChevronRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { GameState, FishType, PowerUpType, Fish, PowerUp, GameStats } from './types';
import { 
  GAME_WIDTH, GAME_HEIGHT, BEAR_WIDTH, BEAR_HEIGHT, 
  BEAR_SPEED, JUMP_FORCE, GRAVITY, FISH_CONFIG, 
  LEVEL_TIME, MAX_LEVELS, POWERUP_DURATION 
} from './constants';
import { soundManager } from './sound';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [stats, setStats] = useState<GameStats>({
    score: 0,
    level: 1,
    timeLeft: LEVEL_TIME,
    targetScore: 10
  });

  // Game state refs for the loop
  const bearRef = useRef({
    x: GAME_WIDTH / 2 - BEAR_WIDTH / 2,
    y: GAME_HEIGHT - BEAR_HEIGHT - 20,
    vy: 0,
    isJumping: false,
    direction: 0, // -1, 0, 1
    speedMultiplier: 1,
    isImmune: false
  });

  const fishesRef = useRef<Fish[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const lastSpawnTime = useRef(0);
  const lastPowerUpSpawnTime = useRef(0);
  const timerIntervalRef = useRef<number | null>(null);
  const requestRef = useRef<number | null>(null);

  const spawnFish = useCallback((level: number) => {
    const types = [FishType.SMALL, FishType.MEDIUM, FishType.LARGE, FishType.PUFFER];
    // Increase puffer fish probability with level
    const pufferProb = Math.min(0.1 + level * 0.02, 0.4);
    const rand = Math.random();
    
    let type: FishType;
    if (rand < pufferProb) {
      type = FishType.PUFFER;
    } else {
      const otherRand = Math.random();
      if (otherRand < 0.5) type = FishType.SMALL;
      else if (otherRand < 0.8) type = FishType.MEDIUM;
      else type = FishType.LARGE;
    }

    const startFromLeft = Math.random() > 0.5;
    const startX = startFromLeft ? -50 : GAME_WIDTH + 50;
    const targetX = startFromLeft ? GAME_WIDTH + 50 : -50;
    
    // Difficulty scaling
    const speedScale = 1 + (level - 1) * 0.15;
    const duration = (2000 + Math.random() * 1000) / speedScale;
    const peakHeight = 150 + Math.random() * 250;

    const newFish: Fish = {
      type,
      x: startX,
      y: GAME_HEIGHT - 50,
      width: FISH_CONFIG[type].size,
      height: FISH_CONFIG[type].size,
      vx: 0,
      vy: 0,
      startX,
      targetX,
      startTime: Date.now(),
      duration,
      peakHeight,
      caught: false
    };

    fishesRef.current.push(newFish);
  }, []);

  const spawnPowerUp = useCallback(() => {
    const type = Math.random() > 0.5 ? PowerUpType.SPEED : PowerUpType.IMMUNITY;
    const newPowerUp: PowerUp = {
      type,
      x: Math.random() * (GAME_WIDTH - 40) + 20,
      y: -50,
      width: 30,
      height: 30,
      vy: 2 + Math.random() * 2,
      collected: false
    };
    powerUpsRef.current.push(newPowerUp);
  }, []);

  const resetLevel = useCallback((level: number) => {
    setStats(prev => ({
      ...prev,
      score: 0,
      level,
      timeLeft: LEVEL_TIME,
      targetScore: level * 10
    }));
    fishesRef.current = [];
    powerUpsRef.current = [];
    bearRef.current.x = GAME_WIDTH / 2 - BEAR_WIDTH / 2;
    bearRef.current.y = GAME_HEIGHT - BEAR_HEIGHT - 20;
    bearRef.current.vy = 0;
    bearRef.current.isJumping = false;
    bearRef.current.speedMultiplier = 1;
    bearRef.current.isImmune = false;
  }, []);

  const startGame = () => {
    setGameState(GameState.PLAYING);
    resetLevel(1);
  };

  const nextLevel = () => {
    if (stats.level >= MAX_LEVELS) {
      setGameState(GameState.WIN);
    } else {
      setGameState(GameState.LEVEL_UP);
    }
  };

  const startNextLevel = () => {
    const nextLvl = stats.level + 1;
    resetLevel(nextLvl);
    setGameState(GameState.PLAYING);
  };

  const restartLevel = () => {
    resetLevel(stats.level);
    setGameState(GameState.PLAYING);
  };

  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;

    const now = Date.now();
    const bear = bearRef.current;

    // Bear movement
    bear.x += bear.direction * BEAR_SPEED * bear.speedMultiplier;
    bear.x = Math.max(0, Math.min(GAME_WIDTH - BEAR_WIDTH, bear.x));

    // Bear jumping
    if (bear.isJumping) {
      bear.y += bear.vy;
      bear.vy += GRAVITY;
      if (bear.y >= GAME_HEIGHT - BEAR_HEIGHT - 20) {
        bear.y = GAME_HEIGHT - BEAR_HEIGHT - 20;
        bear.vy = 0;
        bear.isJumping = false;
      }
    }

    // Spawn fish
    const spawnInterval = Math.max(2000 - (stats.level - 1) * 100, 500);
    if (now - lastSpawnTime.current > spawnInterval) {
      spawnFish(stats.level);
      lastSpawnTime.current = now;
    }

    // Spawn power-ups
    if (now - lastPowerUpSpawnTime.current > 10000) {
      if (Math.random() < 0.3) {
        spawnPowerUp();
      }
      lastPowerUpSpawnTime.current = now;
    }

    // Update fish (sine wave movement)
    fishesRef.current = fishesRef.current.filter(fish => {
      if (fish.caught) return false;
      
      const elapsed = now - fish.startTime;
      const progress = elapsed / fish.duration;
      
      if (progress >= 1) return false;

      // Horizontal linear movement
      fish.x = fish.startX + (fish.targetX - fish.startX) * progress;
      
      // Vertical sine wave movement (parabolic arc)
      // y = ground - peak * sin(pi * progress)
      fish.y = (GAME_HEIGHT - 50) - fish.peakHeight * Math.sin(Math.PI * progress);

      // Collision detection
      const bearRect = { x: bear.x, y: bear.y, w: BEAR_WIDTH, h: BEAR_HEIGHT };
      const fishRect = { x: fish.x, y: fish.y, w: fish.width, h: fish.height };

      if (
        bearRect.x < fishRect.x + fishRect.w &&
        bearRect.x + bearRect.w > fishRect.x &&
        bearRect.y < fishRect.y + fishRect.h &&
        bearRect.y + bearRect.h > fishRect.y
      ) {
        if (fish.type === FishType.PUFFER) {
          if (!bear.isImmune) {
            soundManager.playUhOh();
            setStats(prev => ({ ...prev, score: Math.max(0, prev.score + FISH_CONFIG[fish.type].points) }));
          }
        } else {
          soundManager.playCatch();
          setStats(prev => ({ ...prev, score: prev.score + FISH_CONFIG[fish.type].points }));
          // Visual effect
          confetti({
            particleCount: 10,
            spread: 30,
            origin: { x: (fish.x + fish.width/2) / GAME_WIDTH, y: (fish.y + fish.height/2) / GAME_HEIGHT },
            colors: [FISH_CONFIG[fish.type].color]
          });
        }
        fish.caught = true;
        return false;
      }

      return true;
    });

    // Update power-ups
    powerUpsRef.current = powerUpsRef.current.filter(pu => {
      if (pu.collected) return false;
      pu.y += pu.vy;
      if (pu.y > GAME_HEIGHT) return false;

      // Collision
      const bearRect = { x: bear.x, y: bear.y, w: BEAR_WIDTH, h: BEAR_HEIGHT };
      if (
        bearRect.x < pu.x + pu.width &&
        bearRect.x + bearRect.w > pu.x &&
        bearRect.y < pu.y + pu.height &&
        bearRect.y + bearRect.h > pu.y
      ) {
        soundManager.playPowerUp();
        if (pu.type === PowerUpType.SPEED) {
          bear.speedMultiplier = 2;
          setTimeout(() => { bear.speedMultiplier = 1; }, POWERUP_DURATION.SPEED);
        } else {
          bear.isImmune = true;
          setTimeout(() => { bear.isImmune = false; }, POWERUP_DURATION.IMMUNITY);
        }
        pu.collected = true;
        return false;
      }
      return true;
    });

  }, [gameState, stats.level, spawnFish, spawnPowerUp]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, '#E0F2FE');
    gradient.addColorStop(1, '#7DD3FC');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Water at bottom
    ctx.fillStyle = '#0EA5E9';
    ctx.fillRect(0, GAME_HEIGHT - 40, GAME_WIDTH, 40);

    // Draw Power-ups
    powerUpsRef.current.forEach(pu => {
      ctx.save();
      ctx.fillStyle = pu.type === PowerUpType.SPEED ? '#F59E0B' : '#10B981';
      ctx.beginPath();
      ctx.arc(pu.x + pu.width/2, pu.y + pu.height/2, pu.width/2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(pu.type === PowerUpType.SPEED ? '⚡' : '🛡️', pu.x + pu.width/2, pu.y + pu.height/2 + 6);
      ctx.restore();
    });

    // Draw Fish
    fishesRef.current.forEach(fish => {
      ctx.save();
      ctx.fillStyle = FISH_CONFIG[fish.type].color;
      
      // Fish body
      ctx.beginPath();
      ctx.ellipse(fish.x + fish.width/2, fish.y + fish.height/2, fish.width/2, fish.height/3, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Tail
      ctx.beginPath();
      const tailX = fish.startX < fish.targetX ? fish.x : fish.x + fish.width;
      ctx.moveTo(tailX, fish.y + fish.height/2);
      ctx.lineTo(tailX + (fish.startX < fish.targetX ? -10 : 10), fish.y + fish.height/2 - 10);
      ctx.lineTo(tailX + (fish.startX < fish.targetX ? -10 : 10), fish.y + fish.height/2 + 10);
      ctx.fill();

      // Eye
      ctx.fillStyle = 'white';
      const eyeX = fish.startX < fish.targetX ? fish.x + fish.width - 8 : fish.x + 8;
      ctx.beginPath();
      ctx.arc(eyeX, fish.y + fish.height/2 - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(eyeX, fish.y + fish.height/2 - 2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      if (fish.type === FishType.PUFFER) {
        // Spikes for puffer
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(fish.x + fish.width/2, fish.y + fish.height/2);
          ctx.lineTo(
            fish.x + fish.width/2 + Math.cos(angle) * (fish.width/2 + 5),
            fish.y + fish.height/2 + Math.sin(angle) * (fish.height/2 + 5)
          );
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    // Draw Bear
    const bear = bearRef.current;
    ctx.save();
    if (bear.isImmune) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#10B981';
    }
    ctx.fillStyle = '#78350F'; // Brown bear
    // Body
    ctx.beginPath();
    ctx.roundRect(bear.x, bear.y, BEAR_WIDTH, BEAR_HEIGHT, 10);
    ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.arc(bear.x + 10, bear.y, 10, 0, Math.PI * 2);
    ctx.arc(bear.x + BEAR_WIDTH - 10, bear.y, 10, 0, Math.PI * 2);
    ctx.fill();
    // Face
    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.ellipse(bear.x + BEAR_WIDTH/2, bear.y + BEAR_HEIGHT/2 + 5, 20, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(bear.x + BEAR_WIDTH/2 - 10, bear.y + 20, 3, 0, Math.PI * 2);
    ctx.arc(bear.x + BEAR_WIDTH/2 + 10, bear.y + 20, 3, 0, Math.PI * 2);
    ctx.fill();
    // Nose
    ctx.beginPath();
    ctx.arc(bear.x + BEAR_WIDTH/2, bear.y + BEAR_HEIGHT/2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  }, [gameState]);

  const loop = useCallback(() => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(loop);
  }, [update, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  // Timer logic
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      timerIntervalRef.current = window.setInterval(() => {
        setStats(prev => {
          if (prev.timeLeft <= 1) {
            clearInterval(timerIntervalRef.current!);
            setGameState(GameState.GAME_OVER);
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [gameState]);

  // Check for level completion
  useEffect(() => {
    if (gameState === GameState.PLAYING && stats.score >= stats.targetScore) {
      nextLevel();
    }
  }, [stats.score, stats.targetScore, gameState]);

  // Input handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') bearRef.current.direction = -1;
      if (e.key === 'ArrowRight') bearRef.current.direction = 1;
      if (e.key === ' ' || e.key === 'ArrowUp') {
        if (!bearRef.current.isJumping) {
          bearRef.current.isJumping = true;
          bearRef.current.vy = JUMP_FORCE;
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && bearRef.current.direction === -1) bearRef.current.direction = 0;
      if (e.key === 'ArrowRight' && bearRef.current.direction === 1) bearRef.current.direction = 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Touch controls
  const handleTouchStart = (dir: number) => {
    bearRef.current.direction = dir;
  };
  const handleTouchEnd = () => {
    bearRef.current.direction = 0;
  };
  const handleJump = () => {
    if (!bearRef.current.isJumping) {
      bearRef.current.isJumping = true;
      bearRef.current.vy = JUMP_FORCE;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center font-sans overflow-hidden select-none">
      <div 
        className="relative bg-white shadow-2xl overflow-hidden"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      >
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="block"
        />

        {/* HUD */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-1">
            <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-1 flex items-center gap-2 shadow-sm border border-white/20">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-slate-800">{stats.score} / {stats.targetScore}</span>
            </div>
            <div className="bg-white/80 backdrop-blur-sm rounded-full px-4 py-1 flex items-center gap-2 shadow-sm border border-white/20">
              <Star className="w-4 h-4 text-blue-500" />
              <span className="font-bold text-slate-800">Level {stats.level}</span>
            </div>
          </div>
          
          <div className={`bg-white/80 backdrop-blur-sm rounded-full px-4 py-1 flex items-center gap-2 shadow-sm border border-white/20 ${stats.timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-slate-800'}`}>
            <Timer className="w-4 h-4" />
            <span className="font-bold">{stats.timeLeft}s</span>
          </div>
        </div>

        {/* Power-up Indicators */}
        <div className="absolute top-24 right-4 flex flex-col gap-2 pointer-events-none">
          {bearRef.current.speedMultiplier > 1 && (
            <motion.div 
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="bg-amber-500 text-white rounded-full p-2 shadow-lg"
            >
              <Zap className="w-5 h-5" />
            </motion.div>
          )}
          {bearRef.current.isImmune && (
            <motion.div 
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="bg-emerald-500 text-white rounded-full p-2 shadow-lg"
            >
              <Shield className="w-5 h-5" />
            </motion.div>
          )}
        </div>

        {/* Overlays */}
        <AnimatePresence>
          {gameState === GameState.START && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 text-center"
            >
              <motion.div
                initial={{ y: -20 }} animate={{ y: 0 }}
                className="mb-8"
              >
                <div className="w-24 h-24 bg-amber-700 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl">
                  <Star className="w-12 h-12 text-amber-200 fill-amber-200" />
                </div>
                <h1 className="text-4xl font-black tracking-tighter mb-2 italic">JUMPING BEAR</h1>
                <p className="text-slate-400 text-sm">Catch fish, reach the target, and avoid the puffers!</p>
              </motion.div>

              <div className="grid grid-cols-2 gap-4 mb-8 text-left w-full max-w-xs">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-3 h-3 rounded-full bg-blue-400" /> Small (1pt)
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-3 h-3 rounded-full bg-blue-600" /> Medium (2pt)
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-3 h-3 rounded-full bg-blue-800" /> Large (3pt)
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-3 h-3 rounded-full bg-red-500" /> Puffer (-2pt)
                </div>
              </div>

              <button 
                onClick={startGame}
                className="group relative bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-xl flex items-center gap-3 transition-transform active:scale-95 hover:scale-105"
              >
                <Play className="w-6 h-6 fill-slate-900" />
                PLAY NOW
              </button>
            </motion.div>
          )}

          {gameState === GameState.LEVEL_UP && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
              className="absolute inset-0 bg-emerald-500/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 text-center"
            >
              <Trophy className="w-20 h-20 mb-4 text-emerald-200" />
              <h2 className="text-5xl font-black mb-2 italic">LEVEL COMPLETE!</h2>
              <p className="text-emerald-100 mb-8">You've reached Level {stats.level}!</p>
              <button 
                onClick={startNextLevel}
                className="bg-white text-emerald-600 px-8 py-4 rounded-2xl font-black text-xl flex items-center gap-3 transition-transform active:scale-95 shadow-xl"
              >
                NEXT LEVEL
                <ChevronRight className="w-6 h-6" />
              </button>
            </motion.div>
          )}

          {gameState === GameState.GAME_OVER && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
              className="absolute inset-0 bg-red-500/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 text-center"
            >
              <RotateCcw className="w-20 h-20 mb-4 text-red-200" />
              <h2 className="text-5xl font-black mb-2 italic">TIME'S UP!</h2>
              <p className="text-red-100 mb-8">You needed {stats.targetScore} points but got {stats.score}.</p>
              <button 
                onClick={restartLevel}
                className="bg-white text-red-600 px-8 py-4 rounded-2xl font-black text-xl flex items-center gap-3 transition-transform active:scale-95 shadow-xl"
              >
                TRY AGAIN
                <RotateCcw className="w-6 h-6" />
              </button>
            </motion.div>
          )}

          {gameState === GameState.WIN && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="absolute inset-0 bg-amber-500 flex flex-col items-center justify-center text-white p-8 text-center"
            >
              <Trophy className="w-32 h-32 mb-6 text-white animate-bounce" />
              <h2 className="text-6xl font-black mb-4 italic">YOU ARE THE BEAR KING!</h2>
              <p className="text-amber-100 text-xl mb-12">You've completed all 20 levels!</p>
              <button 
                onClick={() => setGameState(GameState.START)}
                className="bg-white text-amber-600 px-12 py-6 rounded-3xl font-black text-2xl transition-transform active:scale-95 shadow-2xl"
              >
                PLAY AGAIN
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Controls */}
        <div className="absolute bottom-10 left-0 right-0 px-6 flex justify-between items-end pointer-events-none">
          <div className="flex gap-4 pointer-events-auto">
            <button 
              onMouseDown={() => handleTouchStart(-1)} onMouseUp={handleTouchEnd}
              onTouchStart={() => handleTouchStart(-1)} onTouchEnd={handleTouchEnd}
              className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 active:bg-white/40"
            >
              <ChevronRight className="w-8 h-8 text-white rotate-180" />
            </button>
            <button 
              onMouseDown={() => handleTouchStart(1)} onMouseUp={handleTouchEnd}
              onTouchStart={() => handleTouchStart(1)} onTouchEnd={handleTouchEnd}
              className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 active:bg-white/40"
            >
              <ChevronRight className="w-8 h-8 text-white" />
            </button>
          </div>
          <button 
            onMouseDown={handleJump} onTouchStart={handleJump}
            className="w-20 h-20 bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center border-2 border-white/50 active:scale-90 transition-transform pointer-events-auto shadow-lg"
          >
            <Zap className="w-10 h-10 text-white fill-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
