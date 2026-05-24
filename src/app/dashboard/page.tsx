"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { workspaceAPI } from "@/lib/api";
import type { Workspace } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, MoreVertical, LayoutGrid, List as ListIcon, Clock, Users } from "lucide-react";

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  const fetchWorkspaces = async () => {
    try {
      const { data } = await workspaceAPI.list();
      setWorkspaces(data);
    } catch {
      toast.error("Failed to load workspaces");
    }
  };

  const createWorkspace = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await workspaceAPI.create({ name: newName });
      setNewName("");
      setIsModalOpen(false);
      await fetchWorkspaces();
      toast.success("Workspace created");
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in min-h-screen bg-gradient-premium">
      {/* Subtle accent glow */}
      <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full opacity-30" style={{ background: 'radial-gradient(ellipse at center, oklch(0.35 0.15 265 / 50%), transparent 70%)' }} />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight premium-gradient-text">Workspaces</h1>
          <p className="text-muted-foreground mt-1">Manage and collaborate on your shared documents</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Search workspaces..." 
              className="pl-10 bg-white/5 border-white/10 h-10 focus:ring-1 focus:ring-white/20"
            />
          </div>
          <Button onClick={() => router.refresh()} variant="outline" className="border-white/10 hover:bg-white/5">
            ↻ Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Create Workspace Card */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Card className="group cursor-pointer border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all hover:border-white/20 h-full min-h-[160px] flex flex-col items-center justify-center space-y-3 relative overflow-hidden">
              <div className="size-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
                <Plus className="size-6 text-neutral-400 group-hover:text-white transition-colors" />
              </div>
              <div className="text-center">
                 <p className="font-medium text-neutral-300 group-hover:text-white transition-colors">Create Workspace</p>
                 <p className="text-xs text-neutral-500">Start a new collaboration</p>
              </div>
            </Card>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white">Create New Workspace</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Workspace name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createWorkspace()}
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
                onClick={createWorkspace} 
                disabled={loading || !newName.trim()}
                className="bg-neutral-100 text-neutral-900 hover:bg-white"
              >
                {loading ? "Creating..." : "Create Workspace"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {workspaces.map((ws) => (
          <Card
            key={ws.id}
            className="group relative cursor-pointer bg-white/[0.03] hover:bg-white/[0.05] transition-all duration-300 border-white/10 flex flex-col h-full rounded-2xl overflow-hidden"
            onClick={() => router.push(`/workspaces/${ws.id}`)}
          >
            <CardHeader className="pb-3 flex-row items-start justify-between space-y-0">
              <div className="flex flex-col gap-1">
                <div className="size-10 rounded-xl bg-gradient-to-br from-neutral-300 to-neutral-600 mb-2 opacity-50 shadow-inner" />
                <CardTitle className="text-xl group-hover:text-white transition-colors">{ws.name}</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="size-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/5" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 text-muted-foreground text-sm flex flex-col justify-between">
              <p className="line-clamp-2 italic mb-4">
                {ws.description || "No description provided. Click to add one."}
              </p>
              <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium uppercase tracking-wider">
                <div className="flex items-center gap-2">
                   <Users className="size-3" />
                   {ws.my_role || "Member"}
                </div>
                <div className="flex items-center gap-2">
                   <Clock className="size-3" />
                   {new Date(ws.updated_at).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {workspaces.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl animate-in">
           <LayoutGrid className="size-12 text-neutral-700 mb-4" />
           <h3 className="text-xl font-medium text-neutral-300">No workspaces yet</h3>
           <p className="text-neutral-500 mb-6">Create your first workspace to start collaborating.</p>
        </div>
      )}
    </div>
  );
}
