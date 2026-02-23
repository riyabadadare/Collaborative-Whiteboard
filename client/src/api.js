import { getToken } from "./auth";

const API = import.meta.env.VITE_API_BASE_URL;

async function authFetch(path, options = {}, requireAuth = true) {
  const headers = {
    ...(options.headers || {}),
  };

  if (requireAuth) {
    const token = getToken();
    if (!token) throw new Error("Not authorized");
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export function postJson(path, body) {
  return authFetch(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    false
  );
}

export function getMe() {
  return authFetch("/auth/me");
}

export function getBoard(id) {
  return authFetch(`/boards/${id}`);
}

export function getBoards() {
  return authFetch("/boards");
}

export function createBoard(title) {
  return authFetch("/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

export function deleteBoard(id) {
  return authFetch(`/boards/${id}`, {
    method: "DELETE",
  });
}
