const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface ZipEntryMap {
  [path: string]: Uint8Array;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc ^= data[index]!;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value & 0xffff, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('deflate-raw');
  const writer = stream.writable.getWriter();
  await writer.write(new Uint8Array(data));
  await writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function unzip(arrayBuffer: ArrayBuffer): Promise<ZipEntryMap> {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  const files: ZipEntryMap = {};
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature === 0x02014b50 || signature === 0x06054b50) {
      break;
    }
    if (signature !== 0x04034b50) {
      throw new Error('Unsupported .fennecmod archive: bad local file header.');
    }

    const flags = view.getUint16(offset + 6, true);
    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);

    if ((flags & 0x0008) !== 0) {
      throw new Error('Unsupported .fennecmod archive: data descriptors are not supported.');
    }

    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    const extraEnd = nameEnd + extraLength;
    const dataEnd = extraEnd + compressedSize;
    const fileName = textDecoder.decode(bytes.slice(nameStart, nameEnd));
    const fileData = bytes.slice(extraEnd, dataEnd);

    if (compressionMethod === 0) {
      files[fileName] = fileData;
    } else if (compressionMethod === 8) {
      const inflated = await inflateRaw(fileData);
      if (inflated.length !== uncompressedSize) {
        throw new Error(`Archive entry size mismatch for ${fileName}.`);
      }
      files[fileName] = inflated;
    } else {
      throw new Error(`Unsupported compression method ${compressionMethod} in ${fileName}.`);
    }

    offset = dataEnd;
  }

  return files;
}

export function textFromZipEntry(entries: ZipEntryMap, path: string): string {
  const entry = entries[path];
  if (!entry) {
    throw new Error(`Archive entry not found: ${path}`);
  }
  return textDecoder.decode(entry);
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

export function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function stringToBytes(value: string): Uint8Array {
  return textEncoder.encode(value);
}

export function bytesToString(value: Uint8Array): string {
  return textDecoder.decode(value);
}

export function zip(entries: Record<string, string | Uint8Array>): Uint8Array {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const [path, rawValue] of Object.entries(entries)) {
    const nameBytes = textEncoder.encode(path);
    const dataBytes = typeof rawValue === 'string' ? textEncoder.encode(rawValue) : rawValue;
    const entryCrc = crc32(dataBytes);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, 0);
    writeUint16(localView, 12, 0);
    writeUint32(localView, 14, entryCrc);
    writeUint32(localView, 18, dataBytes.length);
    writeUint32(localView, 22, dataBytes.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, 0);
    writeUint16(centralView, 14, 0);
    writeUint32(centralView, 16, entryCrc);
    writeUint32(centralView, 20, dataBytes.length);
    writeUint32(centralView, 24, dataBytes.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, offset);
    centralHeader.set(nameBytes, 46);

    localChunks.push(localHeader, dataBytes);
    centralChunks.push(centralHeader);
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectory = concatUint8Arrays(centralChunks);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, centralChunks.length);
  writeUint16(endView, 10, centralChunks.length);
  writeUint32(endView, 12, centralDirectory.length);
  writeUint32(endView, 16, offset);
  writeUint16(endView, 20, 0);

  return concatUint8Arrays([...localChunks, centralDirectory, endRecord]);
}
