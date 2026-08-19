import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Phone, MessageCircle, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  propertyId: string;
}

interface ContactInfo {
  email: string | null;
  phone: string | null;
  response_time: string | null;
}

export default function ContactSection({ propertyId }: Props) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [contact, setContact] = useState<ContactInfo>({
    email: null,
    phone: null,
    response_time: null,
  });

  useEffect(() => {
    supabase
      .from('contact_info')
      .select('email, phone, response_time')
      .eq('property_id', propertyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setContact(data);
      });
  }, [propertyId]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    // Save directly to DB — guaranteed even if email edge function is unavailable
    const { data: saved } = await supabase.from('inquiries').insert({
      property_id: propertyId,
      sender_name: form.name,
      sender_email: form.email,
      message: form.message,
      status: 'new',
    }).select('id').maybeSingle();

    // Fire edge function for email notification; ignore any failure
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        type: 'contact',
        senderName: form.name,
        senderEmail: form.email,
        message: form.message,
        propertyId,
        inquiryId: saved?.id ?? null,
      }),
    }).catch(() => {});

    navigate('/inquiry/success');
    setSubmitting(false);
  }

  return (
    <section id="contact" className="py-12 border-t border-gray-200">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Get in touch</h2>
          <p className="text-gray-500 leading-relaxed mb-8">
            Have a question about the property, availability, or anything else? Reach out and we'll get back to you as soon as possible.
          </p>

          <div className="space-y-5">
            {contact.email && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Email</p>
                <a
                  href={`mailto:${contact.email}`}
                  className="text-gray-500 text-sm hover:text-gray-900 transition-colors"
                >
                  {contact.email}
                </a>
              </div>
            </div>
            )}

            {contact.phone && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Phone</p>
                <a
                  href={`tel:${contact.phone.replace(/\D/g, '')}`}
                  className="text-gray-500 text-sm hover:text-gray-900 transition-colors"
                >
                  {contact.phone}
                </a>
              </div>
            </div>
            )}

            {contact.response_time && (
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-5 h-5 text-gray-700" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Response time</p>
                <p className="text-gray-500 text-sm">{contact.response_time}</p>
              </div>
            </div>
            )}

            {!contact.email && !contact.phone && !contact.response_time && (
              <p className="text-sm text-gray-500">Contact details will be provided by the host.</p>
            )}
          </div>
        </div>

        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your name"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@email.com"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  required
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Ask about availability, the property, local recommendations..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-gray-900 text-white font-medium text-sm rounded-xl hover:bg-gray-700 disabled:opacity-60 transition-colors"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Sending...' : 'Send message'}
              </button>
            </form>
        </div>
      </div>
    </section>
  );
}
