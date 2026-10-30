import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

import { asegurarInstructor, correosInstructor, estudiantePuedeEntrar } from "@/servicios/acceso"
import { registrarFalloDeDatos } from "@/lib/db"

function correoGoogle(profile: unknown): string | null {
  if (!profile || typeof profile !== "object") return null
  const datos = profile as { email?: unknown; email_verified?: unknown }
  if (typeof datos.email !== "string" || datos.email_verified !== true) return null
  return datos.email.toLowerCase()
}

function nombreGoogle(profile: unknown, email: string): string {
  if (profile && typeof profile === "object" && "name" in profile && typeof profile.name === "string") {
    const nombre = profile.name.trim()
    if (nombre) return nombre.slice(0, 120)
  }
  return email.split("@")[0] || email
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "no-configurado",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "no-configurado",
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.AUTH_SECRET) {
        return false
      }
      const email = correoGoogle(profile)
      if (!email) return false
      try {
        if (correosInstructor().includes(email)) {
          await asegurarInstructor(email, nombreGoogle(profile, email))
          return true
        }
        return await estudiantePuedeEntrar(email)
      } catch (error) {
        registrarFalloDeDatos(error, "sign-in")
        return false
      }
    },
  },
})
