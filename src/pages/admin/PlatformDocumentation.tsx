import platformDocumentationContent from '../../content/legal/platform-documentation.txt?raw';
import LegalPageLayout from '../../components/LegalPageLayout';

export default function PlatformDocumentation() {
  return (
    <LegalPageLayout
      title="Documentation"
      content={platformDocumentationContent}
      backLink={{ to: '/admin/account', label: 'Back to Account' }}
    />
  );
}
