import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as ReRadarChart,
  ResponsiveContainer,
} from 'recharts'

export interface RadarDatum {
  axis: string
  value: number
}

interface Props {
  data: RadarDatum[]
  height?: number
}

export function RadarChart({ data, height = 320 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReRadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, 100]} angle={30} tick={{ fontSize: 10 }} />
        <Radar
          dataKey="value"
          stroke="hsl(var(--primary, 220 90% 56%))"
          fill="hsl(var(--primary, 220 90% 56%))"
          fillOpacity={0.35}
        />
      </ReRadarChart>
    </ResponsiveContainer>
  )
}
