/**
 * CAPTCHA integration point.
 *
 * Today, spam protection for reports and removal requests is enforced in
 * Postgres (per-browser, per-email and global rate limits, duplicate
 * detection) plus a honeypot field in the form. That works without any
 * third-party service.
 *
 * To add a CAPTCHA (e.g. Cloudflare Turnstile or hCaptcha):
 *   1. Implement `getChallengeToken()` to render the widget and return its token.
 *   2. Submit through a server function (Supabase Edge Function or Cloudflare
 *      Pages Function) that verifies the token with the provider's secret key
 *      and only then calls the submit RPC with the service role.
 *   3. Revoke EXECUTE on submit_removal_request / submit_content_report from
 *      `anon` so the browser can no longer skip the check.
 * A token that is only checked in the browser provides no protection, so
 * this default implementation deliberately does nothing.
 */
export interface CaptchaProvider {
  id: string;
  getChallengeToken(action: string): Promise<string | null>;
}

export const noCaptcha: CaptchaProvider = {
  id: 'none',
  async getChallengeToken() {
    return null;
  },
};

export const captcha: CaptchaProvider = noCaptcha;
