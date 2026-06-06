"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("david@gmail.com");
  const [password, setPassword] = useState("12345678");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authAPI.login(email, password);
      localStorage.setItem("access_token", data.access_token);
      toast.success("Welcome back!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-premium opacity-50" />
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px] animate-pulse" />

      <Card className="w-full max-w-md glass-card animate-in relative z-10 border-white/5 shadow-2xl">
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="mx-auto size-12 rounded-2xl bg-gradient-to-br from-neutral-200 to-neutral-500 mb-4 shadow-lg shadow-white/5" />
          <CardTitle className="text-3xl font-bold tracking-tight premium-gradient-text">
            Welcome Back
          </CardTitle>
          <p className="text-sm text-neutral-400">
            Sign in to your collaborative workspace
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Input
                placeholder="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="bg-white/5 border-white/10 h-12 focus:ring-1 focus:ring-white/20 transition-all placeholder:text-neutral-500"
              />
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="bg-white/5 border-white/10 h-12 focus:ring-1 focus:ring-white/20 transition-all placeholder:text-neutral-500"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-medium bg-neutral-100 text-neutral-900 hover:bg-white transition-all shadow-lg shadow-white/5" 
              disabled={loading}
            >
              {loading ? "Authenticating..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-sm text-neutral-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-neutral-300 hover:text-white transition-colors font-medium">
                Create an account
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
