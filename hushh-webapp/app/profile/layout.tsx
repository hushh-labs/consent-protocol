"use client";

import { VaultLockGuard } from "@/components/vault/vault-lock-guard";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <VaultLockGuard>{children}</VaultLockGuard>;
}
