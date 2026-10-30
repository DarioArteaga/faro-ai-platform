"use server"

import { signOut } from "@/auth"

export async function salir(): Promise<void> {
  await signOut({ redirectTo: "/login" })
}
