import React, { useEffect, useState } from 'react';
import { OFFICIAL_ALULA_LOGO_DATA_URL } from '../constants/logo';

interface TeamCrestProps {
  name: string;
  logoUrl?: string | null;
  isAlula?: boolean;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'FC';
}

export const TeamCrest: React.FC<TeamCrestProps> = ({
  name,
  logoUrl,
  isAlula = false,
  className = 'h-16 w-16'
}) => {
  const [hasFailed, setHasFailed] = useState(false);
  const source = logoUrl || (isAlula ? OFFICIAL_ALULA_LOGO_DATA_URL : null);

  useEffect(() => {
    setHasFailed(false);
  }, [source]);

  if (!source || hasFailed) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 font-black text-slate-700 ${className}`} aria-label={`${name} logo placeholder`}>
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={source}
      alt={`${name} logo`}
      className={`shrink-0 object-contain ${className}`}
      onError={() => setHasFailed(true)}
    />
  );
};