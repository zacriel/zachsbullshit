import net from 'net';
import dns from 'dns/promises';

/**
 * Minecraft Server List Ping (SLP) for modern servers (1.7+).
 * Opens a TCP socket, performs the handshake + status request, and parses
 * the JSON status response — no third-party service required.
 *
 * Protocol reference: the client sends a Handshake packet (next state = 1)
 * followed by a Status Request; the server replies with a length-prefixed
 * packet containing a JSON string (version, players, description/MOTD).
 */

export interface McStatus {
  online: boolean;
  players?: { online: number; max: number };
  version?: string;
  motd?: string;
  latencyMs?: number;
}

/* ---------- VarInt helpers ---------- */

function encodeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let temp = v & 0b0111_1111;
    v >>>= 7;
    if (v !== 0) temp |= 0b1000_0000;
    bytes.push(temp);
  } while (v !== 0);
  return Buffer.from(bytes);
}

function encodeString(str: string): Buffer {
  const b = Buffer.from(str, 'utf8');
  return Buffer.concat([encodeVarInt(b.length), b]);
}

/** Reads a VarInt from buf at offset; returns [value, bytesRead]. */
function readVarInt(buf: Buffer, offset: number): [number, number] {
  let numRead = 0;
  let result = 0;
  let byte: number;
  do {
    if (offset + numRead >= buf.length) throw new Error('VarInt out of bounds');
    byte = buf[offset + numRead];
    result |= (byte & 0b0111_1111) << (7 * numRead);
    numRead++;
    if (numRead > 5) throw new Error('VarInt too big');
  } while ((byte & 0b1000_0000) !== 0);
  return [result, numRead];
}

/** Flattens Minecraft's chat-component description into plain text. */
function flattenMotd(desc: unknown): string {
  if (typeof desc === 'string') return desc;
  if (!desc || typeof desc !== 'object') return '';
  const d = desc as { text?: string; extra?: unknown[] };
  let out = d.text || '';
  if (Array.isArray(d.extra)) out += d.extra.map(flattenMotd).join('');
  // Strip legacy § color codes.
  return out.replace(/§./g, '').trim();
}

/** Resolves host/port, honoring a Minecraft SRV record when no port is given. */
async function resolveTarget(host: string, port?: number): Promise<{ host: string; port: number }> {
  if (port) return { host, port };
  try {
    const records = await dns.resolveSrv(`_minecraft._tcp.${host}`);
    if (records.length) {
      records.sort((a, b) => a.priority - b.priority);
      return { host: records[0].name, port: records[0].port };
    }
  } catch {
    /* no SRV record — fall back to default port */
  }
  return { host, port: 25565 };
}

/** Pings a Minecraft server and returns its live status. */
export async function pingMinecraft(rawHost: string, rawPort?: number, timeoutMs = 5000): Promise<McStatus> {
  const { host, port } = await resolveTarget(rawHost.trim(), rawPort);
  const started = Date.now();

  return new Promise<McStatus>((resolve) => {
    let settled = false;
    const finish = (status: McStatus) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(status);
    };

    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);

    socket.on('timeout', () => finish({ online: false }));
    socket.on('error', () => finish({ online: false }));

    socket.on('connect', () => {
      // Handshake: packetId 0x00, protocol -1 (status), addr, port, nextState 1
      const handshakeData = Buffer.concat([
        encodeVarInt(0x00),
        encodeVarInt(0xffffffff), // protocol version (any)
        encodeString(host),
        (() => {
          const b = Buffer.alloc(2);
          b.writeUInt16BE(port, 0);
          return b;
        })(),
        encodeVarInt(0x01),
      ]);
      const handshake = Buffer.concat([encodeVarInt(handshakeData.length), handshakeData]);
      // Status request: packetId 0x00, empty body
      const request = Buffer.concat([encodeVarInt(1), encodeVarInt(0x00)]);
      socket.write(Buffer.concat([handshake, request]));
    });

    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      try {
        // Packet: [len varint][packetId varint][string varint len][json...]
        const [packetLen, lenBytes] = readVarInt(buffer, 0);
        if (buffer.length - lenBytes < packetLen) return; // wait for more
        let cursor = lenBytes;
        const [, idBytes] = readVarInt(buffer, cursor);
        cursor += idBytes;
        const [strLen, strLenBytes] = readVarInt(buffer, cursor);
        cursor += strLenBytes;
        if (buffer.length - cursor < strLen) return; // wait for more
        const json = buffer.slice(cursor, cursor + strLen).toString('utf8');
        const data = JSON.parse(json) as {
          players?: { online: number; max: number };
          version?: { name?: string };
          description?: unknown;
        };
        finish({
          online: true,
          players: data.players ? { online: data.players.online, max: data.players.max } : undefined,
          version: data.version?.name,
          motd: flattenMotd(data.description),
          latencyMs: Date.now() - started,
        });
      } catch {
        // Not enough data yet, or parse error — keep waiting until timeout.
      }
    });
  });
}
