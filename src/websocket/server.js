const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('../db/client');
const { JWT_SECRET } = require('../config');

let io;

// customer IMEI map: userId → Set of IMEIs they own
const customerDevices = new Map();

async function loadCustomerDevices() {
  const devices = await prisma.device.findMany({
    where: { customerId: { not: null } },
    select: { imei: true, customerId: true },
  });

  for (const d of devices) {
    if (!customerDevices.has(d.customerId)) {
      customerDevices.set(d.customerId, new Set());
    }
    customerDevices.get(d.customerId).add(d.imei);
  }
  console.log(`Loaded customer device mappings`);
}

function startWebSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*' }, // tighten this in production
  });

  // Middleware — verify JWT on connection
  io.use((socket, next) => {
    const token = socket.handshake.query.token;

    if (!token) return next(new Error('No token provided'));

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.user = decoded; // attach user info to socket
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(JSON.stringify({
      event: 'ws_connected',
      userId: socket.user.id,
      role: socket.user.role,
    }));

    socket.on('disconnect', () => {
      console.log(JSON.stringify({ event: 'ws_disconnected', userId: socket.user.id }));
    });
  });

  return io;
}

// Broadcast to all connected clients — respecting role-based visibility
function broadcast(event, data) {
  if (!io) return;

  io.sockets.sockets.forEach((socket) => {
    const user = socket.user;
    if (!user) return;

    if (user.role === 'Admin') {
      // Admin sees everything
      socket.emit(event, { event, data });
    } else if (user.role === 'Customer') {
      // Customer sees only their own devices
      const myDevices = customerDevices.get(user.id);
      if (myDevices && myDevices.has(data.imei)) {
        socket.emit(event, { event, data });
      }
    }
  });
}

module.exports = { startWebSocketServer, loadCustomerDevices, broadcast };