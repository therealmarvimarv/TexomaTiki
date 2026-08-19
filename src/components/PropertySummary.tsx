interface Props {
  title: string;
  location: string;
  maxGuests: number;
  bedrooms: number;
  beds: number;
  bathrooms: number;
}

export default function PropertySummary({
  title,
  location,
  maxGuests,
  bedrooms,
  beds,
  bathrooms,
}: Props) {
  return (
    <div className="border-b pb-8">
      <h1 className="text-3xl font-semibold mb-2">{title}</h1>
      <p className="text-gray-600 mb-3">{location}</p>
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span>{maxGuests} guests</span>
        <span>·</span>
        <span>{bedrooms} bedrooms</span>
        <span>·</span>
        <span>{beds} beds</span>
        <span>·</span>
        <span>{bathrooms} baths</span>
      </div>
    </div>
  );
}
