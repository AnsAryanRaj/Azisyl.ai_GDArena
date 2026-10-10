export const MicIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const StopIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="7" y="7" width="10" height="10" rx="2" />
  </svg>
);

export const SparkIcon = () => (
  <svg className="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </svg>
);

export const LogoMark = () => (
  <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="9" fill="#ffc531" />
    {[0, 72, 144, 216, 288].map((a) => (
      <circle
        key={a}
        cx={16 + 13 * Math.cos(((a - 90) * Math.PI) / 180)}
        cy={16 + 13 * Math.sin(((a - 90) * Math.PI) / 180)}
        r="3"
        fill="#ffffff"
      />
    ))}
  </svg>
);
