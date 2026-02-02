import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { postJson } from "../api";
import { setToken } from "../auth";
import AuthLayout from "../components/AuthLayout";

export default function Signup() {
  const nav = useNavigate();
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      const data = await postJson("/auth/signup", { email, fullName, password });
      nav("/login"); // TODO: use token and navigate straight to dashboard
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start collaborating with your peers."
      footer={
        <>
          Already have an account? <Link className="authLink" to="/login">Log in</Link>
        </>
      }
    >
      <form className="authForm" onSubmit={onSubmit}>
        <input
          className="authInput"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
        />
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
          placeholder="Password (min 8 characters)"
          type="password"
        />
        <button className="authButton">Sign up</button>
      </form>
      {err && <div className="authError">{err}</div>}
    </AuthLayout>
  );
}
