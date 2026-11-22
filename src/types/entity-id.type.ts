/**
 * The id of every backend row, and of every field referencing one: a UUID v7 in its canonical
 * lowercase string form, as the API sends it. Opaque - never parsed, compared numerically or
 * shown as a column.
 */
export type EntityId = string;
