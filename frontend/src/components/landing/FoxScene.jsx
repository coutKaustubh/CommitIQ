/**
 * Hero fox illustration — geometric flat style + ember campfire + rising particles.
 * Complex custom art ki jagah layered composition: glow + SVG fox + code block + particles.
 */
function FoxScene() {
  const particles = [
    { left: '46%', bottom: '18%', size: 6, delay: '0s', duration: '2.8s' },
    { left: '52%', bottom: '16%', size: 4, delay: '0.6s', duration: '3.2s' },
    { left: '56%', bottom: '20%', size: 5, delay: '1.2s', duration: '2.5s' },
    { left: '50%', bottom: '22%', size: 3, delay: '1.8s', duration: '3.5s' },
    { left: '54%', bottom: '14%', size: 4, delay: '2.4s', duration: '3s' },
  ]

  return (
    <div className="relative mx-auto h-[520px] w-full max-w-[560px]">
      {/* Background ambient glow — fox ke peeche soft orange halo */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full opacity-60 blur-[80px]"
        style={{ background: 'radial-gradient(circle, var(--primary-glow) 0%, transparent 70%)' }}
      />

      {/* Main scene container — fox center me, code block top-right corner */}
      <div className="glow-ember relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl border border-border bg-bg-surface">
        {/* Faint scan grid — card ko bhara hua feel deta hai */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              'linear-gradient(#FF6A3D 1px, transparent 1px), linear-gradient(90deg, #FF6A3D 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Fox + code block ek group me — vertically centered, thoda bada */}
        <div className="relative h-[360px] w-[400px]">
          {/* Code block — fox ke top-right corner pe float, thoda overlap */}
          <div className="absolute right-0 -top-2 z-20 w-52 rounded-lg border border-violet/30 bg-bg-surface-elevated p-3.5 shadow-xl">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-danger/80" />
              <span className="h-2 w-2 rounded-full bg-warning/80" />
              <span className="h-2 w-2 rounded-full bg-success/80" />
            </div>
            <pre className="font-mono text-[11px] leading-relaxed text-violet/90">
              <span className="text-text-muted">for</span> item{' '}
              <span className="text-text-muted">in</span> orders:
              {'\n'}  db.query(item)
            </pre>
          </div>

          {/* Floating status chip — "scanning" (top-left balance) */}
          <div className="absolute left-0 top-6 z-20 inline-flex items-center gap-1.5 rounded-full border border-accent-lime/30 bg-accent-lime/10 px-2.5 py-1 shadow-lg">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-lime" />
            <span className="font-mono text-[10px] font-medium text-accent-lime">scanning…</span>
          </div>

          {/* Floating "bug found" chip — bottom-right balance */}
          <div className="float-card absolute -right-2 bottom-8 z-30 inline-flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 shadow-lg">
            <span className="text-[10px]">🔴</span>
            <span className="font-mono text-[10px] font-medium text-danger">1 bug found</span>
          </div>

          {/* Magnifying glass — fox ke face aur code block ke beech */}
          <div className="absolute right-32 top-24 z-30">
            <svg width="58" height="58" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <circle cx="20" cy="20" r="12" stroke="#FF6A3D" strokeWidth="3" fill="rgba(255,106,61,0.12)" />
              <line x1="29" y1="29" x2="42" y2="42" stroke="#FF6A3D" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>

          {/* Hacker fox SVG — hooded, angular, menacing (devil/dangerous vibe) */}
          <svg
            className="absolute bottom-0 left-2 z-10"
            width="300"
            height="278"
            viewBox="0 0 230 220"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              {/* Glowing eyes filter — hacker feel */}
              <filter id="foxEyeGlow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="2.4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="foxTail" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#FF6A3D" />
                <stop offset="1" stopColor="#C24A26" />
              </linearGradient>
            </defs>

            {/* Bushy sharp tail — peeche se nikalta hua */}
            <path d="M46 158 C8 138 4 96 30 76 C44 104 58 114 82 124 L74 172 Z" fill="url(#foxTail)" />
            <path d="M30 76 C22 84 18 96 22 108 L38 92 Z" fill="#F2EFEA" opacity="0.85" />

            {/* Hoodie body — dark, hacker hoodie */}
            <path d="M64 214 C56 156 82 126 120 124 C158 126 176 156 168 214 Z" fill="#1E1C26" />
            <path d="M64 214 C60 182 70 158 86 144 L96 214 Z" fill="#16151C" opacity="0.6" />
            {/* Zipper */}
            <line x1="118" y1="150" x2="118" y2="208" stroke="#2A2832" strokeWidth="3.5" />
            {/* Hood collar behind head */}
            <path d="M80 152 C98 122 142 122 160 152 L150 158 C136 140 104 140 90 158 Z" fill="#16151C" />
            {/* Paws resting on lap */}
            <ellipse cx="103" cy="198" rx="13" ry="9" fill="#E85A30" />
            <ellipse cx="137" cy="198" rx="13" ry="9" fill="#E85A30" />

            {/* Ears — tall, sharp, devilish */}
            <path d="M80 74 L92 22 L122 66 Z" fill="#FF6A3D" />
            <path d="M160 74 L148 22 L118 66 Z" fill="#FF6A3D" />
            <path d="M88 68 L96 40 L113 64 Z" fill="#16151C" />
            <path d="M152 68 L144 40 L127 64 Z" fill="#16151C" />

            {/* Head — angular shield shape */}
            <path d="M78 70 L120 58 L162 70 L166 100 L146 116 L120 138 L94 116 L74 100 Z" fill="#FF6A3D" />
            {/* White mask / muzzle */}
            <path d="M101 103 L139 103 L120 138 Z" fill="#F2EFEA" />
            <path d="M95 106 L112 102 L106 120 L92 114 Z" fill="#F2EFEA" opacity="0.9" />
            <path d="M145 106 L128 102 L134 120 L148 114 Z" fill="#F2EFEA" opacity="0.9" />

            {/* Angry brows — center ki taraf jhukey hue */}
            <path d="M90 82 L118 95 L116 89 L92 76 Z" fill="#16151C" />
            <path d="M150 82 L122 95 L124 89 L148 76 Z" fill="#16151C" />

            {/* Glowing narrowed eyes — hacker/dangerous */}
            <path d="M96 90 L114 98 L110 104 L96 97 Z" fill="#C8FF4D" filter="url(#foxEyeGlow)" />
            <path d="M144 90 L126 98 L130 104 L144 97 Z" fill="#C8FF4D" filter="url(#foxEyeGlow)" />

            {/* Nose + fang — thoda sinister */}
            <path d="M112 126 L128 126 L120 138 Z" fill="#16151C" />
            <path d="M120 137 L124 130 L126 130 Z" fill="#F2EFEA" />
          </svg>

          {/* Ember glow — fox ke neeche, slow pulse (campfire feel) */}
          <div className="absolute -bottom-6 left-1/2 z-0 -translate-x-1/2">
            <div className="animate-ember-pulse relative">
              <div
                className="h-20 w-40 rounded-full blur-2xl"
                style={{ background: 'radial-gradient(ellipse, #FF6A3D 0%, rgba(255,106,61,0.25) 45%, transparent 72%)' }}
              />
              <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/70 blur-md" />
            </div>
          </div>

          {/* Rising ember particles — smoke jaisa ambient animation */}
          {particles.map((p, i) => (
            <span
              key={i}
              className="ember-particle"
              style={{
                left: p.left,
                bottom: p.bottom,
                width: p.size,
                height: p.size,
                animationDelay: p.delay,
                animationDuration: p.duration,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default FoxScene
