import { useCallback, useEffect, useRef } from "react";

/** Ignore delayed results after leaving an editor or starting a newer request. */
export function useEditorRequest() {
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  return useCallback(() => {
    const request = ++generation.current;
    const path = window.location.pathname;
    return () => generation.current === request && window.location.pathname === path;
  }, []);
}
