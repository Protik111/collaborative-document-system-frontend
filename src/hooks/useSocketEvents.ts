import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import toast from "react-hot-toast";

export const useSocketEvents = () => {
  useEffect(() => {
    let socket = getSocket();
    let attached = false;

    const handleInviteAccepted = (payload: {
      workspaceName: string;
      role: string;
    }) => {
      toast.success(
        `You have been invited to "${payload.workspaceName}" as ${payload.role}!`,
        { duration: 5000, icon: "🎉" },
      );
    };

    const attachListeners = (s: any) => {
      if (attached) return;
      s.on("workspace_invite_accepted", handleInviteAccepted);
      attached = true;
    };

    // If socket exists, attach immediately
    if (socket) {
      attachListeners(socket);
    }

    // Also poll for a few seconds in case it's being connected asynchronously
    const interval = setInterval(() => {
      socket = getSocket();
      if (socket) {
        attachListeners(socket);
        clearInterval(interval);
      }
    }, 500);

    // Stop polling after 10 seconds to avoid memory leaks
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
      if (socket) {
        socket.off("workspace_invite_accepted", handleInviteAccepted);
      }
    };
  }, []);
};
