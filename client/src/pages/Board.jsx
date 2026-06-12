import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Stage, Layer, Rect, Circle, Transformer, Line, Text } from "react-konva";
import { getBoard, saveBoard, saveVersion, restoreVersion } from "../api";
import ColorPicker from "../components/ColorPicker";
import PresenceAvatars from "../components/PresenceAvatars";
import usePresence from "../hooks/usePresence";
import useShapeSync from "../hooks/useShapeSync";
import "../styles/board.css";

export default function Board() {
  const { id } = useParams();
  const nav = useNavigate();
  const stageRef = React.useRef(null);
  const [error, setError] = React.useState("");
  const [boardTitle, setBoardTitle] = React.useState("");
  const [shapes, setShapes] = React.useState([]);
  const [selectedId, setSelectedId] = React.useState(null);
  const [activeTool, setActiveTool] = React.useState(null);
  const [fillColor, setFillColor] = React.useState("#93c5fd");
  const [penSize, setPenSize] = React.useState(5);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [saveStatus, setSaveStatus] = React.useState(null); // null | "saving" | "saved" | "error"
  const [versionSaveStatus, setVersionSaveStatus] = React.useState(null); // null | "saving" | "saved" | "error"
  const [versionModalOpen, setVersionModalOpen] = React.useState(false);
  const [versionLabel, setVersionLabel] = React.useState("");
  const [presentMode, setPresentMode] = React.useState(false);
  const [laserPoints, setLaserPoints] = React.useState([]);
  const [isLasering, setIsLasering] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(false);
  const [copyIdStatus, setCopyIdStatus] = React.useState(null); // null | "copied"
  const [versions, setVersions] = React.useState([]);
  const boardContainerRef = React.useRef(null);
  const statusTimerRef = React.useRef(null);
  const syncTimerRef = React.useRef(null);
  const laserClearRef = React.useRef(null);

  const peers = usePresence(id);

  const { emitShapes, requestShapes, suppressRef, suppress } = useShapeSync(id, shapes, setShapes);

  React.useEffect(() => () => {
    clearTimeout(statusTimerRef.current);
    clearTimeout(syncTimerRef.current);
  }, []);


  React.useEffect(() => {
    if (!selectedId) return;
    const shape = shapes.find((s) => s.id === selectedId);
    if (shape?.fill) setFillColor(shape.fill);
  }, [selectedId]);

  React.useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Escape") {
        setSelectedId(null);
        if (!document.fullscreenElement) setPresentMode(false);
      } else if ((e.key === "Delete") && selectedId) {
        setShapes((prev) => prev.filter((s) => s.id !== selectedId));
        setSelectedId(null);
      }
    }

    function onFullscreenChange() {
      if (!document.fullscreenElement) setPresentMode(false);
    }

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [selectedId]);

  React.useEffect(() => {
    async function load() {
      try {
        const boardRes = await getBoard(id);
        setBoardTitle(boardRes.board.title);
        suppress();
        setShapes(boardRes.shapes || []);
        setVersions(boardRes.board.versions || []);
        requestShapes();
      } catch (e) {
        setError(e.message);
      }
    }
    load();
  }, [id, requestShapes]);

  React.useEffect(() => {
    if (suppressRef.current) {
      suppressRef.current = false;
      clearTimeout(syncTimerRef.current);
      return;
    }
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => emitShapes(shapes), 40);
  }, [shapes]);

  async function togglePresentMode() {
    if (!presentMode) {
      try {
        const el = boardContainerRef.current;
        if (el?.requestFullscreen) await el.requestFullscreen();
        else if (el?.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        setPresentMode(true);
      } catch {
        setPresentMode(true);
      }
    } else {
      if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch { }
      }
      setPresentMode(false);
    }
  }

  async function save() {
    setSaveStatus("saving");
    try {
      await saveBoard(id, shapes);
      setSaveStatus("saved");
      statusTimerRef.current = setTimeout(() => setSaveStatus(null), 2500);
    } catch {
      setSaveStatus("error");
      statusTimerRef.current = setTimeout(() => setSaveStatus(null), 3000);
    }
  }

  function openVersionModal() {
    setVersionLabel("");
    setVersionModalOpen(true);
  }

  async function saveVer() {
    const label = versionLabel.trim() || `Version ${new Date().toLocaleString()}`;
    setVersionModalOpen(false);
    setVersionSaveStatus("saving");
    try {
      await saveVersion(id, shapes, label);
      setVersionSaveStatus("saved");
      statusTimerRef.current = setTimeout(() => setVersionSaveStatus(null), 2500);
    } catch {
      setVersionSaveStatus("error");
      statusTimerRef.current = setTimeout(() => setVersionSaveStatus(null), 3000);
    }
  }

  async function restoreVer(e) {
    const versionId = e.target.value;
    if (!versionId) return;

    try {
      const snapshot = await restoreVersion(id, versionId);

      suppress();
      setShapes(snapshot.shapes || []);

      e.target.value = "";
    } catch (err) {
      setError(err.message);
    }
  }

  function startStroke() {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const newStroke = {
      id: `pen-${Date.now()}`,
      type: "pen",
      points: [pos.x, pos.y],
      stroke: fillColor,
      strokeWidth: penSize,
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

      const pts = last.points;
      if (pts.length >= 2) {
        const prevX = pts[pts.length - 2];
        const prevY = pts[pts.length - 1];
        const dx = pos.x - prevX;
        const dy = pos.y - prevY;
        if (dx * dx + dy * dy < 9) return prev;
      }

      last.points = pts.concat([pos.x, pos.y]);
      next[next.length - 1] = { ...last };
      return next;
    });
  }

  function endStroke() {
    setIsDrawing(false);
  }

  function addTextAtPointer() {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const id = `text-${Date.now()}`;

    const newText = {
      id,
      type: "text",
      x: pos.x,
      y: pos.y,
      text: "Double-click to edit",
      fontSize: 24,
      fontFamily: "Calibri, 'Gill Sans', 'Trebuchet MS', Georgia, serif",
      fill: fillColor,
      width: 240,
      draggable: true,
    };

    setShapes((prev) => [...prev, newText]);
    setSelectedId(id);
  }

  function addShapeAtPointer(tool) {
    const stage = stageRef.current;
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const shapeId = `${tool}-${Date.now()}`;
    let newShape;

    if (tool === "rect") {
      newShape = {
        id: shapeId,
        type: "rect",
        x: pos.x - 80,
        y: pos.y - 50,
        width: 160,
        height: 100,
        fill: fillColor,
        strokeWidth: 0,
        draggable: true,
      };
    } else if (tool === "square") {
      newShape = {
        id: shapeId,
        type: "rect",
        x: pos.x - 60,
        y: pos.y - 60,
        width: 120,
        height: 120,
        fill: fillColor,
        strokeWidth: 0,
        draggable: true,
      };
    } else if (tool === "circle") {
      newShape = {
        id: shapeId,
        type: "circle",
        x: pos.x,
        y: pos.y,
        radius: 60,
        fill: fillColor,
        strokeWidth: 0,
        draggable: true,
      };
    }

    if (newShape) {
      setShapes((prev) => [...prev, newShape]);
      setSelectedId(shapeId);
    }
  }

  function startEditingText(id) {
    const stage = stageRef.current;
    if (!stage) return;

    const node = stage.findOne(`#${id}`);
    if (!node) return;

    const shape = shapes.find((s) => s.id === id);
    if (!shape) return;

    const textPos = node.getAbsolutePosition();
    const absScale = node.getAbsoluteScale();

    const fontSize = node.fontSize() * absScale.y;
    const width = node.width() * absScale.x;

    const height = Math.max(28, node.height() * absScale.y);

    setEditing({
      id,
      value: shape.text ?? "",
      style: {
        position: "absolute",
        top: textPos.y,
        left: textPos.x,
        width: Math.max(40, width),
        height,
        fontSize,
        fontFamily: shape.fontFamily,
        lineHeight: node.lineHeight(),
        color: shape.fill,
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.35)",
        borderRadius: 8,
        padding: "6px 8px",
        outline: "none",
        resize: "none",
        overflow: "hidden",
        zIndex: 10,
      },
    });

    setSelectedId(null);
  }

  function commitEditingText() {
    if (!editing) return;

    const { id, value } = editing;

    setShapes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text: value } : s))
    );

    setEditing(null);
  }

  return (
    <div className="boardPage">
      <div
        className={`boardContainer${presentMode ? " boardContainer--present" : ""}`}
        ref={boardContainerRef}
      >
        <div className="boardHeader">
          <div className="boardTitleBlock">
            <h1 className="boardTitle">{boardTitle}</h1>
          </div>

          <div className="boardHeaderActions">
            <PresenceAvatars peers={peers} />

            <button
              className={`shareIdBtn${copyIdStatus === "copied" ? " shareIdBtn--copied" : ""}`}
              title="Copy board ID to share with collaborators"
              onClick={() => {
                navigator.clipboard.writeText(id).then(() => {
                  setCopyIdStatus("copied");
                  setTimeout(() => setCopyIdStatus(null), 2000);
                });
              }}
            >
              {copyIdStatus === "copied" ? (
                <>
                  Copied!
                </>
              ) : (
                <>
                  Share Board ID
                </>
              )}
            </button>

            <button
              className={`saveVersionBtn ${versionSaveStatus === "saving" ? "saveVersionBtn--saving" :
                versionSaveStatus === "saved" ? "saveVersionBtn--saved" :
                  versionSaveStatus === "error" ? "saveVersionBtn--error" : ""
                }`}
              onClick={openVersionModal}
              disabled={versionSaveStatus === "saving"}
            >
              {versionSaveStatus === "saving" ? "Saving ..." :
                versionSaveStatus === "saved" ? "Saved" :
                  versionSaveStatus === "error" ? "Error" :
                    "Save Version"}
            </button>
            <select className="versionSelect" onChange={restoreVer} defaultValue="">
              <option value="">Restore version...</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>

            <button
              className={`saveBtn ${saveStatus === "saving" ? "saveBtn--saving" :
                saveStatus === "saved" ? "saveBtn--saved" :
                  saveStatus === "error" ? "saveBtn--error" : ""
                }`}
              onClick={save}
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saving" ? "Saving…" :
                saveStatus === "saved" ? "Saved" :
                  saveStatus === "error" ? "Error" :
                    "Save"}
            </button>

            <button
              id="presentModeBtn"
              className={`presentModeBtn${presentMode ? " presentModeBtn--active" : ""}`}
              onClick={togglePresentMode}
              title={presentMode ? "Exit Present Mode (Esc)" : "Present Mode – fullscreen, no distractions"}
            >
              {presentMode ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Exit
                </>
              ) : (
                <>

                  Present
                </>
              )}
            </button>
          </div>
        </div>

        <div className="toolbar">
          <button
            className={`toolBtn toolBtnIcon ${activeTool === "rect" ? "active" : ""}`}
            title="Rectangle"
            onClick={() => {
              setSelectedId(null);
              setActiveTool((prev) => (prev === "rect" ? null : "rect"));
            }}
          >
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <rect x="1" y="1" width="16" height="12" rx="1.5"
                stroke="currentColor" strokeWidth="1.8" fill="none" />
            </svg>
          </button>
          <button
            className={`toolBtn toolBtnIcon ${activeTool === "square" ? "active" : ""}`}
            title="Square"
            onClick={() => {
              setSelectedId(null);
              setActiveTool((prev) => (prev === "square" ? null : "square"));
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" rx="1.5"
                stroke="currentColor" strokeWidth="1.8" fill="none" />
            </svg>
          </button>
          <button
            className={`toolBtn toolBtnIcon ${activeTool === "circle" ? "active" : ""}`}
            title="Circle"
            onClick={() => {
              setSelectedId(null);
              setActiveTool((prev) => (prev === "circle" ? null : "circle"));
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6"
                stroke="currentColor" strokeWidth="1.8" fill="none" />
            </svg>
          </button>
          <div className="toolDivider" aria-hidden="true" />
          <button
            className={`toolBtn ${activeTool === "pen" ? "active" : ""}`}
            onClick={() => {
              setSelectedId(null);
              setActiveTool((prev) => (prev === "pen" ? null : "pen"));
            }}
          >
            Pen
          </button>

          {activeTool === "pen" && (
            <div className="penSizePicker">
              {[2, 5, 12].map((size) => (
                <button
                  key={size}
                  className={`penSizeBtn ${penSize === size ? "active" : ""}`}
                  title={size === 2 ? "Thin" : size === 5 ? "Medium" : "Thick"}
                  onClick={() => setPenSize(size)}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r={size / 2 + 2}
                      fill="currentColor" />
                  </svg>
                </button>
              ))}
            </div>
          )}
          <button
            className={`toolBtn ${activeTool === "text" ? "active" : ""}`}
            onClick={() => {
              setSelectedId(null);
              setActiveTool((prev) => (prev === "text" ? null : "text"));
            }}
          >
            Text
          </button>
          <div className="toolDivider" aria-hidden="true" />
          <button
            className={`toolBtn toolBtnIcon ${activeTool === "erase" ? "active toolBtnEraseActive" : ""}`}
            title="Erase"
            onClick={() => {
              setSelectedId(null);
              setActiveTool((prev) => (prev === "erase" ? null : "erase"));
            }}
          >
            Erase
          </button>
          <div className="toolDivider" aria-hidden="true" />
          <button
            className={`toolBtn toolBtnIcon ${showGrid ? "active" : ""}`}
            title="Toggle grid overlay"
            onClick={() => setShowGrid((prev) => !prev)}
          >
            Grid
          </button>

          {activeTool !== "erase" && (selectedId || ["pen", "text", "rect", "square", "circle"].includes(activeTool)) && (
            <>
              <div className="toolDivider" aria-hidden="true" />
              <ColorPicker
                value={fillColor}
                onChange={(hex) => {
                  setFillColor(hex);
                  setShapes((prev) =>
                    prev.map((s) =>
                      s.id === selectedId ? { ...s, fill: hex } : s
                    )
                  );
                }}
              />
            </>
          )}
        </div>

        {error && <p className="errorText">{error}</p>}

        <div className="canvasFrame">
          {editing && (
            <textarea
              className="konvaTextEditor"
              value={editing.value}
              style={editing.style}
              autoFocus
              onChange={(e) => setEditing((prev) => ({ ...prev, value: e.target.value }))}
              onBlur={commitEditingText}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitEditingText();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setEditing(null);
                }
              }}
            />
          )}
          <Stage
            ref={stageRef}
            width={900}
            height={600}
            style={{ cursor: presentMode ? "crosshair" : activeTool === "erase" ? "crosshair" : ["pen", "text", "rect", "square", "circle"].includes(activeTool) ? "crosshair" : "default" }}
            onMouseDown={(e) => {
              if (presentMode) {
                const pos = stageRef.current?.getPointerPosition();
                if (!pos) return;
                clearTimeout(laserClearRef.current);
                setLaserPoints([pos.x, pos.y]);
                setIsLasering(true);
                return;
              }
              if (activeTool === "pen") return startStroke();
              const clickedOnEmpty = e.target === e.target.getStage();
              if (activeTool === "text" && clickedOnEmpty) {
                addTextAtPointer();
                return;
              }
              if (["rect", "square", "circle"].includes(activeTool) && clickedOnEmpty) {
                addShapeAtPointer(activeTool);
                return;
              }
              if (clickedOnEmpty) setSelectedId(null);
            }}
            onMouseMove={() => {
              if (presentMode && isLasering) {
                const pos = stageRef.current?.getPointerPosition();
                if (!pos) return;
                setLaserPoints((prev) => [...prev, pos.x, pos.y]);
                return;
              }
              if (activeTool === "pen") extendStroke();
            }}
            onMouseUp={() => {
              if (presentMode) {
                setIsLasering(false);
                laserClearRef.current = setTimeout(() => setLaserPoints([]), 600);
                return;
              }
              if (activeTool === "pen") endStroke();
            }}
            onTouchStart={() => {
              if (activeTool === "pen") startStroke();
            }}
            onTouchMove={() => {
              if (activeTool === "pen") extendStroke();
            }}
            onTouchEnd={() => {
              if (activeTool === "pen") endStroke();
            }}
          >
            <Layer>
              {showGrid && (() => {
                const STEP = 40;
                const W = 900;
                const H = 600;
                const lines = [];
                for (let x = STEP; x < W; x += STEP) {
                  lines.push(
                    <Line key={`gv-${x}`} points={[x, 0, x, H]}
                      stroke="rgba(200,200,220,0.25)" strokeWidth={1} listening={false} />
                  );
                }
                for (let y = STEP; y < H; y += STEP) {
                  lines.push(
                    <Line key={`gh-${y}`} points={[0, y, W, y]}
                      stroke="rgba(200,200,220,0.25)" strokeWidth={1} listening={false} />
                  );
                }
                return lines;
              })()}
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
                      onClick={() => {
                        if (activeTool === "erase") {
                          setShapes((prev) => prev.filter((p) => p.id !== s.id));
                          setSelectedId(null);
                        } else {
                          setSelectedId(s.id);
                        }
                      }}
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

                if (s.type === "circle") {
                  return (
                    <Circle
                      key={s.id}
                      id={s.id}
                      x={s.x}
                      y={s.y}
                      radius={s.radius}
                      fill={s.fill}
                      stroke={s.stroke}
                      draggable
                      onClick={() => {
                        if (activeTool === "erase") {
                          setShapes((prev) => prev.filter((p) => p.id !== s.id));
                          setSelectedId(null);
                        } else {
                          setSelectedId(s.id);
                        }
                      }}
                      onDragEnd={(e) => {
                        const { x, y } = e.target.position();
                        setShapes((prev) => prev.map((p) => (p.id === s.id ? { ...p, x, y } : p)));
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target;
                        const scaleX = node.scaleX();
                        node.scaleX(1);
                        node.scaleY(1);
                        setShapes((prev) =>
                          prev.map((p) =>
                            p.id === s.id
                              ? { ...p, x: node.x(), y: node.y(), radius: Math.max(10, s.radius * scaleX) }
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
                      bezier={true}
                      listening={activeTool === "erase"}
                      hitStrokeWidth={activeTool === "erase" ? 20 : 0}
                      onClick={() => {
                        if (activeTool === "erase") {
                          setShapes((prev) => prev.filter((p) => p.id !== s.id));
                        }
                      }}
                    />
                  );
                }

                if (s.type === "text") {
                  const isEditingThis = editing?.id === s.id;

                  return (
                    <Text
                      key={s.id}
                      id={s.id}
                      x={s.x}
                      y={s.y}
                      text={s.text}
                      fontSize={s.fontSize}
                      fontFamily={s.fontFamily}
                      fill={s.fill}
                      width={s.width}
                      draggable
                      visible={!isEditingThis}
                      onClick={() => {
                        if (activeTool === "erase") {
                          setShapes((prev) => prev.filter((p) => p.id !== s.id));
                          setSelectedId(null);
                        } else {
                          setSelectedId(s.id);
                        }
                      }}
                      onTap={() => {
                        if (activeTool === "erase") {
                          setShapes((prev) => prev.filter((p) => p.id !== s.id));
                          setSelectedId(null);
                        } else {
                          setSelectedId(s.id);
                        }
                      }}
                      onDblClick={() => startEditingText(s.id)}
                      onDblTap={() => startEditingText(s.id)}
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
                          prev.map((p) => {
                            if (p.id !== s.id) return p;

                            const nextWidth = Math.max(40, node.width() * scaleX);
                            const nextFont = Math.max(8, (p.fontSize ?? 24) * scaleY);

                            return {
                              ...p,
                              x: node.x(),
                              y: node.y(),
                              width: nextWidth,
                              fontSize: nextFont,
                            };
                          })
                        );
                      }}
                    />
                  );
                }

                return null;
              })}
              {selectedId && stageRef.current && (
                <Transformer
                  nodes={[stageRef.current.findOne(`#${selectedId}`)].filter(Boolean)}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 40 || newBox.height < 20) return oldBox;
                    return newBox;
                  }}
                />
              )}
              {presentMode && laserPoints.length >= 4 && (
                <Line
                  points={laserPoints}
                  stroke="#ff3333"
                  strokeWidth={4}
                  lineCap="round"
                  lineJoin="round"
                  tension={0.4}
                  listening={false}
                  opacity={isLasering ? 1 : 0.4}
                />
              )}
            </Layer>
          </Stage>
        </div>

        <button className="backBtn" onClick={() => nav("/dashboard")}>
          Back to Dashboard
        </button>
      </div>

      {versionModalOpen && (
        <div className="boardModalBackdrop" onClick={() => setVersionModalOpen(false)}>
          <div className="boardModal" onClick={(e) => e.stopPropagation()}>
            <h3 className="boardModalTitle">Save Version</h3>
            <p className="boardModalBody">Give this snapshot a name (optional)</p>
            <input
              className="boardModalInput"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder={`Version ${new Date().toLocaleString()}`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveVer();
                if (e.key === "Escape") setVersionModalOpen(false);
              }}
            />
            <div className="boardModalActions">
              <button className="boardModalCancelBtn" onClick={() => setVersionModalOpen(false)}>
                Cancel
              </button>
              <button className="boardModalSaveBtn" onClick={saveVer}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
