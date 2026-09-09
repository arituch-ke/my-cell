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

export function plateLabels(hasSub: boolean): [string, string, string] {
  const first = hasSub ? 30 : 29;
  return [`P${first}`, `P${first + 1}`, `P${first + 2}`];
}
