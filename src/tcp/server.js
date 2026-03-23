const net = require('net');           // built into Node.js — no install needed
const prisma = require('../db/client');
const { TCP_PORT } = require('../config');

// In-memory queue for batch DB inserts (better performance)
let locationQueue = [];
const BATCH_INTERVAL_MS = 1000; // flush every 1 second

// Registered IMEIs — loaded from DB on startup
let registeredIMEIs = new Set();

// Throttle tracker for unknown IMEIs (max 1 alert per 5 seconds per IMEI)
const unknownThrottle = new Map();

// Reference to WebSocket broadcast function (set later to avoid circular imports)
let broadcastFn = null;

function setBroadcast(fn) {
  broadcastFn = fn;
}

// Load registered devices from DB into memory
async function loadRegisteredDevices() {
  const devices = await prisma.device.findMany({ select: { imei: true } });
  registeredIMEIs = new Set(devices.map(d => d.imei));
  console.log(`Loaded ${registeredIMEIs.size} registered devices`);
}

// Parse one line from a GPS device
// Format: PING,<imei>,<lat>,<lng>,<speed>,<ignition>\n
function parsePing(line) {
  const parts = line.trim().split(',');

  // Must have exactly 6 parts
  if (parts.length !== 6 || parts[0] !== 'PING') return null;

  const [, imei, latStr, lngStr, speedStr, ignitionStr] = parts;

  // Validate IMEI is 15 digits
  if (!/^\d{15}$/.test(imei)) return null;

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  const speed = parseFloat(speedStr);
  const ignition = ignitionStr === '1';

  // Check all numbers are valid
  if (isNaN(lat) || isNaN(lng) || isNaN(speed)) return null;

  return { imei, lat, lng, speed, ignition };
}

// Flush the queue — batch insert into DB
async function flushQueue() {
  if (locationQueue.length === 0) return;

  const batch = locationQueue.splice(0, locationQueue.length); // grab all & clear

  try {
    await prisma.locationLog.createMany({ data: batch });
    console.log(`Flushed ${batch.length} location records to DB`);
  } catch (err) {
    console.error(JSON.stringify({ event: 'db_flush_error', error: err.message }));
  }
}

// Handle data from one connected device
function handleSocket(socket) {
  let buffer = '';  // accumulate partial data between chunks

  socket.on('data', (chunk) => {
    buffer += chunk.toString();

    // Process all complete lines (separated by \n)
    const lines = buffer.split('\n');
    buffer = lines.pop(); // last item may be incomplete — keep it in buffer

    for (const line of lines) {
      if (!line.trim()) continue; // skip empty lines

      const parsed = parsePing(line);

      if (!parsed) {
        // Malformed packet — log and drop
        console.error(JSON.stringify({ event: 'malformed_packet', raw: line }));
        continue;
      }

      if (!registeredIMEIs.has(parsed.imei)) {
        // Unknown device — throttle alerts (max 1 per 5 seconds per IMEI)
        const now = Date.now();
        const lastAlert = unknownThrottle.get(parsed.imei) || 0;

        if (now - lastAlert > 5000) {
          unknownThrottle.set(parsed.imei, now);
          if (broadcastFn) {
            broadcastFn('tracker:unknown', {
              imei: parsed.imei,
              status: 'UNREGISTERED_DEVICE',
            });
          }
        }
        continue; // do NOT save to DB
      }

      // Valid registered device — add to queue and broadcast live
      const timestamp = new Date();
      locationQueue.push({ ...parsed, timestamp });

      if (broadcastFn) {
        broadcastFn('tracker:live', { ...parsed, ignition: parsed.ignition, timestamp });
      }
    }
  });

  socket.on('error', (err) => {
    console.error(JSON.stringify({ event: 'socket_error', error: err.message }));
  });

  socket.on('close', () => {
    console.log(JSON.stringify({ event: 'device_disconnected' }));
  });
}

function startTCPServer() {
  const server = net.createServer(handleSocket);

  // Flush queue every second via batch insert
  setInterval(flushQueue, BATCH_INTERVAL_MS);

  server.listen(TCP_PORT, () => {
    console.log(JSON.stringify({ event: 'tcp_server_started', port: TCP_PORT }));
  });

  server.on('error', (err) => {
    console.error(JSON.stringify({ event: 'tcp_server_error', error: err.message }));
  });

  return server;
}

module.exports = { startTCPServer, loadRegisteredDevices, setBroadcast, flushQueue, locationQueue };