import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

interface Props {
  message: string;
  onDismiss: () => void;
}

export default function Toast({ message, onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 2500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-full shadow-xl animate-fade-in">
      <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
      {message}
    </div>
  );
}
