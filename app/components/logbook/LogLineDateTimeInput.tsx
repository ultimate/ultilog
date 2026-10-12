import { useEffect, useRef } from "react";

// Let the browser retain partially typed date/time segments across form updates.
export function LogLineDateTimeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const input = inputRef.current;
    if (input && document.activeElement !== input && input.value !== value) input.value = value;
  }, [value]);
  return <input ref={inputRef} type="datetime-local" defaultValue={value} onChange={event => onChange(event.target.value)} />;
}
