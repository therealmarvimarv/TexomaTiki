import guestTermsContent from '../../content/legal/guest-terms.txt?raw';
import LegalPageLayout from '../../components/LegalPageLayout';

export default function GuestTermsConditions() {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      content={guestTermsContent}
      backLink={{ to: '/', label: 'Back to home' }}
    />
  );
}
