
import React from "react";
import { useNavigate } from "react-router-dom";
import { getMe, getBoards, createBoard, deleteBoard } from "../api";
import { clearToken } from "../auth";
import "../styles/dashboard.css";

export default function Dashboard() {
  const nav = useNavigate();
  const [user, setUser] = React.useState(null);
  const [boards, setBoards] = React.useState([]);
  const [err, setErr] = React.useState("");
  const [newTitle, setNewTitle] = React.useState("");
  const [confirmDelete, setConfirmDelete] = React.useState(null);

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
    <div className="dashboardPage">
      <div className="dashboardShell">
        {err && <p className="dashboardError">{err}</p>}

        {user ? (
          <>
            <div className="dashboardTopbar">
              <div className="dashboardHeading">
                <h1 className="dashboardTitle">Dashboard</h1>
                <p className="dashboardMeta">
                  {user.fullName} &middot; {user.email}
                </p>
              </div>

              <button className="btn btn-ghost" onClick={logout}>
                Log out
              </button>
            </div>

            <section className="dashboardSection">
              <h2 className="dashboardSectionTitle">Create a board</h2>

              <form className="dashboardCreateRow" onSubmit={onCreateBoard}>
                <input
                  className="dashboardInput"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Board title"
                />
                <button className="btn btn-primary" type="submit">
                  Create
                </button>
              </form>
            </section>

            <section className="dashboardSection">
              <h2 className="dashboardSectionTitle">Your boards</h2>

              {boards.length === 0 ? (
                <p className="dashboardEmpty">No boards yet. Create one above!</p>
              ) : (
                <div className="dashboardBoards">
                  {boards.map((b) => (
                    <div
                      key={b.id}
                      className="dashboardBoardCard"
                    >
                      <div className="dashboardBoardInfo">
                        <button
                          className="dashboardBoardTitleBtn"
                          onClick={() => nav(`/boards/${b.id}`)}
                        >
                          {b.title}
                        </button>
                        <p className="dashboardBoardMeta">
                          Updated {new Date(b.updatedAt).toLocaleString()}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="btn btn-danger dashboardDangerBtn"
                        onClick={() => setConfirmDelete(b)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
            {confirmDelete && (
              <div className="dashboardModalBackdrop" onClick={() => setConfirmDelete(null)}>
                <div className="dashboardModal" onClick={(e) => e.stopPropagation()}>
                  <h3 className="dashboardModalTitle">Delete board?</h3>
                  <p className="dashboardModalBody">
                    Are you sure you want to delete{" "}
                    <span className="dashboardModalBoardName">{confirmDelete.title}</span>?
                    This cannot be undone.
                  </p>
                  <div className="dashboardModalActions">
                    <button
                      className="btn btn-ghost"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-danger btn-danger-solid"
                      onClick={() => {
                        onDeleteBoard(confirmDelete.id);
                        setConfirmDelete(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="dashboardEmpty">Loading...</p>
        )}
      </div>
    </div>
  );
}
