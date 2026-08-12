import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";

import { signIn } from "../api/auth";
import { connectSocket } from "../socket";

export default function SignInPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      await signIn({
        email,
        password,
      });

      connectSocket();

      navigate("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.message ??
          "Invalid email or password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0a0f0c] text-white">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,#3fcf9e15,transparent_50%)]" />

      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl bg-white/[0.03] p-8 ring-1 ring-white/10 backdrop-blur">

          <div className="mb-8 text-center">
            <Link
              to="/"
              className="text-3xl font-bold tracking-tight"
            >
              Crowd<span className="text-[#3fcf9e]">Stream</span>
            </Link>

            <h1 className="mt-6 text-2xl font-semibold">
              Welcome Back
            </h1>

            <p className="mt-2 text-sm text-white/40">
              Sign in to continue to CrowdStream.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-white/70"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                required
                className="w-full rounded-lg bg-black/30 px-4 py-3 text-white outline-none ring-1 ring-white/10 transition focus:ring-[#3fcf9e]"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-white/70"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                required
                className="w-full rounded-lg bg-black/30 px-4 py-3 text-white outline-none ring-1 ring-white/10 transition focus:ring-[#3fcf9e]"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-[#ff5c5c]/20 bg-[#ff5c5c]/10 px-4 py-3 text-sm text-[#ff8080]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3fcf9e] py-3 font-semibold text-[#04241a] transition hover:bg-[#5fdcb2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                "Signing In..."
              ) : (
                <>
                  <LogIn size={16} />
                  Sign In
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-white/40">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="font-medium text-[#3fcf9e] hover:text-[#5fdcb2]"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}