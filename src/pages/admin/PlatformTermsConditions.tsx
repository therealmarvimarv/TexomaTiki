import platformTermsContent from '../../content/legal/platform-terms.txt?raw';
import LegalPageLayout from '../../components/LegalPageLayout';

export default function PlatformTermsConditions() {
  return (
    <LegalPageLayout
      title="Platform Terms & Conditions"
      content={platformTermsContent}
      backLink={{ to: '/admin/account', label: 'Back to Account' }}
    />
  );
}
