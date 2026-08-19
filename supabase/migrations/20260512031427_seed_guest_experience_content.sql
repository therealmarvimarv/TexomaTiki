/*
  # Seed Guest Experience Content

  ## Summary
  Seeds default FAQs, house rules, property policies (cancellation, check-in/out, pet, accessibility),
  and local recommendations for the Tiki Cottage property.

  All content is appropriate for public display and does not include private codes or access details.
*/

DO $$
DECLARE
  prop_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN

-- ── FAQs ─────────────────────────────────────────────────────────────────────

INSERT INTO faqs (property_id, question, answer, category, sort_order) VALUES
  (prop_id, 'How do I book Tiki Cottage?', 'Select your check-in and check-out dates, enter the number of guests and pets, then click "Reserve." You will be directed to a secure payment page to complete your booking.', 'Booking', 10),
  (prop_id, 'When is my booking confirmed?', 'Your booking is confirmed once your payment is successfully processed. You will receive a confirmation email with your booking details shortly after payment.', 'Booking', 20),
  (prop_id, 'Can I modify my booking after it is confirmed?', 'Please contact the host directly to request changes to your reservation. Modifications are subject to availability and the host''s approval.', 'Booking', 30),
  (prop_id, 'What payment methods are accepted?', 'We accept all major credit and debit cards through our secure Stripe checkout. Card details are never stored on our servers.', 'Payments', 10),
  (prop_id, 'Is my payment secure?', 'Yes. All payments are processed through Stripe, a PCI-compliant payment provider. Your card information is encrypted and handled securely.', 'Payments', 20),
  (prop_id, 'When will I be charged?', 'Your card is charged in full at the time of booking. No payment is held in reserve — the full amount is collected when you complete checkout.', 'Payments', 30),
  (prop_id, 'What time is check-in?', 'Check-in is at 4:00 PM. Early check-in may be available depending on prior bookings — please contact the host to inquire.', 'Check-in / Check-out', 10),
  (prop_id, 'What time is check-out?', 'Check-out is at 11:00 AM. Late check-out may be available depending on upcoming reservations — please contact the host to ask.', 'Check-in / Check-out', 20),
  (prop_id, 'How do I access the property?', 'Detailed access instructions including directions and entry information will be sent to your email after your booking is confirmed. Do not share this information.', 'Check-in / Check-out', 30),
  (prop_id, 'Is parking available?', 'Yes, parking is available on the property. Specific parking details will be included in your arrival instructions.', 'Check-in / Check-out', 40),
  (prop_id, 'Are pets allowed?', 'Pets may be allowed depending on the booking. Please add any pets to your booking request and review the pet policy for details on fees and restrictions.', 'Pets', 10),
  (prop_id, 'Is there a pet fee?', 'A pet fee may apply. The exact fee will be shown during booking if pets are included in your reservation.', 'Pets', 20),
  (prop_id, 'What is the cancellation policy?', 'Cancellation terms depend on the timing of your cancellation relative to your check-in date. Please contact the host as soon as possible if you need to cancel.', 'Cancellations', 10),
  (prop_id, 'What happens if I need to cancel last minute?', 'Late cancellations may not be eligible for a refund. Please review the cancellation policy and reach out to the host promptly if your plans change.', 'Cancellations', 20),
  (prop_id, 'Is the property family-friendly?', 'Yes, Tiki Cottage is family-friendly and suitable for guests of all ages. Please note house rules regarding supervision of children near the water.', 'House Rules', 10),
  (prop_id, 'Is smoking allowed?', 'Smoking is not permitted anywhere inside the property. Designated outdoor areas may be available — please ask the host.', 'House Rules', 20),
  (prop_id, 'How close is the cottage to local attractions?', 'Tiki Cottage is conveniently located near Lake Texoma with easy access to marinas, parks, dining, and outdoor activities. See the Local Recommendations section for nearby places.', 'Local Area', 10),
  (prop_id, 'Is the property near the water?', 'Yes, Tiki Cottage is near Lake Texoma. Please review water safety guidelines and supervise children near the water at all times.', 'Local Area', 20)
ON CONFLICT DO NOTHING;

-- ── House Rules ───────────────────────────────────────────────────────────────

INSERT INTO house_rules (property_id, title, description, icon, sort_order) VALUES
  (prop_id, 'No smoking indoors', 'Smoking is not permitted anywhere inside the property. Please smoke outdoors and dispose of materials properly.', 'Cigarette', 10),
  (prop_id, 'No parties or events', 'Parties, large gatherings, and events are not permitted. Please keep the number of guests to the reserved amount.', 'PartyPopper', 20),
  (prop_id, 'Quiet hours', 'Please observe quiet hours from 10 PM to 8 AM out of respect for neighbors.', 'Moon', 30),
  (prop_id, 'Pets must follow pet policy', 'If pets are included in your booking, please follow the pet policy rules including cleanup and furniture guidelines.', 'PawPrint', 40),
  (prop_id, 'Respect the property', 'Please treat the property with care. Guests are responsible for any damages caused during their stay.', 'Shield', 50),
  (prop_id, 'No unauthorized guests', 'Only guests listed in the booking may stay overnight. Visitors must be approved in advance.', 'Users', 60),
  (prop_id, 'Check-in and check-out times', 'Please arrive no earlier than your check-in time and depart by check-out time to allow the property to be prepared for the next guest.', 'Clock', 70),
  (prop_id, 'Leave it clean', 'Please leave the property in a tidy condition. Take out trash, do the dishes, and remove all personal belongings before departing.', 'Sparkles', 80)
ON CONFLICT DO NOTHING;

