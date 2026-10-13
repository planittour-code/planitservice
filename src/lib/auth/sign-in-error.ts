export function signInErrorMessage(err: unknown) {
  const raw = err instanceof Error ? err.message : "";
  const lower = raw.toLowerCase();
  if (
    !raw ||
    lower.includes("invalid") ||
    lower.includes("credential") ||
    lower.includes("password") ||
    lower.includes("not found") ||
    lower.includes("unauthorized")
  ) {
    return "Email or password did not match. Check the email, then use Forgot password under the field if you need a reset link.";
  }
  return raw;
}
