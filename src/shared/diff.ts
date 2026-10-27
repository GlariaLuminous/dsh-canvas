export interface DiffLine {
  type: "same" | "removed" | "added";
  text: string;
}
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n"),
    b = after.split("\n");
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix])
    prefix++;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  )
    suffix++;
  const old = a.slice(prefix, a.length - suffix),
    next = b.slice(prefix, b.length - suffix);
  const result: DiffLine[] = a
    .slice(0, prefix)
    .map((text) => ({ type: "same", text }));
  if (old.length * next.length > 250000) {
    for (const text of old) result.push({ type: "removed", text });
    for (const text of next) result.push({ type: "added", text });
  } else {
    const stride = next.length + 1;
    const table = new Uint32Array((old.length + 1) * stride);
    for (let i = old.length - 1; i >= 0; i--)
      for (let j = next.length - 1; j >= 0; j--)
        table[i * stride + j] =
          old[i] === next[j]
            ? table[(i + 1) * stride + j + 1] + 1
            : Math.max(table[(i + 1) * stride + j], table[i * stride + j + 1]);
    let i = 0,
      j = 0;
    while (i < old.length || j < next.length) {
      if (i < old.length && j < next.length && old[i] === next[j]) {
        result.push({ type: "same", text: old[i] });
        i++;
        j++;
      } else if (
        i < old.length &&
        (j === next.length ||
          table[(i + 1) * stride + j] >= table[i * stride + j + 1])
      )
        result.push({ type: "removed", text: old[i++] });
      else result.push({ type: "added", text: next[j++] });
    }
  }
  for (let index = a.length - suffix; index < a.length; index++)
    result.push({ type: "same", text: a[index] });
  return result;
}
