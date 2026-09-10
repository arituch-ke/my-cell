export interface MessageMetadata {
  hasSub: boolean;
  remark: string | null;
}

export function parseMessage(content: string): MessageMetadata {
  const hasSub = /(?:^|[\s,])sub(?:$|[\s,])/i.test(content.trim());
  const remarkMatch = content.match(/(?:^|[\s,])remark\s*[:=]\s*(.+?)(?=\s*,\s*\w+\s*[:=]|$)/i);
  const remark = remarkMatch?.[1].trim() || null;

  return { hasSub, remark };
}

export type PlateNumbers = [number, number, number];

export function nextPlateNumbers(
  previousValues: unknown[],
  hasSub: boolean
): PlateNumbers {
  const parsed = previousValues.map((value) =>
    Number(String(value).trim().replace(/^P/i, ""))
  );
  const previous: PlateNumbers = parsed.length === 3 && parsed.every(Number.isFinite)
    ? parsed as PlateNumbers
    : [29, 30, 31];

  return hasSub
    ? previous.map((value) => value + 1) as PlateNumbers
    : previous;
}
