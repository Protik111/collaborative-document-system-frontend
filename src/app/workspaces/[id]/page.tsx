"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { documentAPI, workspaceAPI } from "@/lib/api";
import type { Document } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";

import { FileText, Plus, Search, ChevronLeft, Clock, MoreVertical, FilePlus } from "lucide-react";

export default function WorkspacePage() {
  const { id } = useParams();
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [workspace, setWorkspace] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [docsRes, wsRes] = await Promise.all([
        documentAPI.list(id as string),
        workspaceAPI.get(id as string)
      ]);
      
      const data = docsRes.data;
      setWorkspace(wsRes.data);

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

  const createDoc = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await documentAPI.create(id as string, { title });
      setTitle("");
      await fetchData();
      toast.success("Document created");
    } catch {
      toast.error("Failed to create document");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in">
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
        <Card className="group cursor-pointer border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all hover:border-white/20 h-full min-h-[200px] flex flex-col items-center justify-center space-y-3">
          <div className="size-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
            <FilePlus className="size-6 text-neutral-400 group-hover:text-white transition-colors" />
          </div>
          <div className="text-center">
             <p className="font-medium text-neutral-300 group-hover:text-white transition-colors">New Document</p>
             <p className="text-xs text-neutral-500">Create a blank canvas</p>
          </div>
          
          <div className="absolute inset-x-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <Input
              placeholder="Document title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createDoc()}
              className="bg-neutral-900 border-white/10 h-8 text-xs mb-2"
              onClick={(e) => e.stopPropagation()}
            />
            <Button 
              onClick={(e) => { e.stopPropagation(); createDoc(); }} 
              disabled={loading || !title.trim()}
              className="w-full h-8 text-xs bg-neutral-100 text-neutral-900 hover:bg-white"
            >
              {loading ? "Creating..." : "Confirm"}
            </Button>
          </div>
        </Card>

        {docs.map((doc) => (
          <Card
            key={doc.id}
            className="group relative cursor-pointer glass-card hover-glow transition-all duration-300 border-white/5 flex flex-col h-[200px]"
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
    </div>
  );
}
