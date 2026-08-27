// Compatibility entry point. Runtime parsing and the sole JSON import live in the
// domain module so content-author metadata cannot leak to application code.
export * from "../../domain/compliance/catalog";
