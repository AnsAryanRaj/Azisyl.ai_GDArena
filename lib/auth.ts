"use client";
// Simple accounts for the hackathon: stored only in this browser, nothing is sent to a server.
// We keep only a name and an email, and the password is stored as a salted SHA-256 hash.

export interface User {
  name: string;
  email: string | null; // null for guests
  guest: boolean;
}

interface StoredUser {
  name: string;
  email: string;
  salt: string;
  hash: string;
}

const USERS = "gd-users";
const SESSION = "gd-session";

const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
};

async function hash(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Very old browsers without Web Crypto: a basic fallback so the app still works.
  let h = 0;
  for (const b of data) h = (h * 31 + b) >>> 0;
  return `fallback-${h.toString(16)}`;
}

const normEmail = (e: string) => e.trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export function currentUser(): User | null {
  return read<User | null>(SESSION, null);
}

export async function signUp(name: string, email: string, password: string): Promise<User> {
  const n = name.trim().slice(0, 30);
  const e = normEmail(email);
  if (n.length < 2) throw new Error("Enter your name, at least 2 letters.");
  if (!validEmail(e)) throw new Error("Enter a valid email, like name@college.edu.");
  if (password.length < 6) throw new Error("Use a password of at least 6 characters.");
  const users = read<StoredUser[]>(USERS, []);
  if (users.some((u) => u.email === e)) throw new Error("An account with this email already exists on this device. Log in instead.");
  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  users.push({ name: n, email: e, salt, hash: await hash(password, salt) });
  write(USERS, users);
  const user: User = { name: n, email: e, guest: false };
  write(SESSION, user);
  return user;
}

export async function logIn(email: string, password: string): Promise<User> {
  const e = normEmail(email);
  if (!validEmail(e)) throw new Error("Enter the email you signed up with.");
  const found = read<StoredUser[]>(USERS, []).find((u) => u.email === e);
  if (!found) throw new Error("No account with this email on this device. Sign up first.");
  if ((await hash(password, found.salt)) !== found.hash) throw new Error("That password is not right. Try again.");
  const user: User = { name: found.name, email: found.email, guest: false };
  write(SESSION, user);
  return user;
}

export function continueAsGuest(name: string): User {
  const user: User = { name: name.trim().slice(0, 30) || "Guest", email: null, guest: true };
  write(SESSION, user);
  return user;
}

export function logOut() {
  try {
    localStorage.removeItem(SESSION);
  } catch {}
}

/** Key used to keep each person's progress separate on a shared laptop. */
export function ownerKey(user: User | null) {
  return user?.email ? `user:${user.email}` : "guest";
}
