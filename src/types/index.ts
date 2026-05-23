export interface User {
  userId: string;
  email: string;
  name?: string;
  created_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  my_role?: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}

export interface Document {
  id: string;
  title: string;
  content_preview: string | null;
  workspace_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "code"
  | "bullet_list"
  | "numbered_list"
  | "quote"
  | "divider";

export interface Block {
  id: string;
  type: BlockType;
  content: any;
  position: number;
  document_id: string;
  last_edited_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Version {
  id: string;
  version_number: number;
  change_summary: string | null;
  is_major: boolean;
  created_by: string | null;
  created_at: string;
  block_count: number;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  name: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  joined_at?: string;
}
