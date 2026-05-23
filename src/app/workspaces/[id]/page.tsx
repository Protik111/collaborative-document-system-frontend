"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { documentAPI, workspaceAPI } from "@/lib/api";
import type { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";

export default function WorkspacePage() {
  const { id } = useParams();
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchDocs = async () => {
    try {
      const res = await documentAPI.list(id as string);
      const data = res.data;

      // API may return the documents array directly or wrapped in an object.
      if (Array.isArray(data)) {
        setDocs(data);
      } else if (Array.isArray((data as any)?.documents)) {
        setDocs((data as any).documents);
      } else if (Array.isArray((data as any)?.data)) {
        setDocs((data as any).data);
      } else {
        // Fallback: ensure `docs` is always an array to avoid `map` errors.
        console.warn("Unexpected documents response shape:", data);
        setDocs([]);
      }
    } catch {
      toast.error("Failed to load documents");
    }
  };

  const createDoc = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await documentAPI.create(id as string, { title });
      setTitle("");
      await fetchDocs();
      toast.success("Document created");
    } catch {
      toast.error("Failed to create document");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [id]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Documents</h1>
        <Button variant="outline" onClick={() => router.back()}>
          ← Back
        </Button>
      </div>

      <div className="flex gap-2 mb-6">
        <Input
          placeholder="Document title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createDoc()}
        />
        <Button onClick={createDoc} disabled={loading || !title.trim()}>
          {loading ? "Creating..." : "Create"}
        </Button>
      </div>

      <div className="space-y-3">
        {docs.map((doc) => (
          <Card
            key={doc.id}
            className="hover:bg-gray-50 cursor-pointer"
            onClick={() => router.push(`/editor/${doc.id}`)}
          >
            <CardContent className="py-4 flex justify-between items-center">
              <span className="font-medium">{doc.title}</span>
              <span className="text-xs text-gray-400">
                {new Date(doc.updated_at).toLocaleDateString()}
              </span>
            </CardContent>
          </Card>
        ))}
        {docs.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            No documents yet. Create one to start collaborating.
          </p>
        )}
      </div>
    </div>
  );
}
