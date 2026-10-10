import type { Persona } from "@/lib/types";

type Look = Persona["look"];

const YOU: Look = { skin: "#e8b98f", hair: "#1f1a17", style: "short" };

/** Small illustrated portrait, drawn to match the campus scene. */
export default function Avatar({
  look = YOU,
  shirt = "#f6c445",
  size = 56,
  label,
}: {
  look?: Look;
  shirt?: string;
  size?: number;
  label?: string;
}) {
  const { skin, hair, style, glasses } = look;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="avatar"
    >
      <circle cx="32" cy="32" r="32" fill="#ffffff" opacity="0.9" />
      <clipPath id="av-clip">
        <circle cx="32" cy="32" r="31" />
      </clipPath>
      <g clipPath="url(#av-clip)">
        {style === "long" && <path d="M16 30 q0 -18 16 -18 q16 0 16 18 v22 h-32z" fill={hair} />}
        {style === "pony" && <path d="M44 22 q12 6 6 26 q-4 -10 -8 -14z" fill={hair} />}
        <path d="M10 64 q2 -16 22 -16 q20 0 22 16z" fill={shirt} />
        <rect x="27" y="38" width="10" height="10" rx="3" fill={skin} />
        <ellipse cx="32" cy="29" rx="12" ry="13" fill={skin} />
        {style === "short" && <path d="M19.5 27 q0 -14 12.5 -14 q13 0 12.5 14 q-3 -7 -12.5 -7 q-9 0 -12.5 7z" fill={hair} />}
        {style === "curly" && (
          <g fill={hair}>
            {[20, 25, 31, 37, 43].map((x, i) => (
              <circle key={x} cx={x} cy={i % 2 ? 16 : 19} r="6" />
            ))}
            <circle cx="19" cy="24" r="4" />
            <circle cx="45" cy="24" r="4" />
          </g>
        )}
        {(style === "long" || style === "pony" || style === "bun") && (
          <path d="M19.5 28 q0 -15 12.5 -15 q13 0 12.5 15 q-6 -9 -14 -8 q-6 1 -11 8z" fill={hair} />
        )}
        {style === "bun" && <circle cx="32" cy="11" r="6" fill={hair} />}
        <circle cx="27.5" cy="30" r="1.6" fill="#1f1a17" />
        <circle cx="36.5" cy="30" r="1.6" fill="#1f1a17" />
        <path d="M28.5 35.5 q3.5 2.6 7 0" stroke="#7b4026" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        {glasses && (
          <g stroke="#1f1a17" strokeWidth="1.4" fill="none">
            <circle cx="27.5" cy="30" r="3.6" />
            <circle cx="36.5" cy="30" r="3.6" />
            <path d="M31 30 h2" />
          </g>
        )}
      </g>
    </svg>
  );
}
