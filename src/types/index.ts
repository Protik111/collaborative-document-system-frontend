export interface User {
  id: string;
  email: string;
  name: string;
}
export interface Workspace {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
}
export interface Document {
  id: string;
  title: string;
  workspace_id: string;
  created_by?: string;
}
export interface Block {
  id: string;
  type: string;
  content: any;
  position: number;
}
export interface Version {
  id: string;
  version_number: number;
  change_summary?: string;
  is_major: boolean;
}
