const LOGO_SRC = '/logo.png'

function FoxLogo({ size = 32, className = '' }) {
  return (
    <img
      src={LOGO_SRC}
      width={size}
      height={size}
      alt="CommitIQ"
      className={`object-contain brightness-0 invert ${className}`.trim()}
      aria-label="CommitIQ fox logo"
      role="img"
      draggable={false}
    />
  )
}

export default FoxLogo
