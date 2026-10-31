/** Remove obsolete place-name targets while preserving unrelated diagnostics. */
export function retirePositionWarnings(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.flatMap(warning => {
    if (!warning || typeof warning !== "object" || !Array.isArray(warning.fields) || !warning.fields.includes("position")) return [warning];
    const fields = warning.fields.filter((field: unknown) => field !== "position");
    return fields.length ? [{ ...warning, fields }] : [];
  });
}
