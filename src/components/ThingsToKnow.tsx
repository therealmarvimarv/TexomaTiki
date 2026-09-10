interface Props {
  houseRules: string;
  cancellationPolicy: string;
  safetyNotes: string;
  heading?: string;
  houseRulesTitle?: string;
  cancellationPolicyTitle?: string;
  safetyNotesTitle?: string;
}

export default function ThingsToKnow({
  houseRules,
  cancellationPolicy,
  safetyNotes,
  heading,
  houseRulesTitle,
  cancellationPolicyTitle,
  safetyNotesTitle,
}: Props) {
  return (
    <div className="py-8 border-b">
      <h2 className="text-2xl font-semibold mb-6">{heading ?? 'Things to know'}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="font-semibold mb-3">{houseRulesTitle ?? 'House rules'}</h3>
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{houseRules}</p>
        </div>
        <div>
          <h3 className="font-semibold mb-3">{cancellationPolicyTitle ?? 'Cancellation policy'}</h3>
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{cancellationPolicy}</p>
        </div>
        <div>
          <h3 className="font-semibold mb-3">{safetyNotesTitle ?? 'Safety & property'}</h3>
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{safetyNotes}</p>
        </div>
      </div>
    </div>
  );
}
