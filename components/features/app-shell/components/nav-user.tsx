"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { ProfileDialog } from "@/components/features/user-profile/components/profile-dialog";
import type { ProfileView } from "@/components/features/user-profile/lib/profile";
import { signOutAction } from "@/components/features/user-profile/lib/sign-out-action";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { toast } from "@/components/ui/toast";
import { SlidingWindowLimiter } from "@/lib/rate-limit";
import { finishStatusToast, startStatusToast } from "@/lib/toast-status";

export function NavUser() {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const limiter = useRef(new SlidingWindowLimiter({ max: 3, windowMs: 30_000 })).current;
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const res = await fetch("/api/auth/me", { signal: controller.signal });
        if (res.ok) {
          const body = (await res.json()) as { profile: ProfileView };
          setProfile(body.profile);
        }
      } catch {
        // Aborted or unreachable — the rail renders no account block rather than a fake one.
      }
      if (!controller.signal.aborted) setLoading(false);
    }
    void load();
    return () => controller.abort();
  }, []);

  const name = profile?.name ?? null;
  const email = profile?.email ?? undefined;
  const role = profile?.role ?? null;
  const initial = (name?.trim() || email || "").charAt(0).toUpperCase();

  /** The drawer and this block share the screen on phones; an action must not leave both open. */
  function closeDrawer() {
    if (isMobile) setOpenMobile(false);
  }

  function openProfile() {
    closeDrawer();
    // Closing the drawer unmounts this subtree, and with it the dialog it owns —
    // so on phones the row sends the user to the full page instead.
    if (isMobile) router.push("/profile");
    else setProfileOpen(true);
  }

  function goToAdmin() {
    closeDrawer();
    router.push("/admin");
  }

  function logOut() {
    if (pending) return;
    closeDrawer();
    if (!limiter.trySubmit()) {
      toast.add({
        type: "error",
        title: "Too many attempts",
        description: "Please wait a moment before trying again.",
      });
      return;
    }
    const statusId = startStatusToast("Sign out");
    startTransition(async () => {
      const result = await signOutAction();
      if (!result.success) {
        finishStatusToast(statusId, {
          status: "error",
          title: "Sign out failed",
          description: result.error,
        });
        return;
      }
      finishStatusToast(statusId, {
        status: "success",
        title: "Signed out",
        description: "You have been logged out.",
      });
      router.push("/");
    });
  }

  if (loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <Skeleton className="size-8 rounded-lg" />
            <div className="grid flex-1 gap-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-28" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  if (!profile) return null;

  return (
    <>
      <DropdownMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              // Three lines (role, name, email) exceed the primitive's h-12; in the
              // collapsed rail `size-8!` overrides this and only the avatar survives.
              className="h-auto py-2"
              tooltip={name || email || "Account"}
              render={<DropdownMenuTrigger />}
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {initial || <UserRound aria-hidden="true" />}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 items-start gap-0.5">
                {role && (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                    {role}
                  </span>
                )}
                <span className="truncate font-medium">{name || "My account"}</span>
                {email && (
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {email}
                  </span>
                )}
              </div>
              {/* Points right because the row opens a menu sideways, not a panel below. */}
              <ChevronRight className="ms-auto size-4" aria-hidden="true" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {/* In the drawer the row is already at the viewport's right edge, so the
            menu has to open upward; side="right" would push it off-screen. */}
        <DropdownMenuContent
          align={isMobile ? "start" : "end"}
          side={isMobile ? "top" : "right"}
          sideOffset={isMobile ? 8 : 10}
          className="w-60"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-1 px-1.5 py-1.5">
              <span className="truncate text-sm font-medium text-foreground">
                {name || "My account"}
              </span>
              {email && (
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {email}
                </span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openProfile}>
              <UserRound aria-hidden="true" />
              Profile
            </DropdownMenuItem>
            {profile.role === "admin" && (
              <DropdownMenuItem onClick={goToAdmin}>
                <ShieldCheck aria-hidden="true" />
                Admin
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={logOut} closeOnClick={false} disabled={pending} aria-busy={pending}>
              <LogOut aria-hidden="true" />
              {pending ? "Logging out…" : "Log out"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileDialog profile={profile} open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
