import React, { useEffect, useRef, useState } from "react";

interface PawTrail {
  id: number;
  x: number;
  y: number;
  rotation: number;
}

export const CustomCursor: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [trails, setTrails] = useState<PawTrail[]>([]);

  const cursorRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: -100, y: -100 });
  const currentPos = useRef({ x: -100, y: -100 });
  const isClicking = useRef(false);
  const isHovering = useRef(false);
  const isVisible = useRef(false);
  const lastTrailPos = useRef({ x: -100, y: -100, time: 0 });
  const trailIdCounter = useRef(0);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    // Check for touch / mobile device
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    const hasHover = window.matchMedia("(hover: hover)").matches;
    const isTouch = !hasFinePointer || !hasHover;

    if (isTouch) {
      setIsEnabled(false);
      return;
    }

    setIsEnabled(true);
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Listen for changes in reduced motion preference
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches;
    };
    motionQuery.addEventListener("change", handleMotionChange);

    document.body.classList.add("custom-cursor-active");

    const onMouseMove = (e: MouseEvent) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;

      if (!isVisible.current) {
        isVisible.current = true;
        currentPos.current.x = e.clientX;
        currentPos.current.y = e.clientY;
        if (cursorRef.current) {
          cursorRef.current.style.opacity = "1";
        }
      }

      // Check for paw trail creation
      if (!prefersReducedMotion.current) {
        const now = Date.now();
        const dx = e.clientX - lastTrailPos.current.x;
        const dy = e.clientY - lastTrailPos.current.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 32 && now - lastTrailPos.current.time > 80) {
          const rotation = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
          const newTrail: PawTrail = {
            id: ++trailIdCounter.current,
            x: e.clientX,
            y: e.clientY,
            rotation: (rotation % 40) - 20,
          };

          lastTrailPos.current = { x: e.clientX, y: e.clientY, time: now };

          setTrails((prev) => {
            const updated = [...prev.slice(-9), newTrail];
            return updated;
          });

          // Automatically clean up trail item after animation finishes
          setTimeout(() => {
            setTrails((prev) => prev.filter((t) => t.id !== newTrail.id));
          }, 700);
        }
      }
    };

    const onMouseDown = () => {
      isClicking.current = true;
    };

    const onMouseUp = () => {
      isClicking.current = false;
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'button, a, input, select, textarea, [role="button"], label, [data-interactive="true"]'
        )
      ) {
        isHovering.current = true;
      } else {
        isHovering.current = false;
      }
    };

    const onMouseLeave = () => {
      isVisible.current = false;
      if (cursorRef.current) {
        cursorRef.current.style.opacity = "0";
      }
    };

    const onMouseEnter = () => {
      isVisible.current = true;
      if (cursorRef.current) {
        cursorRef.current.style.opacity = "1";
      }
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown, { passive: true });
    window.addEventListener("mouseup", onMouseUp, { passive: true });
    window.addEventListener("mouseover", onMouseOver, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    // Smooth 60fps animation loop using requestAnimationFrame
    let animationFrameId: number;

    const renderLoop = () => {
      if (cursorRef.current) {
        if (prefersReducedMotion.current) {
          currentPos.current.x = mousePos.current.x;
          currentPos.current.y = mousePos.current.y;
        } else {
          // Organic interpolation factor
          currentPos.current.x +=
            (mousePos.current.x - currentPos.current.x) * 0.38;
          currentPos.current.y +=
            (mousePos.current.y - currentPos.current.y) * 0.38;
        }

        let scale = 1;
        let rotation = 0;

        if (isClicking.current && !prefersReducedMotion.current) {
          scale = 0.78;
          rotation = -10;
        } else if (isHovering.current && !prefersReducedMotion.current) {
          scale = 1.22;
          rotation = 5;
        }

        cursorRef.current.style.transform = `translate3d(${currentPos.current.x}px, ${currentPos.current.y}px, 0) translate(-40%, -35%) scale(${scale}) rotate(${rotation}deg)`;
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      motionQuery.removeEventListener("change", handleMotionChange);
      cancelAnimationFrame(animationFrameId);
      document.body.classList.remove("custom-cursor-active");
    };
  }, []);

  if (!isEnabled) return null;

  return (
    <>
      {/* Subtle Paw Trail Prints */}
      {trails.map((t) => (
        <div
          key={t.id}
          className="paw-trail-print"
          style={
            {
              left: `${t.x}px`,
              top: `${t.y}px`,
              "--paw-rot": `${t.rotation}deg`,
            } as React.CSSProperties
          }
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            className="text-brand-pink/50 opacity-60"
          >
            {/* Main Pad */}
            <path
              d="M7.5 13.5C5.5 13.5 4 15 4 17C4 19 6 20.5 12 20.5C18 20.5 20 19 20 17C20 15 18.5 13.5 16.5 13.5C15 13.5 13.8 14.5 12 14.5C10.2 14.5 9 13.5 7.5 13.5Z"
              fill="currentColor"
            />
            {/* 4 Toe Pads */}
            <ellipse cx="5" cy="10" rx="1.8" ry="2.2" fill="currentColor" />
            <ellipse cx="9.5" cy="7.5" rx="1.8" ry="2.4" fill="currentColor" />
            <ellipse cx="14.5" cy="7.5" rx="1.8" ry="2.4" fill="currentColor" />
            <ellipse cx="19" cy="10" rx="1.8" ry="2.2" fill="currentColor" />
          </svg>
        </div>
      ))}

      {/* Main Cat Paw Cursor */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999] opacity-0 transition-opacity duration-150 will-change-transform"
      >
        <div className="relative filter drop-shadow-[2px_2px_0px_#000000] drop-shadow-[0_0_6px_rgba(255,46,147,0.65)]">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Main Palm Pad */}
            <path
              d="M7.5 13.5C5.5 13.5 4 15.2 4 17.2C4 19.5 6.2 21 12 21C17.8 21 20 19.5 20 17.2C20 15.2 18.5 13.5 16.5 13.5C14.8 13.5 13.8 14.8 12 14.8C10.2 14.8 9.2 13.5 7.5 13.5Z"
              fill="#FF2E93"
              stroke="#000000"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* Inner Palm Accent / Highlight */}
            <path
              d="M9 16C8 16 7.5 16.8 8.2 17.8C9.2 19 10.8 19.4 12 19.4C13.2 19.4 14.8 19 15.8 17.8C16.5 16.8 16 16 15 16C13.8 16 13 16.8 12 16.8C11 16.8 10.2 16 9 16Z"
              fill="#FFE600"
              opacity="0.85"
            />

            {/* Toe Pad 1 (Outer Left) */}
            <ellipse
              cx="5"
              cy="10.5"
              rx="2.2"
              ry="2.8"
              transform="rotate(-20 5 10.5)"
              fill="#C6FF00"
              stroke="#000000"
              strokeWidth="1.8"
            />
            {/* Toe Pad 2 (Inner Left) */}
            <ellipse
              cx="9.5"
              cy="7.2"
              rx="2.3"
              ry="3.1"
              transform="rotate(-6 9.5 7.2)"
              fill="#FF2E93"
              stroke="#000000"
              strokeWidth="1.8"
            />
            {/* Toe Pad 3 (Inner Right) */}
            <ellipse
              cx="14.5"
              cy="7.2"
              rx="2.3"
              ry="3.1"
              transform="rotate(6 14.5 7.2)"
              fill="#FF2E93"
              stroke="#000000"
              strokeWidth="1.8"
            />
            {/* Toe Pad 4 (Outer Right) */}
            <ellipse
              cx="19"
              cy="10.5"
              rx="2.2"
              ry="2.8"
              transform="rotate(20 19 10.5)"
              fill="#C6FF00"
              stroke="#000000"
              strokeWidth="1.8"
            />
          </svg>
        </div>
      </div>
    </>
  );
};
