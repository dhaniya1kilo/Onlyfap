import { useSeo } from './useSeo';

/** Back-compat wrapper: title-only pages. Admin/account pages pass noindex. */
export function useDocumentTitle(title?: string, noindex = false) {
  useSeo({ title, noindex });
}
