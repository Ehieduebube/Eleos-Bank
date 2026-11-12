import "server-only";
import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { SessionInfo } from "@/lib/types";
import { DEMO_USER } from "../config";
import { AppError } from "../errors";
import { getLocalStore, provisionInto } from "../repository/local";
import { hashSecret, randomToken, sha256, verifySecret } from "./crypto";

/**
 * Cookie sessions for local demo mode. The cookie holds a random token; only
 * its SHA-256 is stored, so a leaked data file cannot be replayed as a session.
 */

export const LOCAL_SESSION_COOKIE = "eleos_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface LocalSessionUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isDemoUser: boolean;
}

async function currentTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(LOCAL_SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}

export async function getLocalSessionUser(): Promise<LocalSessionUser | null> {
  const tokenHash = await currentTokenHash();
  if (!tokenHash) return null;
  const nowIso = new Date().toISOString();
  return getLocalStore().read((db) => {
    const session = db.sessions.find((s) => s.tokenHash === tokenHash && s.expiresAt > nowIso);
    if (!session) return null;
    const user = db.users.find((u) => u.id === session.userId);
    if (!user) return null;
    const profile = db.profiles.find((p) => p.id === user.id);
    return {
      id: user.id,
      email: user.email,
      fullName: profile?.fullName ?? user.email,
      phone: profile?.phone ?? null,
      isDemoUser: user.isDemo,
    };
  });
}

async function startSession(userId: string): Promise<void> {
  const token = randomToken();
  const now = new Date();
  const userAgent = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await getLocalStore().write((db) => {
    const nowIso = now.toISOString();
    db.sessions = db.sessions.filter((s) => s.expiresAt > nowIso); // prune expired
    db.sessions.push({
      id: randomUUID(),
      tokenHash: sha256(token),
      userId,
      userAgent,
      createdAt: nowIso,
      lastSeenAt: nowIso,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    });
  });
  (await cookies()).set(LOCAL_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

const INVALID_CREDENTIALS = "Incorrect email or password.";

export async function signInLocal(email: string, password: string): Promise<void> {
  const user = await getLocalStore().read((db) => db.users.find((u) => u.email === email) ?? null);
  // Always run a hash comparison so response time does not reveal whether the email exists.
  const ok = await verifySecret(password, user?.passwordHash ?? "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA");
  if (!user || !user.passwordHash || !ok) throw new AppError("VALIDATION", INVALID_CREDENTIALS, { password: INVALID_CREDENTIALS });
  await startSession(user.id);
}

export async function signUpLocal(input: { fullName: string; email: string; password: string }): Promise<void> {
  const passwordHash = await hashSecret(input.password);
  const id = randomUUID();
  await getLocalStore().write((db) => {
    if (db.users.some((u) => u.email === input.email)) {
      throw new AppError("CONFLICT", "An account with this email already exists.", { email: "An account with this email already exists. Sign in instead." });
    }
    db.users.push({ id, email: input.email, passwordHash, isDemo: false, createdAt: new Date().toISOString() });
    provisionInto(db, { id, email: input.email, fullName: input.fullName, phone: null });
  });
  await startSession(id);
}

export async function signInLocalDemo(): Promise<void> {
  const store = getLocalStore();
  let demo = await store.read((db) => db.users.find((u) => u.email === DEMO_USER.email) ?? null);
  if (!demo) {
    const id = randomUUID();
    await store.write((db) => {
      if (!db.users.some((u) => u.email === DEMO_USER.email)) {
        db.users.push({ id, email: DEMO_USER.email, passwordHash: null, isDemo: true, createdAt: new Date().toISOString() });
        provisionInto(db, { id, email: DEMO_USER.email, fullName: DEMO_USER.fullName, phone: DEMO_USER.phone });
      }
    });
    demo = await store.read((db) => db.users.find((u) => u.email === DEMO_USER.email) ?? null);
  }
  if (!demo) throw new AppError("INTERNAL", "Could not start the demo session.");
  await startSession(demo.id);
}

export async function signOutLocal(): Promise<void> {
  const tokenHash = await currentTokenHash();
  if (tokenHash) await getLocalStore().write((db) => void (db.sessions = db.sessions.filter((s) => s.tokenHash !== tokenHash)));
  (await cookies()).delete(LOCAL_SESSION_COOKIE);
}

export async function listLocalSessions(userId: string): Promise<SessionInfo[]> {
  const tokenHash = await currentTokenHash();
  const nowIso = new Date().toISOString();
  return getLocalStore().read((db) =>
    db.sessions
      .filter((s) => s.userId === userId && s.expiresAt > nowIso)
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .map((s) => ({
        id: s.id,
        current: s.tokenHash === tokenHash,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
      })),
  );
}

export async function revokeLocalSession(userId: string, sessionId: string): Promise<void> {
  const tokenHash = await currentTokenHash();
  await getLocalStore().write((db) => {
    const target = db.sessions.find((s) => s.id === sessionId && s.userId === userId);
    if (!target) throw new AppError("NOT_FOUND", "Session not found.");
    if (target.tokenHash === tokenHash) throw new AppError("VALIDATION", "Use Sign out to end your current session.");
    db.sessions = db.sessions.filter((s) => s.id !== sessionId);
  });
}

export async function revokeOtherLocalSessions(userId: string): Promise<number> {
  const tokenHash = await currentTokenHash();
  return getLocalStore().write((db) => {
    const before = db.sessions.length;
    db.sessions = db.sessions.filter((s) => s.userId !== userId || s.tokenHash === tokenHash);
    return before - db.sessions.length;
  });
}

export async function changeLocalPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await getLocalStore().read((db) => db.users.find((u) => u.id === userId) ?? null);
  if (!user) throw new AppError("NOT_FOUND", "User not found.");
  if (!user.passwordHash) {
    throw new AppError("FORBIDDEN", "The shared demo profile has no password. Create your own account to try password changes.");
  }
  if (!(await verifySecret(currentPassword, user.passwordHash))) {
    throw new AppError("VALIDATION", "Your current password is incorrect.", { currentPassword: "Your current password is incorrect." });
  }
  const passwordHash = await hashSecret(newPassword);
  const tokenHash = await currentTokenHash();
  await getLocalStore().write((db) => {
    const target = db.users.find((u) => u.id === userId);
    if (target) target.passwordHash = passwordHash;
    // Changing the password signs out every other session.
    db.sessions = db.sessions.filter((s) => s.userId !== userId || s.tokenHash === tokenHash);
  });
}
