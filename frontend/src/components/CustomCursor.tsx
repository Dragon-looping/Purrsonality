import React, { useEffect, useRef, useState } from "react";

/**
 * Ultra-Responsive Cat-Paw Cursor for Purrsonality.
 *
 * Performance Architecture:
 * - 1:1 hardware mouse tracking using direct translate3d (zero interpolation lag).
 * - Zero React state updates on mouse movement (no re-renders during mousemove).
 * - No DOM element creation or trail garbage collection overhead.
 * - Hardware accelerated with will-change: transform.
 * - Smooth micro-animations for hover and click on inner paw only.
 * - Automatically disabled on touch / coarse pointer devices.
 * - Respects prefers-reduced-motion.
 */
export const CustomCursor: React.FC = () => {
  const [isEnabled, setIsEnabled] = useState(false);

  const cursorRef = useRef<HTMLDivElement>(null);
  const pawRef = useRef<HTMLDivElement>(null);
  const isClicking = useRef(false);
  const isHovering = useRef(false);
  const isVisible = useRef(false);
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
      updatePawStyle();
    };
    motionQuery.addEventListener("change", handleMotionChange);

    document.body.classList.add("custom-cursor-active");

    const updatePawStyle = () => {
      if (!pawRef.current) return;
      if (prefersReducedMotion.current) {
        pawRef.current.style.transform = "scale(1) rotate(0deg)";
        return;
      }

      if (isClicking.current) {
        pawRef.current.style.transform = "scale(0.82) rotate(-8deg)";
      } else if (isHovering.current) {
        pawRef.current.style.transform = "scale(1.22) rotate(6deg)";
      } else {
        pawRef.current.style.transform = "scale(1) rotate(0deg)";
      }
    };

    // Instant 1:1 hardware mouse tracking without React re-renders or interpolation delay
    const onMouseMove = (e: MouseEvent) => {
      if (!isVisible.current) {
        isVisible.current = true;
        if (cursorRef.current) {
          cursorRef.current.style.opacity = "1";
        }
      }

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }
    };

    const onMouseDown = () => {
      isClicking.current = true;
      updatePawStyle();
    };

    const onMouseUp = () => {
      isClicking.current = false;
      updatePawStyle();
    };

    const onMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const isInteractive = Boolean(
        target?.closest(
          'button, a, input, select, textarea, [role="button"], label, [data-interactive="true"]'
        )
      );

      if (isInteractive !== isHovering.current) {
        isHovering.current = isInteractive;
        updatePawStyle();
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

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
      motionQuery.removeEventListener("change", handleMotionChange);
      document.body.classList.remove("custom-cursor-active");
    };
  }, []);

  if (!isEnabled) return null;

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 pointer-events-none z-[9999] opacity-0 will-change-transform"
      style={{
        transform: "translate3d(-100px, -100px, 0)",
        transition: "opacity 0.15s ease",
      }}
    >
      {/* Inner Paw Element: handles hover/click scaling and rotation smoothly */}
      <div
        ref={pawRef}
        className="relative origin-center transition-transform duration-100 ease-out filter drop-shadow-[2px_2px_0px_#000000] drop-shadow-[0_0_6px_rgba(255,46,147,0.65)]"
        style={{
          transform: "scale(1) rotate(0deg)",
          transformOrigin: "35% 35%",
          marginLeft: "-9px",
          marginTop: "-8px",
        }}
      >
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
  );
};
