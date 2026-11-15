import { useEffect, useRef } from "react";

type ThreeDGlobeCanvasProps = {
  className?: string;
  nodeCount?: number;
  radius?: number;
  primaryColor?: string; // Indigo/Blue
  secondaryColor?: string; // Rose/Magenta
  accentColor?: string; // Cyan
};

type Point3D = {
  x: number;
  y: number;
  z: number;
  size: number;
  colorType: "primary" | "secondary" | "accent";
  pulseSpeed: number;
  pulsePhase: number;
};

export function ThreeDGlobeCanvas({
  className = "",
  nodeCount = 180,
  radius = 210,
  primaryColor = "#6366f1", // Indigo
  secondaryColor = "#ec4899", // Rose
  accentColor = "#38bdf8", // Sky Cyan
}: ThreeDGlobeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId: number;
    let isVisible = true;

    // Track width / height and pixel ratio
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    // Intersection observer to pause when off-screen
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(canvas);

    // Generate uniformly distributed points on a sphere using Fibonacci spiral algorithm
    const points: Point3D[] = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle ~2.3999 rad

    for (let i = 0; i < nodeCount; i++) {
      const y = 1 - (i / (nodeCount - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y); // radius at y
      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      // Color variation
      const rand = Math.random();
      const colorType: "primary" | "secondary" | "accent" =
        rand > 0.65 ? "secondary" : rand > 0.35 ? "primary" : "accent";

      points.push({
        x: x * radius,
        y: y * radius,
        z: z * radius,
        size: 1.8 + Math.random() * 2.2,
        colorType,
        pulseSpeed: 1.5 + Math.random() * 2.5,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Generate orbiting ring points (like a planetary ring)
    const ringPoints: { x: number; y: number; z: number; size: number }[] = [];
    const ringCount = 80;
    const ringRadius = radius * 1.45;
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      ringPoints.push({
        x: Math.cos(angle) * ringRadius,
        y: 0,
        z: Math.sin(angle) * ringRadius,
        size: 1.2 + Math.random() * 1.5,
      });
    }

    // Rotational angles & target coordinates
    let rotX = 0.2;
    let rotY = 0;
    let targetRotX = 0.2;
    let targetRotY = 0;

    let mouseX = 0;
    let mouseY = 0;
    let isMouseOver = false;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      mouseX = e.clientX - cx;
      mouseY = e.clientY - cy;
      isMouseOver = true;

      targetRotY = (mouseX / (rect.width / 2)) * 0.9;
      targetRotX = -(mouseY / (rect.height / 2)) * 0.6 + 0.2;
    };

    const handleMouseLeave = () => {
      isMouseOver = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    // Distance threshold for drawing connection lines between points
    const maxDistance = radius * 0.46;
    const cameraDistance = 500;

    let time = 0;

    const render = () => {
      if (!isVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      time += 0.016;

      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Base idle rotation
      rotY += 0.0035;

      // Smoothly interpolate towards mouse target if interacting
      if (isMouseOver) {
        rotX += (targetRotX - rotX) * 0.05;
        rotY += (targetRotY * 0.005);
      } else {
        rotX += (0.2 - rotX) * 0.03;
      }

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Tilt matrix for the orbiting ring (tilt by ~28 degrees)
      const ringTilt = 0.48;
      const cosTilt = Math.cos(ringTilt);
      const sinTilt = Math.sin(ringTilt);

      // Draw subtle radial glow in the center behind the globe
      const ambientGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        radius * 0.1,
        centerX,
        centerY,
        radius * 1.3,
      );
      ambientGlow.addColorStop(0, "rgba(99, 102, 241, 0.2)");
      ambientGlow.addColorStop(0.5, "rgba(236, 72, 153, 0.08)");
      ambientGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = ambientGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Transform all 3D globe points
      type ProjectedPoint = {
        sx: number;
        sy: number;
        scale: number;
        z: number;
        color: string;
        size: number;
        orig: Point3D;
      };

      const projected: ProjectedPoint[] = [];

      for (let i = 0; i < points.length; i++) {
        const p = points[i];

        // Rotate around Y-axis
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.z * cosY + p.x * sinY;

        // Rotate around X-axis
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + p.y * sinX;

        // Perspective projection
        const scale = cameraDistance / (cameraDistance + z2);
        const sx = centerX + x1 * scale;
        const sy = centerY + y2 * scale;

        // Pulsing size
        const pulse = 1 + Math.sin(time * p.pulseSpeed + p.pulsePhase) * 0.22;
        const finalSize = p.size * scale * pulse;

        // Color based on type
        const color =
          p.colorType === "secondary"
            ? secondaryColor
            : p.colorType === "accent"
              ? accentColor
              : primaryColor;

        projected.push({
          sx,
          sy,
          scale,
          z: z2,
          color,
          size: finalSize,
          orig: p,
        });
      }

      // Sort points from back to front (painter's algorithm)
      projected.sort((a, b) => a.z - b.z);

      // Draw connection lines between nearby points in 3D space
      ctx.lineWidth = 1;

      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i];

        for (let j = i + 1; j < projected.length; j++) {
          const p2 = projected[j];

          // Calculate 2D distance between projected points
          const dx = p1.sx - p2.sx;
          const dy = p1.sy - p2.sy;
          const dist2D = Math.sqrt(dx * dx + dy * dy);

          // Fast rejection if too far on screen
          if (dist2D > maxDistance * 1.1) continue;

          // Calculate true 3D Euclidean distance between original points
          const origDx = p1.orig.x - p2.orig.x;
          const origDy = p1.orig.y - p2.orig.y;
          const origDz = p1.orig.z - p2.orig.z;
          const dist3D = Math.sqrt(origDx * origDx + origDy * origDy + origDz * origDz);

          if (dist3D < maxDistance) {
            const distRatio = 1 - dist3D / maxDistance;
            // Higher opacity for front-facing points
            const depthRatio = Math.max(0.1, (p1.scale + p2.scale) / 2);
            const alpha = Math.min(0.65, distRatio * depthRatio * 0.7);

            ctx.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p2.sx, p2.sy);
            ctx.stroke();
          }
        }
      }

      // Draw nodes (points) with glowing halos
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];

        // Opacity based on depth (front is brighter, back is darker)
        const depthAlpha = Math.max(0.2, Math.min(1, (p.z + radius) / (radius * 2)));

        // Node Glow Halo
        if (p.z > 0) {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, p.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(99, 102, 241, ${depthAlpha * 0.25})`;
          ctx.fill();
        }

        // Inner Core Point
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(1, p.size), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = depthAlpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Draw 3D Orbiting Ring
      ctx.lineWidth = 1.2;
      for (let i = 0; i < ringPoints.length; i++) {
        const rp = ringPoints[i];

        // Tilt the ring in 3D
        const yTilted = rp.y * cosTilt - rp.z * sinTilt;
        const zTilted = rp.z * cosTilt + rp.y * sinTilt;

        // Rotate around Y and X
        const x1 = rp.x * cosY - zTilted * sinY;
        const z1 = zTilted * cosY + rp.x * sinY;

        const y2 = yTilted * cosX - z1 * sinX;
        const z2 = z1 * cosX + yTilted * sinX;

        const scale = cameraDistance / (cameraDistance + z2);
        const sx = centerX + x1 * scale;
        const sy = centerY + y2 * scale;

        const ringAlpha = Math.max(0.15, Math.min(0.9, (z2 + ringRadius) / (ringRadius * 2)));

        ctx.beginPath();
        ctx.arc(sx, sy, rp.size * scale, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? "rgba(236, 72, 153, " + ringAlpha + ")" : "rgba(56, 189, 248, " + ringAlpha + ")";
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      observer.disconnect();
    };
  }, [nodeCount, radius, primaryColor, secondaryColor, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`block w-full h-full pointer-events-auto select-none ${className}`}
      style={{ touchAction: "none" }}
    />
  );
}
