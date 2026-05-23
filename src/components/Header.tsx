"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, LogOut, Settings, User, Bell, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { authAPI } from "@/lib/api";
import { User as UserType } from "@/types";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserType | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await authAPI.me();
        setUser(data.user);
      } catch (err) {
        console.error("Failed to fetch user", err);
      }
    };
    if (localStorage.getItem("access_token")) {
      fetchUser();
    }
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    router.push("/login");
  };

  // Don't show header on login or editor pages
  if (pathname === "/login" || pathname.startsWith("/editor/")) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/60 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="size-8 rounded-lg bg-gradient-to-br from-neutral-200 to-neutral-400" />
            <span className="text-xl font-bold tracking-tight premium-gradient-text">
              CollabDoc
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition-colors hover:text-foreground ${
                pathname === "/dashboard" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/workspaces"
              className={`text-sm font-medium transition-colors hover:text-foreground ${
                pathname.startsWith("/workspaces") ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Workspaces
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
            <Search className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
            <Bell className="size-5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full ring-offset-background transition-all hover:ring-2 hover:ring-white/10">
                <Avatar className="h-10 w-10 border border-white/10">
                  <AvatarImage src="" alt={user?.name || "User"} />
                  <AvatarFallback className="bg-neutral-900 text-neutral-400">
                    {user?.name?.charAt(0) || user?.email?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 glass-card mt-2" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name || "User"}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem className="cursor-pointer focus:bg-white/5">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer focus:bg-white/5">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer focus:bg-white/5">
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/5" />
              <DropdownMenuItem className="cursor-pointer text-red-400 focus:bg-red-400/10 focus:text-red-400" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
