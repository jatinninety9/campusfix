import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
export default function CategoryChart({ data, role }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 12, right: 6, left: -28, bottom: 0 }}
      >
        <CartesianGrid
          vertical={false}
          stroke="#eee8e1"
          strokeDasharray="3 5"
        />
        <XAxis
          dataKey="name"
          tick={{ fill: "#68645e", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#68645e", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e6ddd3",
            borderRadius: 12,
            color: "#292723",
            fontSize: 13,
          }}
          cursor={{ fill: "#fff3e8" }}
        />
        <Bar
          dataKey="count"
          name="Reports"
          fill={
            role === "admin"
              ? "#c54b16"
              : role === "staff"
                ? "#c56a2e"
                : "#df6c35"
          }
          radius={[5, 5, 0, 0]}
          maxBarSize={42}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
