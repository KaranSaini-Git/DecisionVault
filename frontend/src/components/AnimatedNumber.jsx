import { useEffect, useRef, useState } from "react";

function AnimatedNumber({ value = 0, duration = 760, className = "" }) {
  const numericValue = Number.isFinite(Number(value)) ? Number(value) : 0;

  const [displayValue, setDisplayValue] = useState(numericValue);
  const previousValue = useRef(numericValue);

  useEffect(() => {
    const from = previousValue.current;
    const to = numericValue;

    previousValue.current = to;

    if (from === to) {
      setDisplayValue(to);
      return undefined;
    }

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reduceMotion) {
      setDisplayValue(to);
      return undefined;
    }

    const start = performance.now();
    let frameId = 0;

    const tick = (time) => {
      const progress = Math.min(1, (time - start) / duration);

      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplayValue(Math.round(from + (to - from) * eased));

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [numericValue, duration]);

  return <strong className={className}>{displayValue}</strong>;
}

export default AnimatedNumber;
