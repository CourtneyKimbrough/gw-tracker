interface Cursor {
  /** ISO timestamp of the last row on the previous page. */
  ts: string;
  /** Tie-breaker for rows sharing the same timestamp. */
  id: number;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(value: string | null): Cursor | null {
  if (!value) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "ts" in parsed &&
      "id" in parsed &&
      typeof (parsed as Cursor).ts === "string" &&
      typeof (parsed as Cursor).id === "number"
    ) {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}
