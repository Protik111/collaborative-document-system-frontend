"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Workspace } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [newName, setNewName] = useState("");
  const router = useRouter();

  const fetchWorkspaces = async () => {
    const { data } = await api.get("/workspaces");
    setWorkspaces(data);
  };

  const createWorkspace = async () => {
    if (!newName.trim()) return;
    await api.post("/workspaces", { name: newName });
    setNewName("");
    fetchWorkspaces();
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Your Workspaces</h1>
      <div className="flex gap-2 mb-8">
        <input
          className="border px-3 py-2 rounded flex-1"
          placeholder="New workspace name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button onClick={createWorkspace}>Create</Button>
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
