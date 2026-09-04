/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Off by default. To enable: set `emailAndPasswordEnabled` to `true` below,
 * then build sign-up / sign-in forms with `authClient.signUp.email` /
 * `authClient.signIn.email` from `@/lib/auth/client` (see the auth skill).
 *
 * Password reset mail lives here so `server.ts` only wires the callback.
 */
export const emailAndPasswordEnabled = true;

export async function sendResetPassword(data: {
  user: { email: string; name?: string | null };
  url: string;
  token: string;
}) {
  const { sendPasswordResetEmail } = await import("./mail.server");
  await sendPasswordResetEmail(data);
}
