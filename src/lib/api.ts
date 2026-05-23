import axios from "axios";
import type { User, Workspace, Document, Block, Version } from "@/types";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 → logout
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

// Auth
export const authAPI = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; refresh_token: string; user: User }>(
      "/auth/login",
      { email, password },
    ),
  refresh: (refresh_token: string) =>
    api.post<{ access_token: string }>("/auth/refresh", { refresh_token }),
  me: () => api.get<{ user: User }>("/auth/me"),
};

// User
export const userAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<User>("/user", data),
};

// Workspace (plural, per REST convention)
export const workspaceAPI = {
  list: () => api.get<Workspace[]>("/workspace"),
  create: (data: { name: string; description?: string }) =>
    api.post<Workspace>("/workspace", data),
  get: (id: string) => api.get<Workspace>(`/workspace/${id}`),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch<Workspace>(`/workspace/${id}`, data),
  remove: (id: string) => api.delete(`/workspace/${id}`),

  // Membership
  invite: (workspaceId: string, data: { email: string; role: string }) =>
    api.post(`/workspaces/${workspaceId}/invite`, data),
  listMembers: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/members`),
  getMember: (workspaceId: string, userId: string) =>
    api.get(`/workspaces/${workspaceId}/members/${userId}`),
  updateMember: (workspaceId: string, userId: string, role: string) =>
    api.patch(`/workspaces/${workspaceId}/members/${userId}`, { role }),
  removeMember: (workspaceId: string, userId: string) =>
    api.delete(`/workspaces/${workspaceId}/members/${userId}`),
};

// Document
export const documentAPI = {
  list: (workspaceId: string) =>
    api.get<Document[]>(`/workspaces/${workspaceId}/documents`),
  create: (
    workspaceId: string,
    data: { title: string; content_preview?: string },
  ) => api.post<Document>(`/workspaces/${workspaceId}/documents`, data),
  get: (workspaceId: string, docId: string) =>
    api.get<Document>(`/workspaces/${workspaceId}/documents/${docId}`),
  update: (
    workspaceId: string,
    docId: string,
    data: { title?: string; content_preview?: string },
  ) =>
    api.patch<Document>(`/workspaces/${workspaceId}/documents/${docId}`, data),
  remove: (workspaceId: string, docId: string) =>
    api.delete(`/workspaces/${workspaceId}/documents/${docId}`),
};

// Block
export const blockAPI = {
  list: (workspaceId: string, docId: string) =>
    api.get<Block[]>(`/workspaces/${workspaceId}/documents/${docId}/blocks`),
  create: (
    workspaceId: string,
    docId: string,
    data: { type: string; content?: any; position?: number },
  ) =>
    api.post<Block>(
      `/workspaces/${workspaceId}/documents/${docId}/blocks`,
      data,
    ),
  update: (
    workspaceId: string,
    docId: string,
    blockId: string,
    data: { type?: string; content?: any; position?: number },
  ) =>
    api.patch<Block>(
      `/workspaces/${workspaceId}/documents/${docId}/blocks/${blockId}`,
      data,
    ),
  remove: (workspaceId: string, docId: string, blockId: string) =>
    api.delete(
      `/workspaces/${workspaceId}/documents/${docId}/blocks/${blockId}`,
    ),
};

// Version
export const versionAPI = {
  list: (workspaceId: string, docId: string) =>
    api.get<Version[]>(
      `/workspaces/${workspaceId}/documents/${docId}/versions`,
    ),
  create: (
    workspaceId: string,
    docId: string,
    data: { change_summary?: string; is_major?: boolean },
  ) =>
    api.post<Version>(
      `/workspaces/${workspaceId}/documents/${docId}/versions`,
      data,
    ),
  restore: (workspaceId: string, docId: string, versionId: string) =>
    api.post<Version>(
      `/workspaces/${workspaceId}/documents/${docId}/versions/${versionId}/restore`,
    ),
};
