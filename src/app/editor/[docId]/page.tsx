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

    const handleUserJoined = ({ email }: { email: string }) => {
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Input
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              onBlur={updateDocumentTitle}
              onKeyDown={(e) => e.key === "Enter" && updateDocumentTitle()}
              className="max-w-xs font-semibold text-lg border-0 focus-visible:ring-1"
              disabled={loading}
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          <div className="flex items-center gap-2">
            {/* Versions Dialog */}
            <Dialog
              open={isVersionDialogOpen}
              onOpenChange={setIsVersionDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="mr-2 h-4 w-4" />
                  Versions
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Version History</DialogTitle>
                  <DialogDescription>
                    Save snapshots or restore to a previous version.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Create New Version */}
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="What changed? (optional)"
                          value={versionSummary}
                          onChange={(e) => setVersionSummary(e.target.value)}
                          className="flex-1"
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isMajorVersion}
                            onChange={(e) =>
                              setIsMajorVersion(e.target.checked)
                            }
                          />
                          Major version
                        </label>
                        <Button
                          size="sm"
                          onClick={createVersion}
                          disabled={loading}
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Versions List */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {versions.map((v) => (
                      <Card key={v.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              v{v.version_number}
                              {v.is_major && (
                                <Badge variant="secondary" className="ml-2">
                                  Major
                                </Badge>
                              )}
                            </div>
                            {v.change_summary && (
                              <p className="text-sm text-muted-foreground">
                                {v.change_summary}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(v.created_at).toLocaleString()} •{" "}
                              {v.block_count} blocks
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => restoreVersion(v.id)}
                            disabled={loading}
                          >
                            <Undo2 className="mr-2 h-4 w-4" />
                            Restore
                          </Button>
                        </div>
                      </Card>
                    ))}
                    {versions.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        No versions yet. Save your first snapshot above.
                      </p>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Members Dialog */}
            <Dialog
              open={isMembersDialogOpen}
              onOpenChange={setIsMembersDialogOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Users className="mr-2 h-4 w-4" />
                  Members
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Workspace Members</DialogTitle>
                  <DialogDescription>
                    Invite collaborators or manage roles.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Invite Form */}
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Email to invite"
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="flex-1"
                        />
                        <Select
                          value={inviteRole}
                          onValueChange={(value) =>
                            setInviteRole(value as WorkspaceMember["role"])
                          }
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="VIEWER">Viewer</SelectItem>
                            <SelectItem value="MEMBER">Member</SelectItem>
                            <SelectItem value="ADMIN">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={inviteMember}
                          disabled={loading || !inviteEmail.trim()}
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Members List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {members.map((m) => (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src="" />
                            <AvatarFallback>
                              {m.name?.[0]?.toUpperCase() ||
                                m.email[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">
                              {m.name || m.email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {m.email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getRoleColor(m.role)}>
                            {m.role}
                          </Badge>
                          {currentUser?.role === "OWNER" &&
                            m.userId !== currentUser.userId && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateMemberRole(m.userId, "ADMIN")
                                    }
                                  >
                                    Make Admin
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateMemberRole(m.userId, "MEMBER")
                                    }
                                  >
                                    Make Member
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      updateMemberRole(m.userId, "VIEWER")
                                    }
                                  >
                                    Make Viewer
                                  </DropdownMenuItem>
                                  <Separator className="my-1" />
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => removeMember(m.userId)}
                                  >
                                    Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Document Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={updateDocumentTitle}>
                  <Save className="mr-2 h-4 w-4" />
                  Save Title
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={deleteDocument}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Editor Content */}
      <main className="mx-auto max-w-3xl p-6">
        <Tabs defaultValue="edit" className="mb-6">
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="versions">
              Versions ({versions.length})
            </TabsTrigger>
            <TabsTrigger value="members">
              Members ({members.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="space-y-4">
            {/* Add Block Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Block
                  <ChevronDown className="ml-auto h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => addBlock("paragraph")}>
                  Paragraph
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock("heading_1")}>
                  Heading 1
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock("heading_2")}>
                  Heading 2
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock("code")}>
                  Code Block
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock("bullet_list")}>
                  Bullet List
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock("quote")}>
                  Quote
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => addBlock("divider")}>
                  Divider
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Blocks List */}
            {blocks.map((block, index) => (
              <Card key={block.id} className="group relative">
                <CardContent className="p-4">
                  {/* Block Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">
                        {getBlockIcon(block.type)}
                      </span>
                      <span>{block.type.replace("_", " ")}</span>
                      <span>•</span>
                      <span>Position {block.position}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveBlock(block.id, "up")}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveBlock(block.id, "down")}
                        disabled={index === blocks.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600"
                        onClick={() => deleteBlock(block.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Block Content */}
                  {block.type === "code" ? (
                    <textarea
                      className="w-full min-h-[120px] font-mono text-sm p-3 bg-muted rounded border-0 focus:ring-1 focus:ring-primary"
                      value={
                        typeof block.content === "string" ? block.content : ""
                      }
                      onChange={(e) => updateBlock(block, e.target.value)}
                      placeholder="Enter code..."
                    />
                  ) : block.type === "divider" ? (
                    <Separator className="my-4" />
                  ) : (
                    <Input
                      className={`w-full border-0 p-0 text-lg focus-visible:ring-0 ${
                        block.type.startsWith("heading") ? "font-bold" : ""
                      } ${block.type === "quote" ? "border-l-4 pl-4 italic" : ""}`}
                      value={
                        typeof block.content === "string" ? block.content : ""
                      }
                      onChange={(e) => updateBlock(block, e.target.value)}
                      placeholder={
                        block.type === "heading_1"
                          ? "Heading 1"
                          : block.type === "heading_2"
                            ? "Heading 2"
                            : "Start typing..."
                      }
                    />
                  )}

                  {/* Last Edited */}
                  {block.last_edited_by_id &&
                    block.last_edited_by_id !== currentUser?.userId && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last edited by collaborator
                      </p>
                    )}
                </CardContent>
              </Card>
            ))}

            {blocks.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  No blocks yet. Click "Add Block" above to start writing.
                </p>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="versions">
            {/* Reuse version dialog content or show inline list */}
            <div className="space-y-3">
              {versions.map((v) => (
                <Card key={v.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        v{v.version_number}
                        {v.is_major && (
                          <Badge variant="secondary" className="ml-2">
                            Major
                          </Badge>
                        )}
                      </div>
                      {v.change_summary && (
                        <p className="text-sm text-muted-foreground">
                          {v.change_summary}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restoreVersion(v.id)}
                    >
                      <Undo2 className="mr-2 h-4 w-4" />
                      Restore
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="members">
            <div className="space-y-3">
              {members.map((m) => (
                <Card key={m.userId} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {m.name?.[0]?.toUpperCase() ||
                            m.email[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{m.name || m.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {m.email}
                        </p>
                      </div>
                    </div>
                    <Badge className={getRoleColor(m.role)}>{m.role}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
