// Angular, minimal geometric fox mascot for CommitIQ.
// Uses currentColor for ears/face so it inherits text color; violet accent baked in.
function FoxLogo({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-label="CommitIQ fox logo"
      role="img"
    >
      {/* Left ear */}
      <path d="M10 8 L26 20 L14 30 Z" fill="#7c3aed" />
      {/* Right ear */}
      <path d="M54 8 L38 20 L50 30 Z" fill="#7c3aed" />
      {/* Face */}
      <path d="M14 26 L32 18 L50 26 L44 46 L32 56 L20 46 Z" fill="#a78bfa" />
      {/* Snout */}
      <path d="M24 42 L32 38 L40 42 L32 56 Z" fill="#0d1117" opacity="0.85" />
      {/* Eyes */}
      <path d="M22 30 L28 33 L23 35 Z" fill="#0d1117" />
      <path d="M42 30 L36 33 L41 35 Z" fill="#0d1117" />
      {/* Nose */}
      <circle cx="32" cy="43" r="2.2" fill="#7c3aed" />
    </svg>
  )
}

export default FoxLogo
