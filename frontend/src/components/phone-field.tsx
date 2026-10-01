import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { COUNTRY_CODES, joinPhone, splitPhone } from '@/lib/country-codes';

interface PhoneFieldProps {
  value?: string;
  onChange: (value: string) => void;
}

export function PhoneField({ value, onChange }: PhoneFieldProps) {
  const parsed = splitPhone(value || '');
  const [iso, setIso] = useState(parsed.iso);
  const [national, setNational] = useState(parsed.national);

  useEffect(() => {
    const next = splitPhone(value || '');
    setIso(next.iso);
    setNational(next.national);
  }, [value]);

  return (
    <div className="flex gap-2">
      <select
        aria-label="Country code"
        value={iso}
        onChange={(e) => {
          const nextIso = e.target.value;
          setIso(nextIso);
          onChange(joinPhone(nextIso, national));
        }}
        className="w-[9.5rem] shrink-0 rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.iso} value={c.iso}>
            +{c.dial} {c.name}
          </option>
        ))}
      </select>
      <Input
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="Phone number"
        value={national}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 14);
          setNational(digits);
          onChange(joinPhone(iso, digits));
        }}
      />
    </div>
  );
}
