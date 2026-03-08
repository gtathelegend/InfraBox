import { motion } from "framer-motion";

type BatteryUsageMeterProps = {
  label: string;
  value: number;
  className?: string;
};

const clampValue = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const getUsageTone = (value: number) => {
  if (value <= 70) {
    return {
      liquid: "bg-emerald-500",
      liquidSoft: "bg-emerald-300/45",
    };
  }

  if (value <= 85) {
    return {
      liquid: "bg-amber-500",
      liquidSoft: "bg-amber-300/50",
    };
  }

  return {
    liquid: "bg-red-500",
    liquidSoft: "bg-red-300/50",
  };
};

export function BatteryUsageMeter({
  label,
  value,
  className = "",
}: BatteryUsageMeterProps) {
  const clampedValue = clampValue(value);
  const tone = getUsageTone(clampedValue);

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs font-medium text-slate-700">{label}</p>

      <div className="relative h-16 overflow-hidden rounded-lg border border-slate-300 bg-slate-100">
        <motion.div
          className="absolute inset-x-0 bottom-0"
          initial={{ height: 0 }}
          animate={{ height: `${clampedValue}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className={`absolute inset-0 ${tone.liquid}`} />

          <motion.div
            className={`absolute left-[-30%] top-0 h-5 w-[160%] rounded-[100%] ${tone.liquidSoft}`}
            animate={{ x: ["-8%", "8%", "-8%"], y: [0, 2, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-semibold text-slate-900 backdrop-blur-sm">
            {clampedValue}%
          </div>
        </div>
      </div>
    </div>
  );
}
