import React, { useEffect, useRef } from "react";

/**
 * AnimatedBackground Component
 * Ultra-slow, high-clarity generative animated background in Grey & White tones.
 * Features soothing, ultra-gentle floating geometric nodes, crystal-clear interconnecting mesh lines,
 * slowly rotating geometric rings, and peaceful organic wave fields.
 * 
 * Performance & DevOps Optimized:
 * - 60 FPS silky smooth motion
 * - Pre-allocated particle & ring pools (Zero GC pressure)
 * - Auto-pauses when browser tab is inactive
 * - Respects prefers-reduced-motion
 */
export const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let isVisible = true;

    // High clarity particle count
    const PARTICLE_COUNT = 75;
    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseAlpha: number;
      phase: number;
      pulseSpeed: number;
      isWhite: boolean;
    }

    // Floating geometric rings
    interface Ring {
      x: number;
      y: number;
      radius: number;
      vx: number;
      vy: number;
      rotation: number;
      rotSpeed: number;
      alpha: number;
    }

    const particles: Particle[] = [];
    const rings: Ring[] = [];

    const initElements = (w: number, h: number) => {
      particles.length = 0;
      rings.length = 0;

      // Initialize Particles with ULTRA-SLOW velocity for smooth, peaceful motion
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.15,
          radius: Math.random() * 4.2 + 2.0,
          baseAlpha: Math.random() * 0.4 + 0.5,
          phase: Math.random() * Math.PI * 2,
          pulseSpeed: 0.005 + Math.random() * 0.008,
          isWhite: Math.random() > 0.45
        });
      }

      // Initialize 6 Floating Geometric Rings with ULTRA-SLOW rotation and drift
      for (let i = 0; i < 6; i++) {
        rings.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: Math.random() * 65 + 35,
          vx: (Math.random() - 0.5) * 0.08,
          vy: (Math.random() - 0.5) * 0.08,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.002,
          alpha: Math.random() * 0.35 + 0.25
        });
      }
    };

    const handleResize = () => {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.scale(dpr, dpr);
      if (particles.length === 0) {
        initElements(width, height);
      }
    };

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(handleResize, 150);
    };

    handleResize();
    window.addEventListener("resize", onResize, { passive: true });

    // Handle tab visibility
    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        loop();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Interactive mouse field
    let mouseX = -1000;
    let mouseY = -1000;
    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    let wavePhase = 0;

    const loop = () => {
      if (!isVisible) return;

      animFrameId = requestAnimationFrame(loop);

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Crisp, high-clarity Grey & White gradient backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, "#cbd5e1");   // Slate-300
      bgGrad.addColorStop(0.3, "#f1f5f9"); // Slate-100
      bgGrad.addColorStop(0.7, "#ffffff"); // Pure White
      bgGrad.addColorStop(1, "#94a3b8");   // Slate-400
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // ULTRA-SLOW Wave oscillations (0.003 phase increment)
      wavePhase += 0.003;

      // Wave 1: Crisp Pure White (Bold & Vivid)
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 3.2;
      for (let x = 0; x <= width; x += 20) {
        const y =
          height * 0.35 +
          Math.sin(x * 0.004 + wavePhase) * 65 +
          Math.cos(x * 0.002 - wavePhase * 0.8) * 35;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Wave 2: Deep Slate Grey (#334155 / Slate-700)
      ctx.beginPath();
      ctx.strokeStyle = "rgba(51, 65, 85, 0.45)";
      ctx.lineWidth = 2.8;
      for (let x = 0; x <= width; x += 20) {
        const y =
          height * 0.55 +
          Math.cos(x * 0.005 - wavePhase * 0.9) * 75 +
          Math.sin(x * 0.0025 + wavePhase * 1.3) * 40;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Wave 3: Medium Slate Accent (#64748B / Slate-500)
      ctx.beginPath();
      ctx.strokeStyle = "rgba(100, 116, 139, 0.4)";
      ctx.lineWidth = 2.4;
      for (let x = 0; x <= width; x += 20) {
        const y =
          height * 0.75 +
          Math.sin(x * 0.0035 + wavePhase * 0.7) * 50 +
          Math.cos(x * 0.006 + wavePhase * 1.2) * 30;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      if (prefersReducedMotion) return;

      // Render ULTRA-SLOW Floating Geometric Rings (Grey & White)
      for (let i = 0; i < rings.length; i++) {
        const r = rings[i];
        r.x += r.vx;
        r.y += r.vy;
        r.rotation += r.rotSpeed;

        if (r.x < -70) r.x = width + 70;
        if (r.x > width + 70) r.x = -70;
        if (r.y < -70) r.y = height + 70;
        if (r.y > height + 70) r.y = -70;

        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.rotation);

        // Outer Ring
        ctx.beginPath();
        ctx.arc(0, 0, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = i % 2 === 0 ? "rgba(255, 255, 255, 0.85)" : "rgba(51, 65, 85, 0.55)";
        ctx.lineWidth = 2.0;
        ctx.setLineDash([10, 10]);
        ctx.stroke();

        // Inner Dot
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? "rgba(255, 255, 255, 0.9)" : "rgba(71, 85, 105, 0.7)";
        ctx.fill();

        ctx.restore();
      }

      // Render ULTRA-SLOW Particles & Crystal-Clear Constellation Lines
      const maxDistance = 180;

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        p.phase += p.pulseSpeed;
        const currentAlpha = p.baseAlpha + Math.sin(p.phase) * 0.2;

        // Interactive mouse avoidance (Subtle)
        const dxMouse = p.x - mouseX;
        const dyMouse = p.y - mouseY;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        if (distMouse < 160) {
          const force = (160 - distMouse) / 160;
          p.x += (dxMouse / distMouse) * force * 0.4;
          p.y += (dyMouse / distMouse) * force * 0.4;
        }

        // Draw Particle Node with glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        if (p.isWhite) {
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1.0, currentAlpha + 0.3)})`;
          ctx.shadowColor = "rgba(255, 255, 255, 0.9)";
          ctx.shadowBlur = 10;
        } else {
          ctx.fillStyle = `rgba(51, 65, 85, ${Math.min(0.95, currentAlpha + 0.25)})`;
          ctx.shadowColor = "rgba(71, 85, 105, 0.7)";
          ctx.shadowBlur = 6;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw Constellation Lines (Bright & Clear)
        for (let j = i + 1; j < PARTICLE_COUNT; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistance * maxDistance) {
            const dist = Math.sqrt(distSq);
            const lineAlpha = (1 - dist / maxDistance) * 0.55;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);

            if (p.isWhite && p2.isWhite) {
              ctx.strokeStyle = `rgba(255, 255, 255, ${lineAlpha * 1.5})`;
              ctx.lineWidth = 1.6;
            } else {
              ctx.strokeStyle = `rgba(71, 85, 105, ${lineAlpha * 1.2})`;
              ctx.lineWidth = 1.3;
            }
            ctx.stroke();
          }
        }
      }
    };

    loop();

    return () => {
      cancelAnimationFrame(animFrameId);
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none transform-gpu"
      aria-hidden="true"
    />
  );
};

export default AnimatedBackground;
