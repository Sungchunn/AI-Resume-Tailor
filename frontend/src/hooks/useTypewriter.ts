import { useState, useEffect, useRef, useCallback } from "react";

const CHARS_PER_SECOND = 35;

interface UseTypewriterReturn {
  displayText: string;
  isDone: boolean;
  fastForward: () => void;
  reset: () => void;
}

export function useTypewriter(text: string): UseTypewriterReturn {
  const [displayText, setDisplayText] = useState("");
  const [isDone, setIsDone] = useState(false);
  const charIndexRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const fastForward = useCallback(() => {
    cancel();
    setDisplayText(text);
    setIsDone(true);
    charIndexRef.current = text.length;
  }, [text, cancel]);

  const reset = useCallback(() => {
    cancel();
    charIndexRef.current = 0;
    lastTimestampRef.current = null;
    setDisplayText("");
    setIsDone(false);
  }, [cancel]);

  useEffect(() => {
    cancel();
    charIndexRef.current = 0;
    lastTimestampRef.current = null;
    setDisplayText("");
    setIsDone(false);

    if (!text) {
      setIsDone(true);
      return;
    }

    const msPerChar = 1000 / CHARS_PER_SECOND;

    const animate = (timestamp: number) => {
      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = timestamp;
      }

      const elapsed = timestamp - lastTimestampRef.current;
      const charsToAdd = Math.floor(elapsed / msPerChar);

      if (charsToAdd > 0) {
        lastTimestampRef.current += charsToAdd * msPerChar;
        charIndexRef.current = Math.min(
          charIndexRef.current + charsToAdd,
          text.length
        );
        setDisplayText(text.slice(0, charIndexRef.current));

        if (charIndexRef.current >= text.length) {
          setIsDone(true);
          return;
        }
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return cancel;
  }, [text, cancel]);

  return { displayText, isDone, fastForward, reset };
}
