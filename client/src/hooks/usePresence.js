import { useEffect, useState } from "react";
import socket, { connectSocket } from "../socket";
import { getToken } from "../auth";

const PEER_COLORS = [
  "#8c7cffff", "#ea76b2ff", "#34d399", "#fb923c",
  "#60a5fa", "#a78bfa", "#f87171", "#4ade80",
  "#fbbf24", "#22d3ee"
];

function pickColor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash * 31) + userId.charCodeAt(i)) >>> 0;
  }
  return PEER_COLORS[hash % PEER_COLORS.length];
}


function getMyId() {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])).sub;
  } catch {
    return null;
  }
}

export default function usePresence(boardId) {
  const [peers, setPeers] = useState([]);

  useEffect(() => {
    if (!boardId) return;

    const token = getToken();
    const myId = getMyId();

    connectSocket(token);
    socket.emit("join-board", { boardId });

    function onPresence({ users }) {
      const next = users
        .filter((peer) => peer.userId !== myId)
        .map((peer) => ({ ...peer, color: pickColor(peer.userId) }));
      setPeers(next);
    }

    socket.on("presence-update", onPresence);

    return () => {
      socket.emit("leave-board", { boardId });
      socket.off("presence-update", onPresence);
      setPeers([]);
    };
  }, [boardId]);

  return peers;
}
