/** Preserve names from older exports without restoring the retired position field. */
export function appendNamedPosition(remarks: string, name: string) {
  const position = name.trim();
  if (!position || remarks.split("\n").some(line => line.trim() === position)) return remarks;
  return remarks.trim() ? `${remarks}\n${position}` : position;
}
