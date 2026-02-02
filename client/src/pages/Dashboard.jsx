
import React from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../api";
import { clearToken } from "../auth";

export default function Dashboard() {
  const nav = useNavigate();
  const [user, setUser] = React.useState(null);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    getMe()
      .then((data) => setUser(data.user))
      .catch((e) => {
        setErr(e.message);
        clearToken();
        nav("/login");
      });
    
  }, [nav]);

  function logout() {
    clearToken();
    nav("/login");
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
        </>
      ) : (
        <p>Loading ...</p>
      )}
    </>
  );
}
