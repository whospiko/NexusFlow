import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useLiveCollaboration({
  projectId,
  user,
  onRemoteNodeDrag,
  onRemoteNodeDragStop,
  onRemoteDataChange,
}) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [self, setSelf] = useState(null);
  const [others, setOthers] = useState([]);
  const lastCursorSend = useRef(0);

  // Initialize Socket.io connection
  useEffect(() => {
    if (!projectId) return;

    // Use configured socket URL from .env or fallback to window.location.origin
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('erd:join', {
        projectId,
        user: {
          id: user?.id || `usr-${Math.random().toString(36).substring(2, 7)}`,
          name: user?.name || 'Piko (Architect)',
          email: user?.email || '',
          avatar: user?.avatar_url || null,
        },
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Received initial room state
    socket.on('erd:room-state', ({ self: myPresence, users }) => {
      setSelf(myPresence);
      const peerList = (users || []).filter((u) => u.socketId !== socket.id);
      setOthers(peerList);
    });

    // Other user joined
    socket.on('erd:user-joined', (newUser) => {
      setOthers((prev) => {
        const filtered = prev.filter((u) => u.socketId !== newUser.socketId);
        return [...filtered, newUser];
      });
    });

    // Other user left
    socket.on('erd:user-left', ({ socketId }) => {
      setOthers((prev) => prev.filter((u) => u.socketId !== socketId));
    });

    // Presence update with full list
    socket.on('erd:presence-update', ({ users }) => {
      if (Array.isArray(users)) {
        setOthers(users.filter((u) => u.socketId !== socket.id));
      }
    });

    // Remote cursor movement
    socket.on('erd:cursor-moved', ({ socketId, userId, name, color, cursor }) => {
      setOthers((prev) => {
        const index = prev.findIndex((u) => u.socketId === socketId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = { ...updated[index], cursor, name, color };
          return updated;
        }
        return [...prev, { socketId, userId, name, color, cursor }];
      });
    });

    // Remote node dragging (Live canvas sync)
    socket.on('erd:node-dragged', (data) => {
      if (onRemoteNodeDrag) {
        onRemoteNodeDrag(data);
      }
    });

    socket.on('erd:node-drag-stopped', (data) => {
      if (onRemoteNodeDragStop) {
        onRemoteNodeDragStop(data);
      }
    });

    // Remote entity/relationship mutation or schema restore
    socket.on('erd:entity-mutated', () => {
      if (onRemoteDataChange) onRemoteDataChange();
    });
    socket.on('erd:relationship-mutated', () => {
      if (onRemoteDataChange) onRemoteDataChange();
    });
    socket.on('erd:schema-restored', () => {
      if (onRemoteDataChange) onRemoteDataChange();
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId, user?.id, onRemoteNodeDrag, onRemoteNodeDragStop, onRemoteDataChange]);

  // Broadcast own cursor position (throttled to max 30 fps)
  const broadcastCursor = useCallback((x, y) => {
    const now = Date.now();
    if (now - lastCursorSend.current < 33) return; // ~30 fps throttle
    lastCursorSend.current = now;

    if (socketRef.current?.connected) {
      socketRef.current.emit('erd:cursor-move', {
        projectId,
        cursor: { x, y },
      });
    }
  }, [projectId]);

  // Broadcast node dragging
  const broadcastNodeDrag = useCallback((nodeId, position) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('erd:node-drag', {
        projectId,
        nodeId,
        position,
        timestamp: Date.now(),
      });
    }
  }, [projectId]);

  // Broadcast drag finish & persist
  const broadcastNodeDragStop = useCallback((positions) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('erd:node-drag-stop', {
        projectId,
        positions,
      });
    }
  }, [projectId]);

  // Broadcast active node selection
  const broadcastSelectNode = useCallback((nodeId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('erd:select-node', {
        projectId,
        nodeId,
      });
    }
  }, [projectId]);

  // Solo Dev Simulation: spawn a virtual collaborator to test Figma-style editing locally
  const simulatePeer = useCallback(() => {
    const simId = `sim-${Date.now()}`;
    const simPeer = {
      socketId: simId,
      userId: simId,
      name: 'Dev Alice (Demo)',
      color: '#ec4899', // Pink
      cursor: { x: 300, y: 250 },
      activeNodeId: null,
    };

    setOthers((prev) => [...prev, simPeer]);

    // Animate the simulated cursor across the canvas
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const angle = step * 0.1;
      const x = 350 + Math.cos(angle) * 160 + Math.sin(step * 0.05) * 40;
      const y = 280 + Math.sin(angle) * 110;

      setOthers((prev) =>
        prev.map((u) => (u.socketId === simId ? { ...u, cursor: { x, y } } : u))
      );

      if (step > 150) {
        clearInterval(interval);
        setOthers((prev) => prev.filter((u) => u.socketId !== simId));
      }
    }, 40);
  }, []);

  return {
    connected,
    self,
    others,
    broadcastCursor,
    broadcastNodeDrag,
    broadcastNodeDragStop,
    broadcastSelectNode,
    simulatePeer,
  };
}

