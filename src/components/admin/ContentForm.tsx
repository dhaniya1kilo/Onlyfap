import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link2, UploadCloud } from 'lucide-react';
import type { ContentItem, MediaType, TagRef } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  ACCEPT_ATTR,
  externalMediaPath,
  sniffMime,
  storagePathFor,
  validateMediaFile,
  validateMediaUrl,
} from '../../utils/media';
import { removeMedia, uploadMedia } from '../../services/storageService';
import { createContent, fetchThumbnailPath, setContentTags, updateContent, type MediaInput } from '../../services/contentService';
import { captureVideoFrame } from '../../utils/thumbnail';
import { friendlyError } from '../../lib/errors';
import { TagPicker } from './TagPicker';

interface Props {
  existing?: ContentItem;
  onDone: (id: string) => void;
}

type Mode = 'file' | 'link';

const segBtn = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
    active ? 'bg-flame text-white' : 'text-muted hover:text-fg'}`;

/** Shared create/edit form. Handles file upload OR a pasted link, DB write, tag links and cleanup. */
export function ContentForm({ existing, onDone }: Props) {
  const { user, isAdmin } = useAuth();
  const [mode, setMode] = useState<Mode>('file');

  // "Upload file" mode
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<MediaType | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // "Paste link" mode
  const [linkUrl, setLinkUrl] = useState('');
  const [linkType, setLinkType] = useState<MediaType>('image');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkPreviewFailed, setLinkPreviewFailed] = useState(false);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [published, setPublished] = useState(existing?.is_published ?? true);
  const [tags, setTags] = useState<TagRef[]>(existing?.tags ?? []);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = async (f: File | undefined) => {
    setError(null);
    setSuccess(null);
    if (!f) return;
    const check = validateMediaFile(f);
    if (!check.ok) {
      setError(check.error!);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const sniffed = await sniffMime(f);
    if (!sniffed || (sniffed.split('/')[0] !== f.type.split('/')[0])) {
      setError("This file's contents don't match its type. Export it again as JPG, PNG, WEBP, MP4 or WEBM.");
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setFile(f);
    setFileType(check.mediaType!);
    setPreview(URL.createObjectURL(f));
  };

  const changeLink = (value: string) => {
    setError(null);
    setSuccess(null);
    setLinkPreviewFailed(false);
    setLinkUrl(value);
    if (!value.trim()) {
      setLinkError(null);
      return;
    }
    const check = validateMediaUrl(value);
    setLinkError(check.ok ? null : check.error!);
    if (check.mediaType) setLinkType(check.mediaType); // only override when the extension told us
  };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    setError(null);
    setSuccess(null);
  };

  const reset = () => {
    setFile(null);
    setFileType(null);
    setPreview(null);
    setLinkUrl('');
    setLinkType('image');
    setLinkError(null);
    setLinkPreviewFailed(false);
    setMode('file');
    setTitle('');
    setDescription('');
    setTags([]);
    setPublished(true);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return; // double-submit guard
    setError(null);
    setSuccess(null);
    if (!user || !isAdmin) return setError('Only admins can post content. Log in with an admin account.');
    if (!title.trim()) return setError('Add a title.');
    if (!description.trim()) return setError('Add a description.');

    const trimmedLink = linkUrl.trim();
    if (!existing && mode === 'file' && !file) return setError('Choose a photo or video to upload.');
    if (!existing && mode === 'link' && !trimmedLink) return setError('Paste a link to a photo or video.');
    let linkCheck: ReturnType<typeof validateMediaUrl> | null = null;
    if (mode === 'link' && trimmedLink) {
      linkCheck = validateMediaUrl(trimmedLink);
      if (!linkCheck.ok) return setError(linkCheck.error!);
    }

    setBusy(true);
    let uploadedPath: string | null = null;
    let uploadedThumb: string | null = null;
    const oldThumb = existing ? await fetchThumbnailPath(existing.id).catch(() => null) : null;
    try {
      let media: MediaInput | undefined;
      if (mode === 'file' && file && fileType) {
        setProgress(0);
        const path = storagePathFor(user.id, file.type);
        const res = await uploadMedia(file, path, setProgress);
        uploadedPath = res.path;
        media = { path: res.path, url: res.publicUrl, type: fileType, mime: file.type };
        if (fileType === 'video') {
          // Best effort: a poster frame makes cards load an image instead of a video.
          const frame = await captureVideoFrame(file);
          if (frame) {
            try {
              const thumb = await uploadMedia(new File([frame], 'poster', { type: frame.type }), storagePathFor(user.id, frame.type));
              uploadedThumb = thumb.path;
              media.thumbUrl = thumb.publicUrl;
              media.thumbPath = thumb.path;
            } catch {
              /* poster is optional */
            }
          }
        }
      } else if (mode === 'link' && trimmedLink && linkCheck) {
        media = { path: externalMediaPath(), url: trimmedLink, type: linkType, mime: linkCheck.mime ?? null };
      }
      const input = { title, description, is_published: published };
      let id: string;
      if (existing) {
        await updateContent(existing.id, input, media);
        id = existing.id;
      } else {
        id = await createContent(user.id, input, media!);
      }
      uploadedPath = null; // row now references the file; don't clean it up
      uploadedThumb = null;
      try {
        await setContentTags(id, tags.map((t) => t.id));
      } catch {
        setError('Saved, but the tags could not be updated. Edit the post to try again.');
      }
      if (existing && media && existing.media_path !== media.path) {
        await removeMedia(existing.media_path); // replace → remove old object (no-op for linked media)
        if (oldThumb) await removeMedia(oldThumb);
      }
      if (existing) {
        setSuccess('Changes saved.');
        onDone(id);
      } else {
        setSuccess('Content uploaded.');
        reset();
        onDone(id);
      }
    } catch (err) {
      if (uploadedPath) await removeMedia(uploadedPath); // DB failed after upload → clean up
      if (uploadedThumb) await removeMedia(uploadedThumb);
      setError(friendlyError(err, existing ? 'Could not save changes.' : 'Upload failed. Nothing was posted.'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const showPreview = preview ?? existing?.media_url ?? null;
  const previewType = fileType ?? existing?.media_type ?? null;
  const hasNewMedia = (mode === 'file' && !!file) || (mode === 'link' && !!linkUrl.trim());

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" noValidate>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="label !mb-0">Media</span>
          <div className="inline-flex rounded-full border border-ink-line bg-ink-2 p-1">
            <button type="button" onClick={() => switchMode('file')} disabled={busy} className={segBtn(mode === 'file')}>
              <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" /> Upload file
            </button>
            <button type="button" onClick={() => switchMode('link')} disabled={busy} className={segBtn(mode === 'link')}>
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> Paste link
            </button>
          </div>
        </div>

        {mode === 'file' ? (
          <label className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed border-ink-line bg-ink-2 p-3 text-center hover:border-flame-soft">
            {showPreview ? (
              previewType === 'video'
                ? <video src={showPreview} controls muted playsInline className="max-h-80 w-full rounded-lg" />
                : <img src={showPreview} alt="Preview" className="max-h-80 w-full rounded-lg object-contain" />
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-muted" aria-hidden="true" />
                <span className="text-sm font-medium">Choose a photo or video</span>
                <span className="text-xs text-muted">JPG, PNG, WEBP up to 10 MB · MP4, WEBM up to 50 MB</span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="sr-only"
              disabled={busy}
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </label>
        ) : (
          <div className="space-y-3 rounded-2xl border-2 border-dashed border-ink-line bg-ink-2 p-4">
            <div>
              <label htmlFor="media-link" className="label">Direct file link</label>
              <input
                id="media-link"
                type="url"
                inputMode="url"
                className="input"
                placeholder="https://example.com/video.mp4"
                value={linkUrl}
                onChange={(e) => changeLink(e.target.value)}
                disabled={busy}
              />
            </div>
            <fieldset className="flex items-center gap-4 text-sm">
              <legend className="mb-1 w-full text-xs font-medium text-muted">Media type</legend>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="linkType" checked={linkType === 'image'} onChange={() => setLinkType('image')} disabled={busy} className="h-4 w-4 accent-[#E11D48]" />
                Photo
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="linkType" checked={linkType === 'video'} onChange={() => setLinkType('video')} disabled={busy} className="h-4 w-4 accent-[#E11D48]" />
                Video
              </label>
            </fieldset>
            {linkError && <p className="text-xs text-[#ff8fb6]">{linkError}</p>}
            {linkUrl.trim() && !linkError && !linkPreviewFailed && (
              <div className="overflow-hidden rounded-lg bg-black">
                {linkType === 'video' ? (
                  <video
                    key={linkUrl}
                    src={linkUrl.trim()}
                    controls
                    muted
                    playsInline
                    className="max-h-72 w-full"
                    onError={() => setLinkPreviewFailed(true)}
                  />
                ) : (
                  <img
                    key={linkUrl}
                    src={linkUrl.trim()}
                    alt="Preview"
                    className="max-h-72 w-full object-contain"
                    onError={() => setLinkPreviewFailed(true)}
                  />
                )}
              </div>
            )}
            {linkPreviewFailed && (
              <p className="text-xs text-flame-soft">
                Couldn't load a preview. Make sure the link is public and points directly to the file — viewers may not be able to play it either.
              </p>
            )}
            <p className="text-xs text-muted">Link directly to a hosted .jpg, .png, .webp, .mp4 or .webm file — not a YouTube/Vimeo page link.</p>
          </div>
        )}

        {existing && (
          <p className="text-xs text-muted">
            {hasNewMedia ? 'The new media will replace the current one when you save.' : 'Choose a file or paste a link only if you want to replace the current media.'}
          </p>
        )}
        {progress !== null && (
          <div aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-ink-3">
              <div className="h-full bg-flame transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">Uploading {Math.round(progress * 100)}%</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="label">Title</label>
          <input id="title" className="input" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} required />
        </div>
        <div>
          <label htmlFor="desc" className="label">Description</label>
          <textarea id="desc" rows={5} className="input" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} required />
        </div>
        <TagPicker value={tags} onChange={setTags} disabled={busy} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} disabled={busy} className="h-4 w-4 accent-[#E11D48]" />
          Visible to the public
        </label>
        {error && <p role="alert" className="text-sm text-[#ff8fb6]">{error}</p>}
        {success && <p role="status" className="text-sm text-mint">{success}</p>}
        <button className="btn-primary px-6 py-2.5" disabled={busy}>
          {busy ? (existing ? 'Saving…' : 'Uploading…') : existing ? 'Save changes' : 'Upload content'}
        </button>
      </div>
    </form>
  );
}
