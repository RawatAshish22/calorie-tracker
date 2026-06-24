import React from 'react';

export default function ElderDashboard({ user, goals, items, onAddFood }) {
  const eaten = items.reduce((sum, item) => sum + (item.nutrition?.calories || 0), 0);
  const left = Math.max(0, goals.calories - eaten);
  const pct = Math.min(100, Math.round((eaten / goals.calories) * 100)) || 0;

  const currentWeight = user?.profile?.weightKg ? `${user.profile.weightKg} kg` : '--';
  const goalWeight = user?.profile?.desiredWeightKg ? `${user.profile.desiredWeightKg} kg` : '--';

  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="rounded-[32px] bg-white p-6 shadow-sm border border-[#e8e4d9]">
        <div className="mb-4 inline-block rounded-full bg-[#f2efe4] px-4 py-1.5 text-sm font-bold text-[#8c7335]">
          {todayStr}
        </div>

        <div className="mb-1">
          <span className="text-5xl font-black text-[#2d2515]">{eaten} calories</span>
        </div>
        <p className="mb-6 text-lg font-medium text-[#7a6f5d]">eaten today</p>

        {/* Flat Progress Bar */}
        <div className="mb-6 h-4 w-full overflow-hidden rounded-full bg-[#f2efe4]">
          <div 
            className="h-full rounded-full bg-[#d7b861] transition-all duration-1000 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="mb-8 text-xl font-medium text-[#2d2515]">
          <span className="font-bold">{left}</span> calories left to reach your goal
        </p>

        <button
          onClick={onAddFood}
          className="w-full rounded-2xl bg-[#c48227] py-4 text-xl font-bold text-white shadow-lg shadow-[#c48227]/30 active:scale-95 transition-all"
        >
          + Add food
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-4 text-center shadow-sm border border-[#e8e4d9]">
          <span className="text-xs font-medium text-[#7a6f5d] mb-1">Daily goal</span>
          <span className="text-base font-bold text-[#2d2515]">{goals.calories} kcal</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-4 text-center shadow-sm border border-[#e8e4d9]">
          <span className="text-xs font-medium text-[#7a6f5d] mb-1">Your weight</span>
          <span className="text-base font-bold text-[#2d2515]">{currentWeight}</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white p-4 text-center shadow-sm border border-[#e8e4d9]">
          <span className="text-xs font-medium text-[#7a6f5d] mb-1">Goal weight</span>
          <span className="text-base font-bold text-[#2d2515]">{goalWeight}</span>
        </div>
      </div>
    </div>
  );
}
