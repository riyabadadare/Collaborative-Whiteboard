
import React from "react";
import { useNavigate } from "react-router-dom";
import { getMe, getBoards, createBoard, deleteBoard } from "../api";
import { clearToken } from "../auth";

export default function Dashboard() {
  const nav = useNavigate();
  const [user, setUser] = React.useState(null);
  const [boards, setBoards] = React.useState([]);
  const [err, setErr] = React.useState("");
  const [newTitle, setNewTitle] = React.useState("");

  React.useEffect(() => {
    async function load() {
      try {
        const me = await getMe();
        setUser(me.user);

        const b = await getBoards();
        setBoards(b.boards || []);
      } catch (e) {
        setErr(e.message);
        clearToken();
        nav("/login");
      }
    }

    load();
  }, [nav]);

  function logout() {
    clearToken();
    nav("/login");
  }

  async function onCreateBoard(e) {
    e.preventDefault();
    setErr("");

    try {
      const title = newTitle.trim() || "Untitled board";
      const data = await createBoard(title);
      const id = data.board?.id || data.board?._id || data.id;
      nav(`/boards/${id}`);
    } catch (e2) {
      setErr(e2.message);
    }
  }

  async function onDeleteBoard(id) {
    try {
      await deleteBoard(id);
      setBoards((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <>
      <h2>Dashboard</h2>
      {err && <p style={{ color: "crimson" }}>{err}</p>}
      {user ? (
        <>
          <p>
            Logged in as <b>{user.fullName}</b> ({user.email})
          </p>
          <button onClick={logout}>
            Log out
          </button>

          <h3 style={{ marginTop: 20 }}>Create a board</h3>
          <form onSubmit={onCreateBoard} style={{ display: "flex", gap: 8, maxWidth: 500 }}>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Board title"
              style={{ flex: 1, padding: 8 }}
            />
            <button type="submit">Create</button>
          </form>

          <h3 style={{ marginTop: 20 }}>Your boards</h3>

          {boards.length === 0 ? (
            <p>No boards yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10, maxWidth: 700 }}>
              {boards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => nav(`/boards/${b.id}`)}
                  style={{
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{b.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Updated {new Date(b.updatedAt).toLocaleString()}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteBoard(b.id);
                    }}
                    style={{
                      marginLeft: 10,
                      background: "none",
                      border: "none",
                      color: "red",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <p>Loading ...</p>
      )}
    </>
  );
}
