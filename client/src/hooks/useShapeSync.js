import { useEffect, useRef, useCallback } from "react";
import socket from "../socket";

export default function useShapeSync(boardId, shapes, onRemoteShapes) {
  const onRemoteRef = useRef(onRemoteShapes);
  onRemoteRef.current = onRemoteShapes;

  const shapesRef = useRef(shapes);
  shapesRef.current = shapes;
  
  const suppressRef = useRef(true);

  useEffect(() => {
    if (!boardId) return;

    function handleShapesUpdate({ shapes }) {
      suppressRef.current = true;
      onRemoteRef.current(shapes);
    }

    function handleRequestShapes() {
      if (shapesRef.current && shapesRef.current.length > 0 && socket.connected) {
        socket.emit("shapes-update", { boardId, shapes: shapesRef.current });
      }
    }

    socket.on("shapes-update", handleShapesUpdate);
    socket.on("request-shapes", handleRequestShapes);

    return () => {
      socket.off("shapes-update", handleShapesUpdate);
      socket.off("request-shapes", handleRequestShapes);
    };
  }, [boardId]);

  const emitShapes = useCallback(
    (shapes) => {
      if (!boardId || !socket.connected) return;
      socket.emit("shapes-update", { boardId, shapes });
    },
    [boardId]
  );

  const requestShapes = useCallback(() => {
    if (!boardId || !socket.connected) return;
    socket.emit("request-shapes", { boardId });
  }, [boardId]);

  const suppress = useCallback(() => {
    suppressRef.current = true;
  }, []);

  return { emitShapes, requestShapes, suppressRef, suppress };
}
