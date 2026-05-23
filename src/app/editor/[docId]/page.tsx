"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function WorkspacePage() {
  const { id } = useParams();
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    api.get(`/workspaces/${id}/documents`).then((res) => setDocs(res.data));
  }, [id]);

  const createDoc = async () => {
    await api.post(`/workspaces/${id}/documents`, { title });
    setTitle("");
    const res = await api.get(`/workspaces/${id}/documents`);
    setDocs(res.data);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Documents</h1>
      <div className="flex gap-2 mb-6">
        <input
          className="border px-3 py-2 rounded flex-1"
          placeholder="Document title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button onClick={createDoc} disabled={!title.trim()}>
          Create
        </Button>
      </div>
      <div className="space-y-3">
        {docs.map((doc) => (
          <Card
            key={doc.id}
            className="hover:bg-gray-50 cursor-pointer"
            onClick={() => router.push(`/editor/${doc.id}`)}
          >
            <CardContent className="py-4">{doc.title}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
