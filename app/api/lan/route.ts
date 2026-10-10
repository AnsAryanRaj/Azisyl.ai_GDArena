import { networkInterfaces } from "os";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// When the host runs GD Arena on their laptop, "localhost" links do not work on a friend's phone.
// This returns the laptop's Wi-Fi address so the invite link can use it instead.
export async function GET(request: Request) {
  const port = new URL(request.url).port || "3000";
  const ips: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === "IPv4" && !a.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) ips.push(a.address);
    }
  }
  return NextResponse.json({ urls: ips.map((ip) => `http://${ip}:${port}`) });
}
