"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { workspaceAPI } from "@/lib/api";
import type { Workspace } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
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
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Workspaces</h1>
        <Button onClick={() => router.refresh()}>↻ Refresh</Button>
      </div>

      <div className="flex gap-2 mb-8">
        <Input
          placeholder="New workspace name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createWorkspace()}
        />
        <Button onClick={createWorkspace} disabled={loading || !newName.trim()}>
          {loading ? "Creating..." : "Create"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map((ws) => (
          <Card
            key={ws.id}
            className="cursor-pointer hover:shadow-md transition"
            onClick={() => router.push(`/workspaces/${ws.id}`)}
          >
            <CardHeader>
              <CardTitle>{ws.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-500 text-sm">
              {ws.description || "No description"}
              <div className="mt-2 text-xs text-gray-400">
                Role: {ws.my_role || "Member"}
              </div>
            </CardContent>
          </Card>
        ))}
        {workspaces.length === 0 && (
          <p className="col-span-full text-center text-gray-500 py-8">
            No workspaces yet. Create one to get started!
          </p>
        )}
      </div>
    </div>
  );
}
