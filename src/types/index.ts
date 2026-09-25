export type MediaType = 'image' | 'video';
export type Role = 'user' | 'admin';
export type AdType = 'link' | 'html' | 'embed';
export type ModerationState = 'active' | 'under_review' | 'hidden' | 'removed';

/** Discovery orderings, computed in Postgres (browse_content). */
export type BrowseSort = 'trending' | 'most_viewed' | 'new' | 'old';
/** Search orderings, computed in Postgres (search_content). */
export type SearchSort = 'relevance' | 'most_viewed' | 'new' | 'old';

export interface Profile {
  id: string;
  role: Role;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface TagRef {
  id: string;
  name: string;
  slug: string;
}

export interface Tag extends TagRef {
  is_category: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TagWithUsage extends Tag {
  usage_count: number;
}

/** Row of the `content_feed` view. */
export interface ContentItem {
  id: string;
  admin_id: string;
  media_path: string;
  media_url: string;
  media_type: MediaType;
  mime_type: string | null;
  /** Poster image for videos (captured at upload), or null. */
  thumbnail_url: string | null;
  title: string;
  description: string;
  is_published: boolean;
  view_count: number;
  like_count: number;
  moderation_state: ModerationState;
  created_at: string;
  updated_at: string;
  uploader_name: string | null;
  tags: TagRef[];
}

export interface Ad {
  id: string;
  admin_id: string;
  ad_type: AdType;
  label: string | null;
  ad_content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
  total?: number;
}

export interface SearchSuggestion {
  kind: 'query' | 'tag' | 'content';
  label: string;
  value: string;
  weight: number;
}

// ---------------- moderation ----------------

export type RemovalReason =
  | 'person_depicted'
  | 'copyright_owner'
  | 'no_permission'
  | 'consent_issue'
  | 'underage_concern'
  | 'misleading'
  | 'privacy'
  | 'other';

export type RemovalStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected';
export type RemovalResolution = 'content_kept' | 'content_hidden' | 'content_removed' | 'no_action_needed';
export type Priority = 'normal' | 'high' | 'urgent';

export interface RemovalRequest {
  id: string;
  reference: string;
  content_id: string | null;
  content_url: string | null;
  content_snapshot: { title?: string; media_url?: string } | null;
  email: string;
  name: string | null;
  reason: RemovalReason;
  details: string;
  additional_info: string | null;
  good_faith_confirmed: boolean;
  priority: Priority;
  status: RemovalStatus;
  resolution: RemovalResolution | null;
  admin_notes: string | null;
  ack_sent_at: string | null;
  last_response_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ReportReason =
  | 'underage_concern'
  | 'non_consensual'
  | 'illegal'
  | 'violence'
  | 'spam'
  | 'broken_media'
  | 'wrong_tags'
  | 'other';
export type ReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned';

export interface ContentReport {
  id: string;
  content_id: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ModerationAction {
  id: number;
  content_id: string | null;
  removal_request_id: string | null;
  report_id: string | null;
  actor_id: string | null;
  action: string;
  from_value: string | null;
  to_value: string | null;
  note: string | null;
  created_at: string;
}

export interface ContentCompliance {
  content_id: string;
  consent_status: 'unknown' | 'documented' | 'missing' | 'disputed';
  age_verification_status: 'unverified' | 'verified' | 'failed';
  ownership_basis: 'unknown' | 'owned' | 'licensed' | 'performer_submitted' | 'other';
  performer_count: number | null;
  records_reference: string | null;
  custodian_note: string | null;
  verified_by: string | null;
  verified_at: string | null;
  updated_at?: string;
}

export interface DashboardStats {
  total_content: number;
  public_content: number;
  hidden_content: number;
  under_review: number;
  total_views: number;
  total_likes: number;
  views_7d: number;
  likes_7d: number;
  active_ads: number;
  total_tags: number;
  pending_removals: number;
  urgent_removals: number;
  open_reports: number;
  total_users: number;
  missing_compliance: number;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  is_anonymous: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  like_count: number;
}
