import { inflateRawSync } from "node:zlib";

export function guardWorkbook(buffer: Buffer) {
  const maxExpandedBytes = 8 * 1024 * 1024;
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break; }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) !== 0 || buffer.readUInt16LE(end + 6) !== 0) throw new Error("Invalid workbook archive");
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  let expanded = 0;
  if (count > 200 || offset >= end) throw new Error("Workbook archive exceeds limits");
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid archive directory");
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const expectedSize = buffer.readUInt32LE(offset + 24);
    const local = buffer.readUInt32LE(offset + 42);
    if (flags & 1 || ![0, 8].includes(method) || expectedSize > maxExpandedBytes - expanded) throw new Error("Workbook archive exceeds limits");
    if (local + 30 > offset || buffer.readUInt32LE(local) !== 0x04034b50) throw new Error("Invalid archive entry");
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + compressedSize > offset) throw new Error("Invalid archive entry bounds");
    const source = buffer.subarray(start, start + compressedSize);
    const content = method === 0 ? source : inflateRawSync(source, { maxOutputLength: Math.max(1, maxExpandedBytes - expanded) });
    if (content.length !== expectedSize) throw new Error("Invalid archive entry size");
    expanded += content.length;
    if (expanded > maxExpandedBytes) throw new Error("Workbook archive exceeds limits");
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  if (offset !== end) throw new Error("Invalid archive directory size");
}
