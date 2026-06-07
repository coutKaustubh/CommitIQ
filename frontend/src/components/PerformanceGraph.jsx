import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
  CartesianGrid,
} from 'recharts'

// API latency across recent commits. Regression point (data[i].regression) is marked red.
function PerformanceGraph({ data, height = 240, compact = false }) {
  const regression = data.find((d) => d.regression)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: compact ? -20 : 0, bottom: 0 }}>
        <defs>
          <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
          </linearGradient>
        </defs>
        {!compact && <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />}
        <XAxis
          dataKey="commit"
          tick={{ fill: '#8b949e', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: '#30363d' }}
          tickLine={false}
          hide={compact}
        />
        <YAxis
          tick={{ fill: '#8b949e', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          width={40}
          hide={compact}
          unit="ms"
        />
        <Tooltip
          contentStyle={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'JetBrains Mono',
          }}
          labelStyle={{ color: '#8b949e' }}
          formatter={(v) => [`${v} ms`, 'latency']}
        />
        <Area
          type="monotone"
          dataKey="ms"
          stroke="#a78bfa"
          strokeWidth={2}
          fill="url(#perfFill)"
        />
        {regression && (
          <ReferenceDot
            x={regression.commit}
            y={regression.ms}
            r={5}
            fill="#f85149"
            stroke="#0d1117"
            strokeWidth={2}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default PerformanceGraph
