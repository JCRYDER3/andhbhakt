import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { prefersReducedMotion } from './motion';

export const LONG_PRESS_MS = 500;
export const DRAG_SLOP_PX = 12;

const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

export function useCitationReveal() {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const armedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      startRef.current = { x: e.clientX, y: e.clientY };
      armedRef.current = false;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        armedRef.current = true;
        setOpen(true);
        timerRef.current = null;
      }, LONG_PRESS_MS);
    },
    [clearTimer],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!startRef.current) return;
      if (distance(e.clientX, e.clientY, startRef.current.x, startRef.current.y) > DRAG_SLOP_PX) {
        clearTimer();
      }
    },
    [clearTimer],
  );

  const onPointerUp = useCallback(() => {
    clearTimer();
    startRef.current = null;
  }, [clearTimer]);

  const onPointerCancel = useCallback(() => {
    clearTimer();
    startRef.current = null;
  }, [clearTimer]);

  const onPointerEnter = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return;
    setOpen(true);
  }, []);

  const onPointerLeave = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch') return;
    if (!armedRef.current) setOpen(false);
  }, []);

  const onClick = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (armedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      armedRef.current = false;
    }
  }, []);

  const onKeyDown = useCallback((e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') setOpen(false);
  }, []);

  return {
    open,
    setOpen,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerEnter,
      onPointerLeave,
      onClick,
      onKeyDown,
    },
  };
}

export function useInViewOnce<T extends HTMLElement>(threshold = 0.32) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold]);

  return { ref, inView };
}

export function usePressed() {
  const [pressed, setPressed] = useState(false);
  const reduced = prefersReducedMotion();

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || reduced) return;
      setPressed(true);
    },
    [reduced],
  );
  const onPointerUp = useCallback(() => setPressed(false), []);
  const onPointerCancel = useCallback(() => setPressed(false), []);
  const onPointerLeave = useCallback(() => setPressed(false), []);

  return {
    pressed,
    handlers: { onPointerDown, onPointerUp, onPointerCancel, onPointerLeave },
  };
}
