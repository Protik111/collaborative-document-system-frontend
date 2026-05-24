import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import toast from "react-hot-toast";

export const useSocketEvents = () => {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleInviteAccepted = (payload: {
      workspaceName: string;
      role: string;
    }) => {
      toast.success(
        `You have been invited to "${payload.workspaceName}" as ${payload.role}!`,
        {
          duration: 5000,
          icon: "🎉",
        },
      );
    };

    socket.on("workspace_invite_accepted", handleInviteAccepted);

    return () => {
      socket.off("workspace_invite_accepted", handleInviteAccepted);
    };
  }, []);
};
