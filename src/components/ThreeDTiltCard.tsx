import { useState, useRef, ReactNode, MouseEvent } from "react";

type ThreeDTiltCardProps = {
  children: ReactNode;
  className?: string;
  maxTilt?: number; // max tilt in degrees (default: 8)
  scale?: number; // scale on hover (default: 1.01)
  glareOpacity?: number; // glare intensity (default: 0.12)
};

export function ThreeDTiltCard({
  children,
  className = "",
  maxTilt = 7,
  scale = 1.01,
  glareOpacity = 0.14,
}: ThreeDTiltCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transformStyle, setTransformStyle] = useState("");
  const [glareStyle, setGlareStyle] = useState({
    opacity: 0,
    background: "none",
  });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const tiltX = -((y - centerY) / centerY) * maxTilt;
    const tiltY = ((x - centerX) / centerX) * maxTilt;

    setTransformStyle(
      `perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) scale3d(${scale}, ${scale}, ${scale})`,
    );

    // Specular glare effect moving with pointer
    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setGlareStyle({
      opacity: glareOpacity,
      background: `radial-gradient(circle 280px at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.45), rgba(99, 102, 241, 0.15) 40%, transparent 80%)`,
    });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTransformStyle(
      "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
    );
    setGlareStyle((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative will-change-transform ${className}`}
      style={{
        transform: transformStyle,
        transition: isHovered
          ? "transform 0.08s ease-out"
          : "transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)",
        transformStyle: "preserve-3d",
      }}
    >
      {/* Dynamic Specular Glare Layer */}
      <div
        className="pointer-events-none absolute inset-0 z-30 rounded-[inherit] overflow-hidden transition-opacity duration-300"
        style={{
          opacity: glareStyle.opacity,
          background: glareStyle.background,
        }}
      />

      {/* Card Content with 3D Depth */}
      <div style={{ transform: "translateZ(18px)", transformStyle: "preserve-3d" }}>
        {children}
      </div>
    </div>
  );
}
