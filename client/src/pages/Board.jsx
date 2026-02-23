import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Rect, Transformer, Line } from "react-konva";
import { getBoard } from "../api";
import "../styles/board.css";

export default function Board() {
  const { id } = useParams();
  const nav = useNavigate();
  const stageRef = React.useRef(null);
  const [error, setError] = React.useState("");
  const [boardTitle, setBoardTitle] = React.useState("");
  const [shapes, setShapes] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [isPenActive, setIsPenActive] = React.useState(false);
  const [isDrawing, setIsDrawing] = React.useState(false);

  React.useEffect(() => {
    async function load() {
      try {
        const data = await getBoard(id);
        console.log("board data:", data);

        setBoardTitle(data.board.title);
        setShapes(data.shapes || []);
        console.log("shapes:", data.shapes);

      } catch (e) {
        setError(e.message);
      }
    }
    load();
  }, [id]);

  function startStroke() {
    const stage = stageRef.current;
    if (!stage) return;
  
    const pos = stage.getPointerPosition();
    if (!pos) return;
  
    const newStroke = {
      id: `pen-${Date.now()}`,
      type: "pen",
      points: [pos.x, pos.y],
      stroke: "#ffffff",
      strokeWidth: 3,
      lineCap: "round",
      lineJoin: "round",
    };
  
    setShapes((prev) => [...prev, newStroke]);
    setIsDrawing(true);
    setSelectedId(null);
  }
  
  function extendStroke() {
    if (!isDrawing) return;
  
    const stage = stageRef.current;
    if (!stage) return;
  
    const pos = stage.getPointerPosition();
    if (!pos) return;
  
    setShapes((prev) => {
      const next = prev.slice();
      const last = next[next.length - 1];
      if (!last || last.type !== "pen") return prev;
  
      last.points = last.points.concat([pos.x, pos.y]);
      next[next.length - 1] = last;
      return next;
    });
  }
  
  function endStroke() {
    setIsDrawing(false);
  }

  return (
    <div className="boardPage">
      <div className="boardContainer">
        <div className="boardHeader">
          <h2 className="boardTitle">{boardTitle || "Board"}</h2>
          <button className="backBtn" onClick={() => nav("/dashboard")}>
            Back to Dashboard
          </button>
        </div>

        <div className="toolbar">
          <button
            className="toolBtn"
            onClick={() => {
              setSelectedId(null);
              setIsPenActive(false);

              const newRect = {
                id: `rect-${Date.now()}`,
                type: "rect",
                x: 80,
                y: 200,
                width: 160,
                height: 100,
                fill: "#93c5fd",
                stroke: "#1f2937",
              };

              setShapes((prev) => [...prev, newRect]);
            }}
          >
            Add Rectangle
          </button>
          <button
            className={`toolBtn ${isPenActive ? "active" : ""}`}
            onClick={() => {
              setSelectedId(null);
              setIsPenActive((prev) => !prev);
            }}
          >
            Pen
          </button>
        </div>

        {error && <p className="errorText">{error}</p>}

        <div className="canvasFrame">
          <Stage
            ref={stageRef}
            width={900}
            height={600}
            style={{ cursor: isPenActive ? "crosshair" : "default" }}
            onMouseDown={(e) => {
              if (isPenActive) return startStroke();
              if (e.target === e.target.getStage()) setSelectedId(null);
            }}
            onMouseMove={() => {
              if (isPenActive) extendStroke();
            }}
            onMouseUp={() => {
              if (isPenActive) endStroke();
            }}
            onTouchStart={() => {
              if (isPenActive) startStroke();
            }}
            onTouchMove={() => {
              if (isPenActive) extendStroke();
            }}
            onTouchEnd={() => {
              if (isPenActive) endStroke();
            }}
          >
            <Layer>
              {shapes.map((s) => {
                if (s.type === "rect") {
                  return (
                    <Rect
                      key={s.id}
                      id={s.id}
                      x={s.x}
                      y={s.y}
                      width={s.width}
                      height={s.height}
                      fill={s.fill}
                      stroke={s.stroke}
                      draggable
                      onClick={() => setSelectedId(s.id)}
                      onDragEnd={(e) => {
                        const { x, y } = e.target.position();
                        setShapes((prev) => prev.map((p) => (p.id === s.id ? { ...p, x, y } : p)));
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        const scaleX = node.scaleX();
                        const scaleY = node.scaleY();
                        node.scaleX(1);
                        node.scaleY(1);

                        setShapes((prev) =>
                          prev.map((p) =>
                            p.id === s.id
                              ? {
                                  ...p,
                                  x: node.x(),
                                  y: node.y(),
                                  width: Math.max(20, node.width() * scaleX),
                                  height: Math.max(20, node.height() * scaleY),
                                }
                              : p
                          )
                        );
                      }}
                    />
                  );
                }

                if (s.type === "pen") {
                  return (
                    <Line
                      key={s.id}
                      points={s.points}
                      stroke={s.stroke}
                      strokeWidth={s.strokeWidth}
                      lineCap={s.lineCap}
                      lineJoin={s.lineJoin}
                      tension={0.5}
                      bezier={false}
                      listening={false}  // change when working with selecting strokes for delete
                    />
                  );
                }

                return null;
              })}
                {selectedId && stageRef.current && (
                  <Transformer
                    nodes={[stageRef.current.findOne(`#${selectedId}`)].filter(Boolean)}
                  />
                )}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}
