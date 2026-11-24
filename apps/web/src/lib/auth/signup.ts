/** Local registration stays on unless the operator explicitly disables it. */
export function isSignupEnabled(env = process.env) {
  return env.NEXT_PUBLIC_SIGNUP_ENABLED !== "false";
}
