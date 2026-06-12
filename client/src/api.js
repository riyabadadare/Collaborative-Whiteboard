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

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error || "Request failed");
  }

  return body;
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

export function saveBoard(id, shapes) {
  return authFetch(`/boards/${id}/shapes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shapes }),
  });
}

export function saveVersion(boardId, shapes, label) {
  return authFetch(`/boards/${boardId}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shapes, label }),
  });
}

export function restoreVersion(boardId, versionId) {
  return authFetch(`/boards/${boardId}/versions/${versionId}/restore`, {
    method: "POST",
  });
}