import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

interface Series {
  dataKey: string
  name: string
  color: string
  unit?: string
}

interface MetricLineChartProps<T extends object> {
  data: T[]
  series: Series[]
  height?: number
  yDomain?: [number | 'auto', number | 'auto']
}

export function MetricLineChart<T extends object>({ data, series, height = 220, yDomain }: MetricLineChartProps<T>) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#223049" vertical={false} />
        <XAxis
          dataKey="t"
          tickFormatter={(v: number) => `${Math.round(v / 60)}m`}
          tick={{ fill: '#5E7091', fontSize: 11 }}
          axisLine={{ stroke: '#223049' }}
          tickLine={false}
        />
        <YAxis tick={{ fill: '#5E7091', fontSize: 11 }} axisLine={false} tickLine={false} width={40} domain={yDomain} />
        <Tooltip
          contentStyle={{ background: '#1B283B', border: '1px solid #263244', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(label) => `t = ${Math.round(Number(label) / 60)}m`}
          labelStyle={{ color: '#94A3B8' }}
        />
        {series.map((s) => (
          <Line key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name} stroke={s.color} strokeWidth={2} dot={false} isAnimationActive={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
