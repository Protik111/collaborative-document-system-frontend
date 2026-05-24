"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { documentAPI, workspaceAPI } from "@/lib/api";
import type { Document, WorkspaceMember } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileText, Plus, Search, ChevronLeft, Clock, MoreVertical, FilePlus, Users, Trash2, UserPlus, Shield } from "lucide-react";

export default function WorkspacePage() {
  const { id } = useParams();
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [workspace, setWorkspace] = useState<any>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceMember["role"]>("MEMBER");

  const fetchData = async () => {
    try {
      const [docsRes, wsRes, membersRes] = await Promise.all([
        documentAPI.list(id as string),
        workspaceAPI.get(id as string),
        workspaceAPI.listMembers(id as string),
      ]);
      
      const data = docsRes.data;
      setWorkspace(wsRes.data);
      setMembers(membersRes.data);

      if (Array.isArray(data)) {
        setDocs(data);
      } else if (Array.isArray((data as any)?.documents)) {
        setDocs((data as any).documents);
      } else if (Array.isArray((data as any)?.data)) {
        setDocs((data as any).data);
      } else {
        setDocs([]);
      }
    } catch {
      toast.error("Failed to load workspace data");
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    try {
      await workspaceAPI.invite(id as string, { email: inviteEmail, role: inviteRole });
      setInviteEmail("");
      setInviteRole("MEMBER");
      setIsInviteModalOpen(false);
      const { data } = await workspaceAPI.listMembers(id as string);
      setMembers(data);
      toast.success(`Invite sent to ${inviteEmail}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  const createDoc = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await documentAPI.create(id as string, { title });
      setTitle("");
      setIsModalOpen(false);
      await fetchData();
      toast.success("Document created");
    } catch {
      toast.error("Failed to create document");
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!confirm("Remove this member from the workspace?")) return;
    try {
      await workspaceAPI.removeMember(id as string, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast.success("Member removed");
    } catch {
      toast.error("Failed to remove member");
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in min-h-screen bg-gradient-premium">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')} className="rounded-full hover:bg-white/5">
            <ChevronLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight premium-gradient-text uppercase text-xs mb-1 opacity-60">Workspace /</h1>
            <h2 className="text-4xl font-bold tracking-tight text-white mb-1">{workspace?.name || "Workspace"}</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Search documents..." 
              className="pl-10 bg-white/5 border-white/10 h-10 focus:ring-1 focus:ring-white/20"
            />
          </div>
          <Button onClick={fetchData} variant="outline" className="border-white/10 hover:bg-white/5">
            ↻ Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Create Document Card */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Card className="group cursor-pointer border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all hover:border-white/20 h-full min-h-[200px] flex flex-col items-center justify-center space-y-3 relative overflow-hidden">
              <div className="size-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                <FilePlus className="size-6 text-neutral-400 group-hover:text-white transition-colors" />
              </div>
              <div className="text-center">
                 <p className="font-medium text-neutral-300 group-hover:text-white transition-colors">New Document</p>
                 <p className="text-xs text-neutral-500">Create a blank canvas</p>
              </div>
            </Card>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">Create New Document</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Document title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createDoc()}
                className="bg-neutral-800 border-white/10 text-white"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsModalOpen(false)} 
                className="border-white/10 hover:bg-white/5 text-white"
              >
                Cancel
              </Button>
              <Button 
                onClick={createDoc} 
                disabled={loading || !title.trim()}
                className="bg-neutral-100 text-neutral-900 hover:bg-white"
              >
                {loading ? "Creating..." : "Create Document"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {docs.map((doc) => (
          <Card
            key={doc.id}
            className="group relative cursor-pointer bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-300 border-white/10 flex flex-col h-[200px] rounded-2xl overflow-hidden"
            onClick={() => router.push(`/editor/${doc.id}`)}
          >
            <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
               <div className="size-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-white/10 transition-colors">
                  <FileText className="size-5 text-neutral-400 group-hover:text-white transition-colors" />
               </div>
               <Button variant="ghost" size="icon" className="size-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/5" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <h3 className="text-lg font-medium group-hover:text-white transition-colors line-clamp-1 mb-2">
                {doc.title || "Untitled Document"}
              </h3>
              <p className="text-xs text-neutral-500 line-clamp-3 italic mb-auto">
                {doc.content_preview || "No content preview available."}
              </p>
              <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-[10px] text-neutral-600 font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                   <Clock className="size-3" />
                   {new Date(doc.updated_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {docs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl animate-in">
           <FileText className="size-12 text-neutral-700 mb-4" />
           <h3 className="text-xl font-medium text-neutral-300">No documents yet</h3>
           <p className="text-neutral-500 mb-6">Create your first document in this workspace to get started.</p>
        </div>
      )}

      {/* ── Members Section ── */}
      <div className="pt-4 border-t border-white/5 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Users className="size-5 text-neutral-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Members</h2>
              <p className="text-xs text-neutral-500">{members.length} member{members.length !== 1 ? "s" : ""} in this workspace</p>
            </div>
          </div>

          {/* Invite Modal */}
          <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-white/10 hover:bg-white/15 text-white border border-white/10" variant="secondary">
                <UserPlus className="size-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white">Invite to Workspace</DialogTitle>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Email address</label>
                  <Input
                    type="email"
                    placeholder="collaborator@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && inviteMember()}
                    className="bg-neutral-800 border-white/10 text-white"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Role</label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceMember["role"])}>
                    <SelectTrigger className="bg-neutral-800 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-white/10">
                      <SelectItem value="VIEWER">Viewer — read only</SelectItem>
                      <SelectItem value="MEMBER">Member — can edit documents</SelectItem>
                      <SelectItem value="ADMIN">Admin — full access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsInviteModalOpen(false)} className="border-white/10 hover:bg-white/5 text-white">
                  Cancel
                </Button>
                <Button onClick={inviteMember} disabled={inviteLoading || !inviteEmail.trim()} className="bg-neutral-100 text-neutral-900 hover:bg-white">
                  {inviteLoading ? "Sending..." : "Send Invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Member list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {members.map((m) => {
            const roleColors: Record<string, string> = {
              OWNER: "text-amber-400 bg-amber-400/10 border-amber-400/20",
              ADMIN: "text-blue-400 bg-blue-400/10 border-blue-400/20",
              MEMBER: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
              VIEWER: "text-neutral-400 bg-neutral-400/10 border-neutral-400/20",
            };
            return (
              <div key={m.userId} className="group flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10 border border-white/10">
                    <AvatarFallback className="bg-neutral-800 text-neutral-300 text-sm">
                      {(m.name?.[0] || m.email[0]).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">{m.name || m.email}</p>
                    {m.name && <p className="text-xs text-neutral-500">{m.email}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${roleColors[m.role] || roleColors.VIEWER}`}>
                    {m.role}
                  </span>
                  {workspace?.my_role === "OWNER" && m.role !== "OWNER" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 text-red-400"
                      onClick={() => removeMember(m.userId)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
