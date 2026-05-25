"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loginUser } from "@/utils/supabaseClient";
import { Ship, Lock, Mail, ArrowRight, ShieldCheck, Compass } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("••••••••");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent, customEmail?: string, forceRole?: "admin" | "customer" | "manager") => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");

    const targetEmail = customEmail || email;
    if (!targetEmail) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    try {
      // Determine simulated role based on email or forced parameter
      let role: "admin" | "customer" | "manager" = "customer";
      if (forceRole) {
        role = forceRole;
      } else if (targetEmail.toLowerCase().includes("admin")) {
        role = "admin";
      } else if (targetEmail.toLowerCase().includes("manager")) {
        role = "manager";
      }

      const profile = await loginUser(targetEmail, role as any);
      
      // Redirect based on role
      if (profile.role === "admin") {
        router.push("/admin");
      } else if (profile.role === "manager") {
        router.push("/manager");
      } else {
        router.push("/client");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to log in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const triggerQuickLogin = (demoEmail: string, role: "admin" | "customer" | "manager") => {
    setEmail(demoEmail);
    handleLogin(null as any, demoEmail, role);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 overflow-hidden">
      {/* Background ambient light orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        {/* App Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4 animate-pulse">
            <Ship className="w-8 h-8 text-slate-950 stroke-[2]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            WCAT<span className="text-blue-400 font-light"> SHIPMENT TRACK</span>
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Real-Time Enterprise Shipment Coordination Portal
          </p>
        </div>

        {/* Login Panel */}
        <div className="glass-panel rounded-3xl p-8 border border-slate-800/80 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>

          <h2 className="text-xl font-semibold text-white mb-6">Security Clearance</h2>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
              {error}
            </div>
          )}

          <form onSubmit={(e) => handleLogin(e)} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Operational Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Security Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-semibold rounded-xl text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Establish Connection <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Selector */}
          <div className="mt-8 pt-6 border-t border-slate-900">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">
              Simulate Active Accounts
            </h3>
            
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => triggerQuickLogin("customer@apex.com", "customer")}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-900 hover:border-slate-800 transition-all group text-left cursor-pointer"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200">Apex Customer Portal</div>
                  <div className="text-[10px] text-slate-500">customer@apex.com</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </button>

              <button
                onClick={() => triggerQuickLogin("client@vortex.de", "customer")}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-900 hover:border-slate-800 transition-all group text-left cursor-pointer"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-200">Vortex Client Portal</div>
                  <div className="text-[10px] text-slate-500">client@vortex.de</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </button>

              <button
                onClick={() => triggerQuickLogin("admin@track.com", "admin")}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-900 hover:border-slate-800 transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      Global Logistics Admin <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    </div>
                    <div className="text-[10px] text-slate-500">admin@track.com</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </button>

              <button
                onClick={() => triggerQuickLogin("manager@track.com", "manager")}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-slate-900 hover:border-slate-800 transition-all group text-left cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      Global Operations Manager <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    </div>
                    <div className="text-[10px] text-slate-500">manager@track.com</div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-slate-600 flex items-center justify-center gap-1">
          <Compass className="w-3.5 h-3.5 text-slate-700" /> Secure SSL Encrypted Operations &bull; WCAT Shipment Track V1.4
        </div>
      </div>
    </div>
  );
}
