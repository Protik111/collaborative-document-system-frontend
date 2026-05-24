"use client";
import { Toaster } from "react-hot-toast";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { useAuth } from "@/hooks/useAuth";

export function Providers({ children }: { children: React.ReactNode }) {
  useAuth(); // Ensures socket connection is initialized from local storage
  useSocketEvents(); // Listens for global events like workspace invites

  return (
    <>
      {children}
      <Toaster position="top-right" />
    </>
  );
}
