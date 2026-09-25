import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/States';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <EmptyState title="This page doesn't exist">
      Check the address, or <Link to="/" className="text-flame-soft underline">go back to the feed</Link>.
    </EmptyState>
  );
}
