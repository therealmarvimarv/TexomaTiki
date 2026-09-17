import guestPrivacyContent from '../../content/legal/guest-privacy.txt?raw';
import LegalPageLayout from '../../components/LegalPageLayout';

export default function GuestPrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      content={guestPrivacyContent}
      backLink={{ to: '/', label: 'Back to home' }}
    />
  );
}
