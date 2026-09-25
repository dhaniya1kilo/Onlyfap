// Minimal ambient types for the Cloudflare Workers runtime APIs used by
// these Pages Functions (keeps `npm run typecheck` self-contained).
// For full types you can install @cloudflare/workers-types instead.

interface HTMLRewriterElement {
  setAttribute(name: string, value: string): HTMLRewriterElement;
  setInnerContent(content: string, options?: { html?: boolean }): HTMLRewriterElement;
  append(content: string, options?: { html?: boolean }): HTMLRewriterElement;
}

interface HTMLRewriterElementHandler {
  element?(element: HTMLRewriterElement): void | Promise<void>;
}

declare class HTMLRewriter {
  constructor();
  on(selector: string, handlers: HTMLRewriterElementHandler): HTMLRewriter;
  transform(response: Response): Response;
}
