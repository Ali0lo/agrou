import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from './engine/RoomManager.js';
import { ROLE_STRATEGIES } from './engine/roles/RoleStrategies.js';
import { registerSocketHandlers } from './socket/registerSocketHandlers.js';

export function createCampfireServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const roomManager = new RoomManager(io);
  registerSocketHandlers(io, roomManager);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'campfire-wolves-server',
      timestamp: Date.now(),
    });
  });

  app.get('/api/roles', (_req, res) => {
    res.json({
      roles: Object.values(ROLE_STRATEGIES).map((s) => s.metadata),
    });
  });

  return { app, httpServer, io, roomManager };
}

const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('src/index.ts') ||
  process.argv[1]?.endsWith('dist/index.js');

if (isMainModule) {
  const port = Number(process.env.PORT ?? 4000);
  const { httpServer } = createCampfireServer();
  httpServer.listen(port, () => {
    console.log(`🔥 Campfire Wolves Server listening on http://localhost:${port}`);
  });
}