-- ── Property Policies ─────────────────────────────────────────────────────────

INSERT INTO property_policies (property_id, policy_type, title, content, metadata) VALUES
  (
    prop_id,
    'cancellation',
    'Cancellation Policy',
    'Cancellation terms vary depending on the timing of your request relative to your check-in date. Please contact the host as soon as possible if you need to cancel or change your stay. Late cancellations may not be eligible for a full refund. In the event of severe weather or emergency, please reach out directly and we will do our best to work with you.',
    '{"contact_instruction": "Contact the host directly to discuss your cancellation."}'
  ),
  (
    prop_id,
    'check_in_out',
    'Check-In & Check-Out',
    'Check-in is at 4:00 PM and check-out is at 11:00 AM. Early check-in or late check-out may be available depending on surrounding reservations — please contact the host in advance to request. Detailed access instructions will be sent to your email after your booking is confirmed.',
    '{"check_in_time": "4:00 PM", "check_out_time": "11:00 AM", "early_checkin_note": "Early check-in may be available on request.", "late_checkout_note": "Late check-out may be available on request.", "access_note": "Access instructions will be sent after booking confirmation. Do not share them.", "parking_note": "Parking is available on the property. Details in your arrival instructions."}'
  ),
  (
    prop_id,
    'pet',
    'Pet Policy',
    'Pets may be allowed depending on the booking. Please include pets when submitting your booking request. A pet fee may apply. All pets must be kept on a leash or under supervision on the property grounds. Please clean up after your pets and do not allow pets on furniture or bedding unless agreed with the host. Any damage caused by pets is the responsibility of the guest.',
    '{"pets_allowed": true, "max_pets": 2, "pet_fee_note": "Pet fee shown during booking if pets are added.", "leash_required": true, "furniture_note": "Pets are not permitted on furniture or bedding."}'
  ),
  (
    prop_id,
    'accessibility',
    'Accessibility Notes',
    'We want guests to have accurate expectations before booking. Tiki Cottage is a single-story property with level entry from the main parking area. The primary bedroom and main bathroom are on the ground floor. There are a few steps at the front entry. The property has not been independently certified for ADA compliance. Please contact the host directly with any specific accessibility questions before booking.',
    '{"single_story": true, "step_free_entry": false, "entry_steps": 2, "bedroom_floor": "ground", "bathroom_accessible": "standard tub/shower combo", "parking_distance": "adjacent", "certification_note": "Not ADA certified. Contact host for specific questions."}'
  )
ON CONFLICT (property_id, policy_type) DO NOTHING;

-- ── Local Recommendations ─────────────────────────────────────────────────────

INSERT INTO local_recommendations (property_id, name, category, description, address, distance_label, website_url, is_featured, sort_order) VALUES
  (prop_id, 'Lake Texoma State Park', 'Beaches & Outdoors', 'Beautiful state park with swimming beaches, hiking trails, and picnic areas right on the lake.', 'Lake Texoma, OK', '5 min drive', 'https://www.travelok.com/state-parks/lake-texoma', true, 10),
  (prop_id, 'Highport Marina', 'Beaches & Outdoors', 'Full-service marina with boat rentals, fishing charters, and lake access.', 'Pottsboro, TX', '10 min drive', '', true, 20),
  (prop_id, 'Lake Texoma Fishing', 'Beaches & Outdoors', 'World-class striped bass fishing. Guided charters available year-round.', 'Lake Texoma', '5 min drive', '', false, 30),
  (prop_id, 'Catfish Bay Marina', 'Beaches & Outdoors', 'Popular local marina with boat launches, camping, and lakeside dining.', 'Kingston, OK', '15 min drive', '', false, 40),
  (prop_id, 'The Dock Restaurant', 'Food & Drinks', 'Casual lakeside dining with fresh seafood, burgers, and sunset views.', 'Pottsboro, TX', '10 min drive', '', true, 50),
  (prop_id, 'Catfish Bay Café', 'Food & Drinks', 'Local favorite for catfish, BBQ, and Southern comfort food.', 'Kingston, OK', '15 min drive', '', false, 60),
  (prop_id, 'Lone Star Coffee', 'Food & Drinks', 'Cozy local coffee shop with espresso drinks, pastries, and Wi-Fi.', 'Pottsboro, TX', '8 min drive', '', false, 70),
  (prop_id, 'Walmart Supercenter', 'Shopping', 'Full-service grocery and general merchandise store for any supplies you need.', 'Pottsboro, TX', '12 min drive', '', false, 80),
  (prop_id, 'Brookshire''s Grocery', 'Shopping', 'Local grocery store with fresh produce, deli, and essentials.', 'Durant, OK', '20 min drive', '', false, 90),
  (prop_id, 'Tanglewood Resort', 'Family Activities', 'Family resort with pools, mini golf, boat rentals, and activities for all ages.', 'Pottsboro, TX', '12 min drive', 'https://www.tanglewoodresort.com', true, 100),
  (prop_id, 'Eisenhower State Park', 'Beaches & Outdoors', 'Scenic park with hiking, picnicking, and access to the lake shoreline.', 'Denison, TX', '20 min drive', '', false, 110),
  (prop_id, 'Pottsboro Animal Clinic', 'Essentials', 'Veterinary clinic for pet emergencies or health needs during your stay.', 'Pottsboro, TX', '10 min drive', '', false, 120),
  (prop_id, 'Medical Center of Southeastern Oklahoma', 'Essentials', 'Full-service hospital for medical emergencies.', 'Durant, OK', '25 min drive', '', false, 130)
ON CONFLICT DO NOTHING;

END $$;
