'use client';

import { useEffect, useState } from 'react';

/**
 * Ease-out cubic count-up toward `target`.
 *
 * Returns the raw (un-rounded) value so callers decide their own precision — shekels want
 * two decimals, click counts want none. Honours prefers-reduced-motion by jumping straight
 * to the target: the animation is decoration, and for someone who gets motion sick from it
 * the number still has to arrive.
 */
export function useCountUp(target: number, duration = 1400): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(target)) { setValue(0); return; }
    if (typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
