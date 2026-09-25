import type {
  BrowseSort,
  ModerationState,
  Priority,
  RemovalReason,
  RemovalResolution,
  RemovalStatus,
  ReportReason,
  ReportStatus,
  SearchSort,
} from '../types';

export const BROWSE_SORTS: { value: BrowseSort; label: string; param: string }[] = [
  { value: 'trending', label: 'Trending', param: 'trending' },
  { value: 'most_viewed', label: 'Most viewed', param: 'most-viewed' },
  { value: 'new', label: 'New', param: 'new' },
  { value: 'old', label: 'Old', param: 'old' },
];

export function browseSortFromParam(p: string | null): BrowseSort {
  return BROWSE_SORTS.find((s) => s.param === p)?.value ?? 'trending';
}
export function browseSortParam(s: BrowseSort): string {
  return BROWSE_SORTS.find((x) => x.value === s)?.param ?? 'trending';
}

export const SEARCH_SORTS: { value: SearchSort; label: string; param: string }[] = [
  { value: 'relevance', label: 'Relevance', param: 'relevance' },
  { value: 'most_viewed', label: 'Most viewed', param: 'most-viewed' },
  { value: 'new', label: 'Newest', param: 'new' },
  { value: 'old', label: 'Oldest', param: 'old' },
];

export function searchSortFromParam(p: string | null): SearchSort {
  return SEARCH_SORTS.find((s) => s.param === p)?.value ?? 'relevance';
}

export const REMOVAL_REASONS: { value: RemovalReason; label: string; hint?: string }[] = [
  { value: 'person_depicted', label: 'I am the person depicted', hint: 'Treated as urgent.' },
  { value: 'consent_issue', label: 'Consent issue (not everyone depicted agreed)', hint: 'Treated as urgent.' },
  { value: 'underage_concern', label: 'Someone depicted may be under 18', hint: 'Treated as urgent.' },
  { value: 'no_permission', label: 'Content was uploaded without permission' },
  { value: 'copyright_owner', label: 'I own the copyright' },
  { value: 'privacy', label: 'Privacy concern (personal information shown)' },
  { value: 'misleading', label: 'Incorrect or misleading content' },
  { value: 'other', label: 'Other' },
];

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'underage_concern', label: 'May involve someone under 18' },
  { value: 'non_consensual', label: 'Non-consensual or private content' },
  { value: 'illegal', label: 'Illegal content' },
  { value: 'violence', label: 'Violence or abuse' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'broken_media', label: 'Video or image does not load' },
  { value: 'wrong_tags', label: 'Wrong title or tags' },
  { value: 'other', label: 'Something else' },
];

export const REMOVAL_STATUSES: { value: RemovalStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
];

export const RESOLUTIONS: { value: RemovalResolution; label: string }[] = [
  { value: 'content_removed', label: 'Content removed' },
  { value: 'content_hidden', label: 'Content hidden' },
  { value: 'content_kept', label: 'Content kept (request declined)' },
  { value: 'no_action_needed', label: 'No action needed' },
];

export const REPORT_STATUSES: { value: ReportStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'actioned', label: 'Actioned' },
  { value: 'dismissed', label: 'Dismissed' },
];

export const MODERATION_STATES: { value: ModerationState; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'under_review', label: 'Under review (still visible)' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'removed', label: 'Removed' },
];

export function labelOf<T extends string>(list: { value: T; label: string }[], v: T | null | undefined): string {
  return list.find((x) => x.value === v)?.label ?? (v ?? '—');
}

export const PRIORITY_STYLE: Record<Priority, string> = {
  urgent: 'bg-flame text-white',
  high: 'bg-velvet/30 text-[#DDD6FE]',
  normal: 'bg-ink-3 text-muted',
};
