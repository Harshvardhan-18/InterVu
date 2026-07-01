// hooks/useAuth.ts
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, type LoginResponse } from "@/lib/api";

export function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<LoginResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = auth.load();
    if (!stored) {
      router.push("/login");
    } else {
      setUser(stored);
    }
    setLoading(false);
  }, [router]);

  return { user, loading };
}