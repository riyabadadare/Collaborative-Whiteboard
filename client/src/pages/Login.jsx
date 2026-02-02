import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { postJson } from "../api";
import { setToken } from "../auth";
import AuthLayout from "../components/AuthLayout";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      const data = await postJson("/auth/login", { email, password });
      setToken(data.token);
      nav("/dashboard");
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your whiteboard workspace."
      footer={
        <>
          Need an account? <Link className="authLink" to="/signup">Sign up</Link>
        </>
      }
    >
      <form className="authForm" onSubmit={onSubmit}>
        <input
          className="authInput"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          className="authInput"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          type="password"
        />
        <button className="authButton">Log in</button>
      </form>
      {err && <div className="authError">{err}</div>}
    </AuthLayout>
  );
}
