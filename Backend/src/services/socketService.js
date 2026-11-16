import { Server } from 'socket.io';
import * as erdService from './erdService.js';

// Vibrant user cursor palette for instant Figma-like visual distinction
const CURSOR_COLORS = [
  '#0ea5e9', // Sky blue
  '#10b981', // Emerald green
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#ec4899', // Pink / Rose
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#a855f7', // Violet
  '#14b8a6', // Teal
];

// Room state storage: Map<roomId, Map<socketId, UserPresence>>
const roomUsers = new Map();

let io = null;

export function initSocketServer(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    let currentRoomId = null;
    let currentUser = null;

    // 1. Join Project ERD Room
    socket.on('erd:join', async ({ projectId, user }) => {
      try {
        if (!projectId) return;
        currentRoomId = `erd:${projectId}`;
        socket.join(currentRoomId);

        if (!roomUsers.has(currentRoomId)) {
          roomUsers.set(currentRoomId, new Map());
        }

        const roomMap = roomUsers.get(currentRoomId);

        // Assign a deterministic or random color from palette
        const colorIndex = roomMap.size % CURSOR_COLORS.length;
        const assignedColor = user?.color || CURSOR_COLORS[colorIndex];

        currentUser = {
          socketId: socket.id,
          userId: user?.id || `guest-${socket.id.slice(0, 5)}`,
          name: user?.name || `Guest (${socket.id.slice(0, 4)})`,
          email: user?.email || '',
          avatar: user?.avatar || null,
          color: assignedColor,
          cursor: { x: 0, y: 0 },
          activeNodeId: null,
          joinedAt: new Date().toISOString(),
        };

        roomMap.set(socket.id, currentUser);

        // Send full existing presence list to new user
        const presenceList = Array.from(roomMap.values());
        socket.emit('erd:room-state', {
          self: currentUser,
          users: presenceList,
          room: currentRoomId,
        });

        // Broadcast to everyone else in the room that a new user joined
        socket.to(currentRoomId).emit('erd:user-joined', currentUser);

        // Broadcast updated presence count
        io.to(currentRoomId).emit('erd:presence-update', {
          count: roomMap.size,
          users: presenceList,
        });

        console.log(`📡 [Socket.IO] User '${currentUser.name}' joined ${currentRoomId} (${roomMap.size} online)`);
      } catch (err) {
        console.error('Socket erd:join error:', err);
      }
    });

    // 2. Cursor Movement (High frequency, throttled by client)
    socket.on('erd:cursor-move', ({ projectId, cursor }) => {
      if (!currentRoomId || !currentUser) return;
      currentUser.cursor = cursor;
      // Broadcast live cursor to others in the room
      socket.to(currentRoomId).emit('erd:cursor-moved', {
        socketId: socket.id,
        userId: currentUser.userId,
        name: currentUser.name,
        color: currentUser.color,
        cursor,
      });
    });

    // 3. Live Node Dragging (Real-time movement on canvas)
    socket.on('erd:node-drag', ({ projectId, nodeId, position, timestamp }) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).emit('erd:node-dragged', {
        nodeId,
        position,
        actor: currentUser?.name || 'Someone',
        color: currentUser?.color || '#0ea5e9',
        timestamp: timestamp || Date.now(),
      });
    });

    // 4. Node Drag Stopped / Positions Persisted
    socket.on('erd:node-drag-stop', async ({ projectId, positions }) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).emit('erd:node-drag-stopped', {
        positions,
        actor: currentUser?.name || 'Someone',
      });

      // Optionally save to Postgres if positions array provided
      if (Array.isArray(positions) && positions.length > 0 && projectId) {
        try {
          await erdService.saveNodePositions(projectId, positions);
        } catch (err) {
          console.error('Failed to auto-save node positions from socket drag:', err.message);
        }
      }
    });

    // 5. Active Node Focus / Editing Lock Indicator
    socket.on('erd:select-node', ({ projectId, nodeId }) => {
      if (!currentRoomId || !currentUser) return;
      currentUser.activeNodeId = nodeId;
      socket.to(currentRoomId).emit('erd:node-selected', {
        socketId: socket.id,
        userId: currentUser.userId,
        name: currentUser.name,
        color: currentUser.color,
        nodeId,
      });
    });

    // 6. Entity Mutation (Create / Update / Delete)
    socket.on('erd:entity-mutation', ({ projectId, action, entity, entityId }) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).emit('erd:entity-mutated', {
        action,
        entity,
        entityId,
        actor: currentUser?.name || 'Collaborator',
        timestamp: Date.now(),
      });
    });

    // 7. Relationship Mutation (Create / Update / Delete)
    socket.on('erd:relationship-mutation', ({ projectId, action, relationship, relationshipId }) => {
      if (!currentRoomId) return;
      socket.to(currentRoomId).emit('erd:relationship-mutated', {
        action,
        relationship,
        relationshipId,
        actor: currentUser?.name || 'Collaborator',
        timestamp: Date.now(),
      });
    });

    // 8. Disconnect & Cleanup
    socket.on('disconnect', () => {
      if (currentRoomId && roomUsers.has(currentRoomId)) {
        const roomMap = roomUsers.get(currentRoomId);
        roomMap.delete(socket.id);

        const presenceList = Array.from(roomMap.values());
        socket.to(currentRoomId).emit('erd:user-left', {
          socketId: socket.id,
          user: currentUser,
        });

        io.to(currentRoomId).emit('erd:presence-update', {
          count: roomMap.size,
          users: presenceList,
        });

        if (roomMap.size === 0) {
          roomUsers.delete(currentRoomId);
        }

        console.log(`🔌 [Socket.IO] User '${currentUser?.name}' left ${currentRoomId}`);
      }
    });
  });

  console.log('✅ Socket.IO Live Collaborative Engine initialized');
  return io;
}

export function getSocketIO() {
  return io;
}

/**
 * Server-side helper to broadcast entity or relationship changes made via REST API
 */
export function broadcastErdUpdate(projectId, event, payload) {
  if (!io || !projectId) return;
  const roomId = `erd:${projectId}`;
  io.to(roomId).emit(event, { ...payload, timestamp: Date.now() });
}

