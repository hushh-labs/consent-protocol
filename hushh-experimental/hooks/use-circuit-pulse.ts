import { useRef, useEffect, useCallback } from "react";

interface Particle {
  x: number;
  y: number;
  speed: { x: number; y: number };
  ang: number;
  mag: number;
  upd: () => void;
}

interface UseCircuitPulseReturn {
  ref: React.RefObject<HTMLCanvasElement | null>;
}

export const useCircuitPulse = (
  enabled: boolean = false
): UseCircuitPulseReturn => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const particlesRef = useRef<Particle[]>([]);
  const speedRef = useRef(3); // Reduced from 5 to 3 for slower movement
  const periodRef = useRef(2000); // Increased from 1000 to 2000ms for slower pulse
  const isVisibleRef = useRef(true);
  const frameCountRef = useRef(0);
  const frameSkipRef = useRef(2); // Only update every 2nd frame for better performance
  const pulseTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const Clear = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      // Check if dark mode is active
      const isDarkMode = document.documentElement.classList.contains("dark");

      if (isDarkMode) {
        // Dark mode: dark background with subtle trails
        ctx.fillStyle = "rgba(0,0,0,0.05)";
      } else {
        // Light mode: white background with subtle trails
        ctx.fillStyle = "rgba(255,255,255,0.05)";
      }

      ctx.fillRect(0, 0, width, height);
    },
    []
  );

  const createParticle = useCallback(
    (
      x: number,
      y: number,
      speed: { x: number; y: number },
      c: string,
      ctx: CanvasRenderingContext2D
    ): Particle => {
      return {
        x,
        y,
        speed,
        ang: 0,
        mag: 0,
        upd: function () {
          // ORIGINAL ORGANIC MOVEMENT: Creates flowing, neural-like particle trails
          const isDarkMode =
            document.documentElement.classList.contains("dark");
          let currentColor = c;

          if (isDarkMode) {
            // Dark mode: yellow to orange gradient (brand colors)
            const darkColors = [
              "hsl(45,100%,50%)", // Yellow
              "hsl(40,100%,50%)", // Orange-yellow
              "hsl(35,100%,50%)", // Orange
              "hsl(30,100%,50%)", // Dark orange
            ];
            // POSITION-BASED COLORING: Creates flowing gradient trails
            const colorIndex =
              Math.floor((this.x + this.y) / 50) % darkColors.length;
            currentColor = darkColors[colorIndex];
          } else {
            // Light mode: blue to cyan gradient (brand colors)
            const lightColors = [
              "hsl(200,100%,50%)", // Blue
              "hsl(195,100%,50%)", // Blue-cyan
              "hsl(190,100%,50%)", // Cyan
              "hsl(185,100%,50%)", // Light cyan
            ];
            // POSITION-BASED COLORING: Creates flowing gradient trails
            const colorIndex =
              Math.floor((this.x + this.y) / 50) % lightColors.length;
            currentColor = lightColors[colorIndex];
          }

          ctx.strokeStyle = currentColor;
          ctx.lineWidth = 1; // THINNER LINES: More delicate circuit traces
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(this.x, this.y);

          // ORIGINAL PHYSICS: Velocity-based movement with controlled organic randomness
          this.x += this.speed.x;
          this.y += this.speed.y;

          ctx.lineTo(this.x, this.y);
          ctx.stroke();

          // Calculate current angle and magnitude for potential direction changes
          this.ang = Math.atan2(this.speed.y, this.speed.x);
          this.mag = Math.sqrt(this.speed.x ** 2 + this.speed.y ** 2);

          // 90-DEGREE GRID MOVEMENT: Only 90-degree turns allowed (no 180° reversals)
          // Creates structured circuit-like patterns that branch at right angles only
          var op = [
            this.ang, // Continue straight (0° change)
            this.ang + Math.PI / 2, // Turn right 90°
            this.ang + (3 * Math.PI) / 2, // Turn left 90° (equivalent to -90°)
          ];
          var ch = Math.floor(Math.random() * op.length);
          if (Math.random() < 0.03) {
            // GRID-BASED DIRECTION CHANGE: Creates orthogonal circuit patterns
            this.speed.x = Math.cos(op[ch]) * this.mag;
            this.speed.y = Math.sin(op[ch]) * this.mag;
          }
        },
      };
    },
    []
  );

  const pulse = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      // Only create particles if visible and not too many already
      if (!isVisibleRef.current || particlesRef.current.length > 100) return;

      // Check if dark mode is active for appropriate colors
      const isDarkMode = document.documentElement.classList.contains("dark");

      if (isDarkMode) {
        // Dark mode: blue-green colors (original)
        var h = Math.random() * (210 - 150) + 150;
      } else {
        // Light mode: darker colors for visibility on white background
        var h = Math.random() * (220 - 180) + 180; // Blue to purple range
      }

      // 90-DEGREE GRID EMISSION: 14 particles starting at exact 90° intervals
      // Creates structured circuit patterns that align with grid coordinates
      for (var i = 0; i < 14; i++) {
        // Calculate starting angle at exact 90° intervals (0°, 90°, 180°, 270°)
        // Distribute 14 particles across 4 cardinal directions
        const angleIndex = i % 4; // 0, 1, 2, 3 (for 0°, 90°, 180°, 270°)
        const startAngle = (angleIndex * Math.PI) / 2; // Convert to radians

        particlesRef.current.push(
          createParticle(
            width / 2, // Exact center X
            height / 2, // Exact center Y
            {
              // 90-DEGREE ALIGNED: Start at exact cardinal directions only
              x: Math.cos(startAngle) * speedRef.current,
              y: Math.sin(startAngle) * speedRef.current,
            },
            "hsl(" + h + ",100%,50%)",
            ctx
          )
        );
      }

      // Schedule next pulse only if visible
      if (isVisibleRef.current) {
        // Clear any existing timeout
        if (pulseTimeoutRef.current) {
          clearTimeout(pulseTimeoutRef.current);
        }

        pulseTimeoutRef.current = setTimeout(() => {
          if (ctx && canvasRef.current && isVisibleRef.current) {
            pulse(ctx, canvasRef.current.width, canvasRef.current.height);
          }
        }, periodRef.current);
      }
    },
    [createParticle]
  );

  const gameMove = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number) => {
      // Skip frames for better performance when not visible
      frameCountRef.current++;
      if (frameCountRef.current % frameSkipRef.current !== 0) {
        animationRef.current = requestAnimationFrame(() =>
          gameMove(ctx, width, height)
        );
        return;
      }

      // Only animate if visible
      if (isVisibleRef.current) {
        requestAnimationFrame(() => gameMove(ctx, width, height));
        Clear(ctx, width, height);

        // ORIGINAL ORGANIC UPDATE: Particles move with controlled randomness
        for (var i = particlesRef.current.length - 1; i >= 0; i--) {
          particlesRef.current[i].upd(); // Simple update call - no path parameters needed

          // Remove particles that have gone too far off-screen
          if (
            particlesRef.current[i].x < 0 ||
            particlesRef.current[i].x > width ||
            particlesRef.current[i].y < 0 ||
            particlesRef.current[i].y > height
          ) {
            particlesRef.current.splice(i, 1);
          }
        }
      } else {
        // If not visible, just continue the loop but don't animate
        animationRef.current = requestAnimationFrame(() =>
          gameMove(ctx, width, height)
        );
      }
    },
    [Clear]
  );

  // Handle visibility changes
  const handleVisibilityChange = useCallback(() => {
    isVisibleRef.current = !document.hidden;

    // Adjust performance based on visibility
    if (isVisibleRef.current) {
      frameSkipRef.current = 1; // Full frame rate when visible
      periodRef.current = 2000; // Normal pulse rate

      // Restart pulse if it was stopped
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          pulse(ctx, canvasRef.current.width, canvasRef.current.height);
        }
      }
    } else {
      frameSkipRef.current = 4; // Reduced frame rate when not visible
      periodRef.current = 4000; // Slower pulse rate when not visible

      // Clear pulse timeout when not visible
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
        pulseTimeoutRef.current = undefined;
      }
    }
  }, []);

  // Handle window focus/blur
  const handleWindowFocus = useCallback(() => {
    isVisibleRef.current = true;
    frameSkipRef.current = 1;
    periodRef.current = 2000;

    // Restart pulse
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        pulse(ctx, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }, [pulse]);

  const handleWindowBlur = useCallback(() => {
    isVisibleRef.current = false;
    frameSkipRef.current = 4;
    periodRef.current = 4000;

    // Clear pulse timeout
    if (pulseTimeoutRef.current) {
      clearTimeout(pulseTimeoutRef.current);
      pulseTimeoutRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    // If animation is disabled, don't start anything
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    const resizeCanvas = () => {
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    // Initial resize
    resizeCanvas();

    // Start pulse and gameMove like the original code
    if (ctx && canvas) {
      pulse(ctx, canvas.width, canvas.height);
      gameMove(ctx, canvas.width, canvas.height);
    }

    // Handle window resize
    window.addEventListener("resize", resizeCanvas);

    // Handle visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("blur", handleWindowBlur);

    // Cleanup
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
      window.removeEventListener("resize", resizeCanvas);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
      particlesRef.current = [];
    };
  }, [
    enabled,
    pulse,
    gameMove,
    handleVisibilityChange,
    handleWindowFocus,
    handleWindowBlur,
  ]);

  return { ref: canvasRef };
};
