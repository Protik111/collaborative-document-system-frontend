"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { blockAPI, documentAPI } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Block } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import toast from "react-hot-toast";

export default function EditorPage() {
  const { docId } = useParams();
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Fetch document to get workspace_id (required for API calls)
  useEffect(() => {
    const fetchDoc = async () => {
      try {
        // Try each workspace until we find the doc (simplified for MVP)
        // In production: add GET /documents/:id endpoint that returns workspace_id
        const { data: workspaces } = await fetch("/api/v1/workspaces", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }).then((r) => r.json());

        for (const ws of workspaces) {
          try {
            const { data } = await documentAPI.get(ws.id, docId as string);
            setWorkspaceId(ws.id);
            break;
          } catch {}
        }
      } catch {
        toast.error("Failed to load document");
        router.push("/dashboard");
      }
    };
    fetchDoc();
  }, [docId, router]);

  // Fetch blocks + setup WebSocket
  useEffect(() => {
    if (!workspaceId) return;

    const loadBlocks = async () => {
      try {
        const { data } = await blockAPI.list(workspaceId, docId as string);
        setBlocks(data.sort((a: Block, b: Block) => a.position - b.position));
      } catch {
        toast.error("Failed to load blocks");
      }
    };
    loadBlocks();

    const socket = getSocket();
    socket?.emit("join_document", { documentId: docId });

    const onBlockUpdate = ({
      blockId,
      content,
    }: {
      blockId: string;
      content: any;
    }) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, content } : b)),
      );
    };
    socket?.on("block_updated", onBlockUpdate);

    return () => {
      socket?.off("block_updated", onBlockUpdate);
    };
  }, [docId, workspaceId]);

  const addBlock = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data } = await blockAPI.create(workspaceId, docId as string, {
        type: "paragraph",
        content: "",
        position: blocks.length,
      });
      setBlocks((prev) =>
        [...prev, data].sort((a, b) => a.position - b.position),
      );
      toast.success("Block added");
    } catch {
      toast.error("Failed to add block");
    } finally {
      setLoading(false);
    }
  };

  const updateBlock = async (block: Block, newContent: any) => {
    if (!workspaceId) return;
    // Optimistic update
    setBlocks((prev) =>
      prev.map((b) => (b.id === block.id ? { ...b, content: newContent } : b)),
    );

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
      // Revert on error
      setBlocks((prev) => prev.map((b) => (b.id === block.id ? block : b)));
    }
  };

  if (!workspaceId) {
    return <div className="p-8">Loading document...</div>;
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Editor</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            ← Back
          </Button>
          <Button onClick={addBlock} disabled={loading}>
            + Add Block
          </Button>
        </div>
      </div>

      <Tabs defaultValue="edit" className="mb-4">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-4">
        {blocks.map((block) => (
          <Card key={block.id}>
            <CardContent className="p-4">
              <Input
                className="w-full border-0 p-0 text-lg focus-visible:ring-0"
                value={typeof block.content === "string" ? block.content : ""}
                onChange={(e) => updateBlock(block, e.target.value)}
                placeholder="Start typing..."
              />
              <div className="mt-2 text-xs text-gray-400">
                {block.type} • Position {block.position}
              </div>
            </CardContent>
          </Card>
        ))}
        {blocks.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No blocks yet. Click "+ Add Block" to start writing.
          </p>
        )}
      </div>
    </div>
  );
}
