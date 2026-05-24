"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  blockAPI,
  documentAPI,
  versionAPI,
  workspaceAPI,
  authAPI,
} from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Block, BlockType, Document, Version, WorkspaceMember } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  MoreVertical,
  Trash2,
  Save,
  History,
  Users,
  Plus,
  Undo2,
  ChevronDown,
  GripVertical,
  ChevronRight,
  Settings,
  Share2,
  Clock,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";



export default function EditorPage() {
  const { docId } = useParams();
  const router = useRouter();

  // State
  const [document, setDocument] = useState<Document | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    userId: string;
    email: string;
    role?: string;
  } | null>(null);
  const [activeCollaborators, setActiveCollaborators] = useState<
    { userId: string; email: string }[]
  >([]);

  // UI State
  const [loading, setLoading] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceMember["role"]>("MEMBER");
  const [versionSummary, setVersionSummary] = useState("");
  const [isMajorVersion, setIsMajorVersion] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"versions" | "members">("versions");
  const updateTimerRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Fetch current user + document + workspace context
  useEffect(() => {
    const init = async () => {
      try {
        // Get current user from token
        const { data: me } = await authAPI.me();
        setCurrentUser({
          userId: me.user.userId,
          email: me.user.email,
        });

        // Find which workspace contains this document
        const { data: workspaces } = await workspaceAPI.list();
        let foundWorkspaceId: string | null = null;

        for (const ws of workspaces) {
          try {
            const { data: doc } = await documentAPI.get(ws.id, docId as string);
            setDocument(doc);
            setWorkspaceId(ws.id);
            setDocTitle(doc.title);
            setCurrentUser((prev) =>
              prev ? { ...prev, role: ws.my_role } : null,
            );
            foundWorkspaceId = ws.id;
            break;
          } catch {
            continue; // Try next workspace
          }
        }

        if (!foundWorkspaceId) {
          toast.error("Document not found");
          router.push("/dashboard");
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || "Failed to load document");
        router.push("/dashboard");
      }
    };
    init();
  }, [docId, router]);

  // Fetch blocks, versions, members when workspace is known
  useEffect(() => {
    if (!workspaceId || !docId) return;

    const loadData = async () => {
      try {
        const [blocksRes, versionsRes, membersRes] = await Promise.all([
          blockAPI.list(workspaceId, docId as string),
          versionAPI.list(workspaceId, docId as string),
          workspaceAPI.listMembers(workspaceId),
        ]);
        setBlocks(
          blocksRes.data.sort((a: Block, b: Block) => a.position - b.position),
        );
        setVersions(versionsRes.data);
        setMembers(membersRes.data);
      } catch {
        toast.error("Failed to load document data");
      }
    };
    loadData();

    // Setup WebSocket
    const socket = getSocket();
    socket?.emit("join_document", { documentId: docId });

    const handleBlockUpdate = ({
      blockId,
      content,
      updatedBy,
    }: {
      blockId: string;
      content: any;
      updatedBy: string;
    }) => {
      if (updatedBy === currentUser?.userId) return; // Skip own updates
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, content } : b)),
      );
      toast.success("Live update received");
    };

    const handleUserJoined = ({ userId, email }: { userId: string; email: string }) => {
      setActiveCollaborators((prev) => {
        if (prev.some((u) => u.userId === userId)) return prev;
        return [...prev, { userId, email }];
      });
      toast(`${email} is now viewing`, { icon: "👁️" });
    };

    const handleBlockAdded = ({ block }: { block: Block }) => {
      setBlocks((prev) =>
        [...prev, block].sort((a, b) => a.position - b.position),
      );
      toast.success("New block added by collaborator");
    };

    const handleBlockDeleted = ({ blockId }: { blockId: string }) => {
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      toast.success("Block deleted by collaborator");
    };

    const handleBlockMoved = ({
      blocks: updatedBlocks,
    }: {
      blocks: Block[];
    }) => {
      setBlocks((prev) => {
        const newBlocks = [...prev];
        updatedBlocks.forEach((ub) => {
          const idx = newBlocks.findIndex((b) => b.id === ub.id);
          if (idx !== -1) newBlocks[idx] = { ...newBlocks[idx], ...ub };
        });
        return newBlocks.sort((a, b) => a.position - b.position);
      });
      toast.success("Block reordered by collaborator");
    };

    socket?.on("block_updated", handleBlockUpdate);
    socket?.on("block_added", handleBlockAdded);
    socket?.on("block_deleted", handleBlockDeleted);
    socket?.on("block_moved", handleBlockMoved);
    socket?.on("user_joined", handleUserJoined);

    return () => {
      socket?.emit("leave_document", { documentId: docId });
      socket?.off("block_updated", handleBlockUpdate);
      socket?.off("block_added", handleBlockAdded);
      socket?.off("block_deleted", handleBlockDeleted);
      socket?.off("block_moved", handleBlockMoved);
      socket?.off("user_joined", handleUserJoined);

      // Clear all pending update timers
      Object.values(updateTimerRef.current).forEach(clearTimeout);
    };
  }, [workspaceId, docId, currentUser?.userId]);

  // ─────────────────────────────────────────────────────────────
  // Document Operations
  // ─────────────────────────────────────────────────────────────

  const updateDocumentTitle = useCallback(async () => {
    if (!workspaceId || !docTitle.trim()) return;
    setLoading(true);
    try {
      await documentAPI.update(workspaceId, docId as string, {
        title: docTitle,
      });
      setDocument((prev) => (prev ? { ...prev, title: docTitle } : null));
      toast.success("Title updated");
    } catch {
      toast.error("Failed to update title");
      setDocTitle(document?.title || "");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, docId, docTitle, document]);

  const deleteDocument = useCallback(async () => {
    if (!workspaceId) return;
    if (!confirm("Delete this document permanently? This cannot be undone."))
      return;

    setLoading(true);
    try {
      await documentAPI.remove(workspaceId, docId as string);
      toast.success("Document deleted");
      router.push(`/workspaces/${workspaceId}`);
    } catch {
      toast.error("Failed to delete document");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, docId, router]);

  // ─────────────────────────────────────────────────────────────
  // Block Operations
  // ─────────────────────────────────────────────────────────────

  const addBlock = useCallback(
    async (type: BlockType = "paragraph") => {
      if (!workspaceId) return;
      setLoading(true);
      try {
        const maxPos = Math.max(-1, ...blocks.map((b) => b.position));
        const { data } = await blockAPI.create(workspaceId, docId as string, {
          type,
          content: "",
          position: maxPos + 1,
        });
        setBlocks((prev) =>
          [...prev, data].sort((a, b) => a.position - b.position),
        );
        // Broadcast to others
        getSocket()?.emit("block_add", {
          documentId: docId,
          block: data,
        });
        toast.success("Block added");
      } catch {
        toast.error("Failed to add block");
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, docId, blocks],
  );

  const updateBlock = useCallback(
    async (block: Block, newContent: any) => {
      if (!workspaceId) return;

      // Optimistic update
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === block.id ? { ...b, content: newContent } : b,
        ),
      );

      // Debounce API call and Broadcast
      if (updateTimerRef.current[block.id]) {
        clearTimeout(updateTimerRef.current[block.id]);
      }

      updateTimerRef.current[block.id] = setTimeout(async () => {
        try {
          await blockAPI.update(workspaceId, docId as string, block.id, {
            content: newContent,
          });
          // Broadcast to others
          getSocket()?.emit("block_update", {
            documentId: docId,
            blockId: block.id,
            content: newContent,
          });
        } catch {
          toast.error("Failed to save block");
          // Not reverting optimistic update here for better UX, 
          // but in production we might want to flag the block as "unsaved"
        }
      }, 500);
    },
    [workspaceId, docId],
  );

  const deleteBlock = useCallback(
    async (blockId: string) => {
      if (!workspaceId) return;
      if (!confirm("Delete this block?")) return;

      try {
        await blockAPI.remove(workspaceId, docId as string, blockId);
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
        // Broadcast to others
        getSocket()?.emit("block_delete", {
          documentId: docId,
          blockId,
        });
        toast.success("Block deleted");
      } catch {
        toast.error("Failed to delete block");
      }
    },
    [workspaceId, docId],
  );

  const moveBlock = useCallback(
    async (blockId: string, direction: "up" | "down") => {
      if (!workspaceId) return;
      const index = blocks.findIndex((b) => b.id === blockId);
      if (
        (direction === "up" && index === 0) ||
        (direction === "down" && index === blocks.length - 1)
      )
        return;

      const newIndex = direction === "up" ? index - 1 : index + 1;
      const newBlocks = [...blocks];
      [newBlocks[index], newBlocks[newIndex]] = [
        newBlocks[newIndex],
        newBlocks[index],
      ];
      newBlocks.forEach((b, i) => (b.position = i));

      setBlocks(newBlocks);

      try {
        // Update both blocks' positions on server
        await Promise.all([
          blockAPI.update(workspaceId, docId as string, blockId, {
            position: newBlocks[index].position,
          }),
          blockAPI.update(
            workspaceId,
            docId as string,
            newBlocks[newIndex].id,
            { position: newBlocks[newIndex].position },
          ),
        ]);
        // Broadcast to others
        getSocket()?.emit("block_move", {
          documentId: docId,
          blocks: [newBlocks[index], newBlocks[newIndex]],
        });
      } catch {
        toast.error("Failed to reorder blocks");
        // Could revert here, but keeping it simple for MVP
      }
    },
    [workspaceId, docId, blocks],
  );

  // ─────────────────────────────────────────────────────────────
  // Version Operations
  // ─────────────────────────────────────────────────────────────

  const createVersion = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      await versionAPI.create(workspaceId, docId as string, {
        change_summary: versionSummary || undefined,
        is_major: isMajorVersion,
      });
      setVersionSummary("");
      setIsMajorVersion(false);
      setIsVersionDialogOpen(false);
      // Refresh versions list
      const { data } = await versionAPI.list(workspaceId, docId as string);
      setVersions(data);
      toast.success("Version saved");
    } catch {
      toast.error("Failed to save version");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, docId, versionSummary, isMajorVersion]);

  const restoreVersion = useCallback(
    async (versionId: string) => {
      if (!workspaceId) return;
      if (
        !confirm("Restore to this version? Current content will be replaced.")
      )
        return;

      setLoading(true);
      try {
        await versionAPI.restore(workspaceId, docId as string, versionId);
        // Refresh blocks after restore
        const { data } = await blockAPI.list(workspaceId, docId as string);
        setBlocks(data.sort((a: Block, b: Block) => a.position - b.position));
        setIsVersionDialogOpen(false);
        toast.success("Document restored");
      } catch {
        toast.error("Failed to restore version");
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, docId],
  );

  // ─────────────────────────────────────────────────────────────
  // Member Operations
  // ─────────────────────────────────────────────────────────────

  const inviteMember = useCallback(async () => {
    if (!workspaceId || !inviteEmail.trim()) return;
    setLoading(true);
    try {
      await workspaceAPI.invite(workspaceId, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteRole("MEMBER");
      // Refresh members
      const { data } = await workspaceAPI.listMembers(workspaceId);
      setMembers(data);
      toast.success(`Invite sent to ${inviteEmail}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send invite");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, inviteEmail, inviteRole]);

  const updateMemberRole = useCallback(
    async (userId: string, newRole: WorkspaceMember["role"]) => {
      if (!workspaceId) return;
      try {
        await workspaceAPI.updateMember(workspaceId, userId, newRole);
        setMembers((prev) =>
          prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)),
        );
        toast.success("Role updated");
      } catch {
        toast.error("Failed to update role");
      }
    },
    [workspaceId],
  );

  const removeMember = useCallback(
    async (userId: string) => {
      if (!workspaceId) return;
      if (!confirm("Remove this member from the workspace?")) return;
      try {
        await workspaceAPI.removeMember(workspaceId, userId);
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        toast.success("Member removed");
      } catch {
        toast.error("Failed to remove member");
      }
    },
    [workspaceId],
  );

  // ─────────────────────────────────────────────────────────────
  // Render Helpers
  // ─────────────────────────────────────────────────────────────

  const getBlockIcon = (type: BlockType) => {
    const icons: Record<BlockType, string> = {
      paragraph: "¶",
      heading_1: "H1",
      heading_2: "H2",
      heading_3: "H3",
      code: "</>",
      bullet_list: "•",
      numbered_list: "1.",
      quote: '"',
      divider: "—",
    };
    return icons[type] || "●";
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      OWNER: "bg-red-100 text-red-800",
      ADMIN: "bg-blue-100 text-blue-800",
      MEMBER: "bg-green-100 text-green-800",
      VIEWER: "bg-gray-100 text-gray-800",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  // ─────────────────────────────────────────────────────────────
  // Loading State
  // ─────────────────────────────────────────────────────────────

  if (!workspaceId || !document) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background bg-gradient-premium selection:bg-primary/10">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-white/5">
              <ChevronDown className="h-5 w-5 rotate-90" />
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                onBlur={updateDocumentTitle}
                onKeyDown={(e) => e.key === "Enter" && updateDocumentTitle()}
                className="w-auto min-w-[200px] bg-transparent border-0 font-medium text-sm focus-visible:ring-0 px-0"
                disabled={loading}
              />
              {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active Collaborators */}
            <div className="flex -space-x-2 mr-4">
              {activeCollaborators.slice(0, 5).map((u) => (
                <div key={u.userId} className="relative group/avatar">
                  <Avatar className="h-8 w-8 border-2 border-background ring-2 ring-emerald-500/20 transition-all cursor-help">
                    <AvatarFallback className="text-[10px] bg-emerald-500/10 text-emerald-500 font-bold">
                      {u.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background shadow-lg shadow-emerald-500/50" />
                  
                  {/* Tooltip */}
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-neutral-900 border border-white/10 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none z-[100]">
                    {u.email} (Active)
                  </div>
                </div>
              ))}
              
              {/* Show remaining members if any */}
              {members.filter(m => !activeCollaborators.some(ac => ac.userId === m.userId)).slice(0, 2).map((m) => (
                <Avatar key={m.userId} className="h-8 w-8 border-2 border-background opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-help">
                  <AvatarFallback className="text-[10px] bg-secondary">
                    {m.name?.[0] || m.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>

            <Button variant="outline" size="sm" className="rounded-full px-4 gap-2 border-primary/20 hover:bg-primary/5">
              <Share2 className="h-4 w-4" />
              Share
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              className={isSidebarOpen ? "bg-accent" : ""}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <History className="h-5 w-5" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="text-red-600" onClick={deleteDocument}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Main Editor Canvas */}
        <main className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? "mr-80" : ""}`}>
          {/* Cover Image Area */}
          <div className="h-56 w-full cover-gradient-default relative group/cover overflow-hidden">
             {/* Decorative noise/mesh overlay */}
             <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.75\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\' opacity=\'1\'/%3E%3C/svg%3E")', backgroundSize: '200px 200px' }} />
             {/* Glowing orbs */}
             <div className="absolute top-8 left-1/4 w-32 h-32 rounded-full bg-blue-500/20 blur-3xl" />
             <div className="absolute top-4 right-1/3 w-24 h-24 rounded-full bg-violet-500/20 blur-2xl" />
             <div className="absolute bottom-4 left-1/2 w-40 h-20 rounded-full bg-indigo-500/15 blur-3xl" />
             {/* Bottom gradient for text readability */}
             <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
             {/* Hover controls */}
             <div className="absolute right-8 bottom-4 opacity-0 group-hover/cover:opacity-100 transition-all duration-200 flex gap-2">
                <Button variant="secondary" size="sm" className="bg-background/70 backdrop-blur-md border border-white/10 hover:bg-background/90 text-xs h-8">🖼 Change Cover</Button>
             </div>
          </div>

          <div className="editor-canvas group/canvas relative">
            {/* Canvas Header */}
            <div className="mb-12">
               <div className="flex items-center gap-2 text-muted-foreground mb-4 opacity-0 group-hover/canvas:opacity-100 transition-all -translate-x-2 group-hover/canvas:translate-x-0">
                  <span className="text-xs font-medium uppercase tracking-widest">Document</span>
                  <span className="text-xs">/</span>
                  <span className="text-xs font-medium uppercase tracking-widest">{document?.workspace_id.slice(0, 8)}</span>
               </div>
               <Input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  onBlur={updateDocumentTitle}
                  className="text-5xl font-bold tracking-tight bg-transparent border-0 h-auto p-0 focus-visible:ring-0 mb-4"
                  placeholder="Untitled"
               />
               <div className="flex items-center gap-6 text-sm text-neutral-500 font-medium">
                  <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                     <Users className="h-3.5 w-3.5" />
                     <span>{members.length} Collaborators</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <Clock className="h-3.5 w-3.5" />
                     <span>{(blocks.reduce((acc, b) => acc + (typeof b.content === 'string' ? b.content.split(/\s+/).filter(Boolean).length : 0), 0) / 200).toFixed(1)} min read</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="h-3.5 w-3.5 flex items-center justify-center text-[10px] border border-neutral-500 rounded-sm">W</span>
                     <span>{blocks.reduce((acc, b) => acc + (typeof b.content === 'string' ? b.content.split(/\s+/).filter(Boolean).length : 0), 0)} words</span>
                  </div>
               </div>
            </div>

            {/* Add Block Command (Notion style) */}
            <div className="absolute -left-12 top-0 opacity-0 group-hover/canvas:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-background shadow-sm border">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 p-2">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Basic Blocks</div>
                  <DropdownMenuItem onClick={() => addBlock("paragraph")} className="gap-2 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-blue-600 font-mono text-xs">¶</span>
                    Text
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addBlock("heading_1")} className="gap-2 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-red-100 text-red-600 font-bold text-xs">H1</span>
                    Heading 1
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addBlock("heading_2")} className="gap-2 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-orange-100 text-orange-600 font-bold text-xs">H2</span>
                    Heading 2
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addBlock("code")} className="gap-2 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-600 font-mono text-xs">{"</>"}</span>
                    Code
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addBlock("bullet_list")} className="gap-2 py-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded bg-green-100 text-green-600 text-xs">•</span>
                    Bullet List
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="space-y-1">
              {blocks.map((block, index) => (
                <div key={block.id} className="group relative py-1 focus-within:bg-accent/5 rounded-lg -mx-4 px-4 transition-colors">
                  {/* Block Hover Drag Handle */}
                  <div className="block-handle group-hover:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <GripVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => moveBlock(block.id, "up")} disabled={index === 0}>Move Up</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => moveBlock(block.id, "down")} disabled={index === blocks.length - 1}>Move Down</DropdownMenuItem>
                        <Separator className="my-1" />
                        <DropdownMenuItem className="text-red-600" onClick={() => deleteBlock(block.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Block Content */}
                  <div className="w-full">
                    {block.type === "code" ? (
                      <div className="relative my-4">
                        <div className="absolute right-4 top-4 text-[10px] font-mono text-muted-foreground uppercase opacity-0 group-hover:opacity-100 transition-opacity">Code</div>
                        <textarea
                          className="w-full min-h-[140px] font-mono text-sm p-6 bg-secondary/50 rounded-xl border border-white/5 focus:ring-1 focus:ring-primary/20 backdrop-blur-sm"
                          value={typeof block.content === "string" ? block.content : ""}
                          onChange={(e) => updateBlock(block, e.target.value)}
                          placeholder="Write some code..."
                        />
                      </div>
                    ) : block.type === "divider" ? (
                      <div className="py-6">
                        <Separator className="bg-gradient-to-r from-transparent via-border to-transparent h-[1px]" />
                      </div>
                    ) : (
                      <textarea
                        rows={1}
                        className={`premium-input w-full ${
                          block.type === "heading_1" ? "text-4xl font-bold tracking-tight mb-2" :
                          block.type === "heading_2" ? "text-2xl font-semibold tracking-tight mb-1" :
                          block.type === "heading_3" ? "text-xl font-semibold mb-1" :
                          block.type === "quote" ? "border-l-2 border-primary/30 pl-4 py-1 italic text-muted-foreground text-lg" :
                          "text-lg leading-relaxed pt-1"
                        }`}
                        value={typeof block.content === "string" ? block.content : ""}
                        onChange={(e) => {
                          updateBlock(block, e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = e.target.scrollHeight + "px";
                        }}
                        onFocus={(e) => {
                          e.target.style.height = "auto";
                          e.target.style.height = e.target.scrollHeight + "px";
                        }}
                        placeholder={
                          block.type.startsWith("heading") ? "Heading" : "Type '/' for commands..."
                        }
                      />
                    )}
                  </div>
                  
                  {/* Collaborator Pulse */}
                  {block.last_edited_by_id && block.last_edited_by_id !== currentUser?.userId && (
                    <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                       <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {blocks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-xl font-medium">Your canvas is blank</p>
                  <p className="text-sm">Start typing or add a block to begin your story.</p>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Sidebar */}
        <div className={`sidebar-glass ${isSidebarOpen ? "right-0" : "-right-80 shadow-none"}`}>
          <div className="p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-8">
              <div className="flex gap-4">
                <button 
                  onClick={() => setActiveSidebarTab("versions")}
                  className={`text-sm font-semibold transition-colors ${activeSidebarTab === "versions" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  History
                </button>
                <button 
                  onClick={() => setActiveSidebarTab("members")}
                  className={`text-sm font-semibold transition-colors ${activeSidebarTab === "members" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Members
                </button>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSidebarOpen(false)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {activeSidebarTab === "versions" ? (
                <div className="space-y-6">
                  {/* Create Version */}
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mb-6">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">Snapshot</p>
                    <Input
                      placeholder="Summary..."
                      value={versionSummary}
                      onChange={(e) => setVersionSummary(e.target.value)}
                      className="bg-background/50 border-white/5 text-sm mb-3"
                    />
                    <Button size="sm" className="w-full rounded-lg" onClick={createVersion} disabled={loading}>
                      Save Version
                    </Button>
                  </div>

                  {versions.map((v) => (
                    <div key={v.id} className="group relative pl-4 border-l border-border hover:border-primary transition-colors pb-6">
                      <div className="absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-background bg-border group-hover:bg-primary transition-colors" />
                      <p className="text-sm font-bold">Version {v.version_number}</p>
                      <p className="text-xs text-muted-foreground mb-2">{v.change_summary || "Automated snapshot"}</p>
                      <p className="text-[10px] text-muted-foreground italic mb-3">{new Date(v.created_at).toLocaleDateString()}</p>
                      <Button variant="secondary" size="sm" className="h-7 text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => restoreVersion(v.id)}>
                        Restore
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                   {/* Info card pointing to workspace page */}
                   <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/15 mb-2">
                    <div className="flex items-start gap-2.5">
                      <Shield className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-blue-300 mb-1">Manage members from the Workspace page</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">To invite or remove collaborators, go back to the workspace.</p>
                      </div>
                    </div>
                  </div>

                  {members.map((m) => (
                    <div key={m.userId} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-[10px]">{m.name?.[0] || m.email[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-semibold">{m.name || m.email}</p>
                          <p className="text-[10px] text-muted-foreground">{m.role}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
