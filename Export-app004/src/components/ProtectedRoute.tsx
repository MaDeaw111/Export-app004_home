"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser, UserProfile } from "@/utils/supabaseClient";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: "admin" | "customer" | "manager";
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check user session client-side after hydration
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      router.push("/");
      return;
    }

    if (currentUser.role !== allowedRole) {
      // Redirect to login if user role doesn't match
      router.push("/");
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(currentUser);
    setLoading(false);
  }, [router, allowedRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 border-2 border-blue-500/20 border-t-blue-400 rounded-full animate-spin"></div>
          <div className="absolute w-6 h-6 border border-cyan-400/20 border-b-cyan-400 rounded-full animate-spin [animation-duration:0.8s] [animation-direction:reverse]"></div>
        </div>
        <p className="mt-4 text-xs font-semibold text-slate-500 tracking-widest uppercase animate-pulse">
          Validating Security Token...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
