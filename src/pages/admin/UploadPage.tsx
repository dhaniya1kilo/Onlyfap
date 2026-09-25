import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ContentForm } from '../../components/admin/ContentForm';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export default function UploadPage() {
  useDocumentTitle('Upload content', true);
  const [lastId, setLastId] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Upload content</h1>
      <p className="max-w-prose rounded-xl border border-velvet/40 bg-velvet/10 p-3 text-sm text-fg/90">
        Only upload content where every person depicted was 18+ when it was made and consented to recording and publication, and you hold the
        rights. After uploading, record consent and age-verification status under <strong>Edit → Compliance records</strong>.
      </p>
      {lastId && (
        <p className="panel p-3 text-sm">
          Posted. <Link to={`/content/${lastId}`} className="text-flame-soft underline">View it</Link> or upload another below.
        </p>
      )}
      <ContentForm onDone={setLastId} />
    </div>
  );
}
