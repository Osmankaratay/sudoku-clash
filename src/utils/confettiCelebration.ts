import confetti from 'canvas-confetti';

/**
 * Fires an expansive, celebratory multi-stage confetti and fireworks display
 * when a player completes their Sudoku puzzle correctly.
 */
export function triggerVictoryCelebration(): void {
  try {
    // 1. Initial wide multi-angle confetti explosion
    const count = 200;
    const defaults = {
      origin: { y: 0.65 },
      zIndex: 9999,
    };

    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    };

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#FBBF24'],
    });

    fire(0.2, {
      spread: 60,
      colors: ['#34D399', '#60A5FA', '#F472B6', '#A78BFA'],
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.9,
      colors: ['#FDE047', '#4ADE80', '#38BDF8', '#C084FC'],
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ['#F59E0B', '#F43F5E', '#10B981'],
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });

    // 2. High-energy celebratory side fireworks bursts for 3 seconds
    const duration = 2800;
    const animationEnd = Date.now() + duration;
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#eab308', '#8b5cf6'];

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 40 * (timeLeft / duration);

      // Burst from left side
      confetti({
        particleCount: Math.floor(particleCount),
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
        zIndex: 9999,
      });

      // Burst from right side
      confetti({
        particleCount: Math.floor(particleCount),
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
        zIndex: 9999,
      });
    }, 280);
  } catch (err) {
    console.error('Celebration confetti trigger failed:', err);
  }
}
