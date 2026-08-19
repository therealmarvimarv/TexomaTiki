import { Star, ShieldCheck, MessageCircle, Clock, Award, Users } from 'lucide-react';

interface Props {
  hostName: string;
  hostYearsHosting: number;
  hostResponseRate: number;
  reviewCount?: number;
  rating?: number;
}

export default function MeetYourHost({ hostName, hostYearsHosting, hostResponseRate, reviewCount = 126, rating = 4.8 }: Props) {
  return (
    <div className="py-10 border-b">
      <h2 className="text-2xl font-semibold mb-8">Meet your host</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left — host card */}
        <div className="bg-gray-50 rounded-2xl p-8 flex flex-col gap-6">
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-3xl font-bold shadow-md">
                {hostName[0]}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow">
                <ShieldCheck className="w-5 h-5 text-rose-500" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{hostName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Award className="w-4 h-4 text-rose-500" />
                <span className="text-sm font-medium text-rose-600">Superhost</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-gray-200 border border-gray-200 rounded-xl overflow-hidden bg-white">
            <div className="flex flex-col items-center py-4 px-2">
              <span className="text-2xl font-bold text-gray-900">{reviewCount}</span>
              <span className="text-xs text-gray-500 mt-0.5">Reviews</span>
            </div>
            <div className="flex flex-col items-center py-4 px-2">
              <div className="flex items-center gap-1">
                <span className="text-2xl font-bold text-gray-900">{rating}</span>
                <Star className="w-4 h-4 fill-gray-900 text-gray-900" />
              </div>
              <span className="text-xs text-gray-500 mt-0.5">Rating</span>
            </div>
            <div className="flex flex-col items-center py-4 px-2">
              <span className="text-2xl font-bold text-gray-900">{hostYearsHosting}</span>
              <span className="text-xs text-gray-500 mt-0.5">Yrs hosting</span>
            </div>
          </div>

          <button className="w-full py-3 rounded-xl border-2 border-gray-900 text-gray-900 font-semibold text-sm hover:bg-gray-900 hover:text-white transition-all duration-200">
            Message host
          </button>
        </div>

        {/* Right — host details */}
        <div className="flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
              <Award className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900 text-sm">{hostName} is a Superhost</p>
                <p className="text-gray-600 text-sm mt-0.5 leading-relaxed">
                  Superhosts are experienced, highly rated hosts committed to providing great stays for every guest.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Response rate</p>
                  <p className="text-sm text-gray-500">{hostResponseRate}% — always replies</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Response time</p>
                  <p className="text-sm text-gray-500">Within an hour</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Co-hosts</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xs font-semibold">K</div>
                    <span className="text-sm text-gray-600">Kelsey</span>
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center text-white text-xs font-semibold ml-2">S</div>
                    <span className="text-sm text-gray-600">Sherry</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed border-t pt-4">
            Have questions before your stay? Use the contact form and the host will follow up with next steps.
          </p>
        </div>
      </div>
    </div>
  );
}
