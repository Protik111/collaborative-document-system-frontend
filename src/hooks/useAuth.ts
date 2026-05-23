import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";

export function useAuth() {
  const [user, setUser] = useState<{ userId: string; email: string } | null>(
    null,
  );
  const router = useRouter();

  const login = async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("access_token", data.access_token);
    setUser({ userId: data.user.id, email: data.user.email });
    connectSocket(data.access_token);
    router.push("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    disconnectSocket();
    setUser(null);
    router.push("/login");
  };

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    // Optional: call /auth/me to validate & hydrate user
    connectSocket(token);
  }, []);

  return { user, login, logout };
}
