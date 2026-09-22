import React from 'react';
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, color = "blue" }) {
  const colorClasses = {
    blue: "from-blue-500 to-cyan-500",
    green: "from-emerald-500 to-teal-500",
    emerald: "from-emerald-500 to-green-500",
    orange: "from-orange-500 to-amber-500",
    amber: "from-amber-500 to-yellow-500",
    purple: "from-purple-500 to-indigo-500",
    red: "from-red-500 to-rose-500",
    indigo: "from-indigo-500 to-purple-500",
    teal: "from-teal-500 to-cyan-500",
    pink: "from-pink-500 to-rose-500"
  };
  
  const bgClasses = {
    blue: "bg-blue-50",
    green: "bg-emerald-50",
    emerald: "bg-emerald-50",
    orange: "bg-orange-50",
    amber: "bg-amber-50",
    purple: "bg-purple-50",
    red: "bg-red-50",
    indigo: "bg-indigo-50",
    teal: "bg-teal-50",
    pink: "bg-pink-50"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl p-6 shadow-md border-2 border-transparent hover:shadow-xl transition-all duration-300",
        bgClasses[color] || "bg-white"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-600">{title}</p>
          <p className="text-3xl font-bold text-slate-900 mt-1.5">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-500 font-medium mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              "text-sm font-bold mt-2.5",
              trend > 0 ? "text-emerald-600" : trend < 0 ? "text-red-500" : "text-slate-500"
            )}>
              {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"} {Math.abs(trend)}% vs semaine dernière
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform",
            colorClasses[color]
          )}>
            <Icon className="w-7 h-7 text-white" />
          </div>
        )}
      </div>
    </motion.div>
  );
}