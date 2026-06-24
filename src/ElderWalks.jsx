import React from 'react';
import { Play, CheckCircle2 } from 'lucide-react';

export default function ElderWalks({ goals, items, onStartWalk, onLogWalk }) {
  const walkItems = items.filter(i => i.type === 'exercise' && (i.foodId === 'walk-run' || i.exercise?.modeId === 'walk-run'));
  const minutesWalked = Math.round(walkItems.reduce((acc, curr) => acc + (curr.exercise?.elapsedSeconds || 0), 0) / 60);
  const eaten = items.reduce((sum, item) => sum + (item.nutrition?.calories || 0), 0);
  const left = Math.max(0, goals.calories - eaten);

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="rounded-[32px] bg-white p-6 shadow-sm border border-[#e8e4d9]">
        <div className="mb-4 inline-block rounded-full bg-[#f2efe4] px-4 py-1.5 text-sm font-bold text-[#8c7335]">
          Track your walk
        </div>

        <h2 className="text-3xl font-black text-[#2d2515] mb-2">Walking</h2>
        <p className="text-lg text-[#7a6f5d] mb-8 leading-snug">
          Walking is one of the best things you can do for your health.
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={onStartWalk}
            className="flex items-center justify-center gap-3 rounded-2xl border border-[#e8e4d9] bg-white py-4 text-xl font-bold text-[#2d2515] shadow-sm transition hover:bg-zinc-50 active:scale-95"
          >
            <Play className="h-6 w-6 text-[#c48227]" />
            Start tracking now
          </button>
          
          <button
            onClick={onLogWalk}
            className="flex items-center justify-center gap-3 rounded-2xl bg-[#c48227] py-4 text-xl font-bold text-white shadow-lg shadow-[#c48227]/30 transition active:scale-95"
          >
            <CheckCircle2 className="h-6 w-6" />
            I already went for a walk
          </button>
        </div>
      </div>

      <div className="rounded-[32px] bg-white p-6 shadow-sm border border-[#e8e4d9]">
        <div className="mb-2">
          <span className="text-4xl font-black text-[#2d2515]">{minutesWalked} minutes</span>
        </div>
        <p className="mb-6 text-lg font-medium text-[#7a6f5d]">walked today</p>

        <p className="text-xl font-medium text-[#2d2515] leading-snug">
          <span className="font-bold">{left} kcal</span> left for today's goal
        </p>
      </div>
    </div>
  );
}
