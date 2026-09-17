import platformPrivacyContent from '../../content/legal/platform-privacy.txt?raw';
import LegalPageLayout from '../../components/LegalPageLayout';

export default function PlatformPrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Platform Privacy Policy"
      content={platformPrivacyContent}
      backLink={{ to: '/admin/account', label: 'Back to Account' }}
    />
  );
}
