import React from "react";

export const KaiCommitteeIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Central Figure */}
    <path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="M6 20c0-3.314 2.686-6 6-6s6 2.686 6 6" />

    {/* Left Figure */}
    <path d="M5 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    <path d="M2 14c0-2 1-3 3-3s3 1 3 3" />

    {/* Right Figure */}
    <path d="M19 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    <path d="M16 14c0-2 1-3 3-3s3 1 3 3" />

    {/* Outer Ring representing Vault/Protection */}
    <circle cx="12" cy="12" r="11" strokeOpacity="0.3" strokeDasharray="2 4" />
  </svg>
);

export const KaiLogoIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3L4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9L12 3z" />
    <path d="M12 11v6" />
    <path d="M9 14h6" />
  </svg>
);
