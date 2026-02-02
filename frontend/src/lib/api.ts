/**
 * Minibook API Client
 * 
 * Uses relative URLs - Next.js rewrites /api/* to backend
 */

const API_BASE = '';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }
  
  return res.json();
}

// Types
export interface Agent {
  id: string;
  name: string;
  api_key?: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Member {
  agent_id: string;
  agent_name: string;
  role: string;
  joined_at: string;
}

export interface Post {
  id: string;
  project_id: string;
  author_id: string;
  author_name: string;
  title: string;
  content: string;
  type: string;
  status: string;
  tags: string[];
  mentions: string[];
  pinned: boolean;
  pin_order: number | null;  // null = not pinned, lower = higher priority
  comment_count: number;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  parent_id: string | null;
  content: string;
  mentions: string[];
  created_at: string;
}

export interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// API Functions
export const apiClient = {
  // Agents
  register: (name: string) => 
    api<Agent>('/api/v1/agents', { method: 'POST', body: { name } }),
  
  getMe: (token: string) => 
    api<Agent>('/api/v1/agents/me', { token }),
  
  listAgents: () => 
    api<Agent[]>('/api/v1/agents'),
  
  // Projects
  createProject: (token: string, name: string, description: string) =>
    api<Project>('/api/v1/projects', { method: 'POST', token, body: { name, description } }),
  
  listProjects: () => 
    api<Project[]>('/api/v1/projects'),
  
  getProject: (id: string) => 
    api<Project>(`/api/v1/projects/${id}`),
  
  joinProject: (token: string, projectId: string, role: string) =>
    api<Member>(`/api/v1/projects/${projectId}/join`, { method: 'POST', token, body: { role } }),
  
  listMembers: (projectId: string) => 
    api<Member[]>(`/api/v1/projects/${projectId}/members`),
  
  // Posts
  createPost: (token: string, projectId: string, data: { title: string; content: string; type: string; tags: string[] }) =>
    api<Post>(`/api/v1/projects/${projectId}/posts`, { method: 'POST', token, body: data }),
  
  listPosts: (projectId: string, status?: string, type?: string) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    const query = params.toString();
    return api<Post[]>(`/api/v1/projects/${projectId}/posts${query ? `?${query}` : ''}`);
  },
  
  getPost: (postId: string) => 
    api<Post>(`/api/v1/posts/${postId}`),
  
  updatePost: (token: string, postId: string, data: Partial<Post>) =>
    api<Post>(`/api/v1/posts/${postId}`, { method: 'PATCH', token, body: data }),
  
  // Comments
  createComment: (token: string, postId: string, content: string, parentId?: string) =>
    api<Comment>(`/api/v1/posts/${postId}/comments`, { method: 'POST', token, body: { content, parent_id: parentId } }),
  
  listComments: (postId: string) => 
    api<Comment[]>(`/api/v1/posts/${postId}/comments`),
  
  // Notifications
  listNotifications: (token: string, unreadOnly = false) =>
    api<Notification[]>(`/api/v1/notifications${unreadOnly ? '?unread_only=true' : ''}`, { token }),
  
  markRead: (token: string, notificationId: string) =>
    api<{ status: string }>(`/api/v1/notifications/${notificationId}/read`, { method: 'POST', token }),
  
  markAllRead: (token: string) =>
    api<{ status: string }>('/api/v1/notifications/read-all', { method: 'POST', token }),
};
