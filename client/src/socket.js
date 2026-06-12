import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const socket = io(SOCKET_URL, { autoConnect: false });

export function connectSocket(token) {
  if (socket.auth?.token !== token) {
    socket.disconnect();
    socket.auth = { token };
    socket.connect();
  } else if (!socket.connected) {
    socket.connect();
  }
}

export function disconnectSocket() {
  socket.disconnect();
}

export default socket;
