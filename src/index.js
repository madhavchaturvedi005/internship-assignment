const http = require('http');
const express = require('express');
const { startTCPServer, loadRegisteredDevices, setBroadcast } = require('./tcp/server');
const { startWebSocketServer, loadCustomerDevices, broadcast } = require('./websocket/server');
const authRoutes = require('./api/auth');
const deviceRoutes = require('./api/devices');
const healthRoutes = require('./api/health');
const { HTTP_PORT } = require('./config');
const prisma = require('./db/client');

async function main() {
  // 1. Load registered devices into memory
  await loadRegisteredDevices();
  await loadCustomerDevices();

  // 2. Wire TCP → WebSocket broadcast
  setBroadcast(broadcast);

  // 3. Setup Express HTTP server
  const app = express();
  app.use(express.json());

  app.use('/auth', authRoutes);
  app.use('/devices', deviceRoutes);
  app.use('/health', healthRoutes);

  // 4. Attach Socket.io to same HTTP server
  const httpServer = http.createServer(app);
  startWebSocketServer(httpServer);

  // 5. Start TCP server (separate — on port 5000)
  startTCPServer();

  // 6. Start HTTP/WS server
  httpServer.listen(HTTP_PORT, () => {
    console.log(JSON.stringify({ event: 'http_server_started', port: HTTP_PORT }));
  });

  // 7. Graceful shutdown — don't lose in-flight data
  async function shutdown(signal) {
    console.log(JSON.stringify({ event: 'shutdown', signal }));
    await prisma.$disconnect();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(JSON.stringify({ event: 'startup_error', error: err.message }));
  process.exit(1);
});