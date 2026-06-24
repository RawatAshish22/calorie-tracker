import React, { useState } from 'react';
import { User, Activity, Target, Settings, ChevronRight, LogOut } from 'lucide-react';

export default function NutritionModal({ result, onClose, onAdd }) {
  const [mealType, setMealType] = useState('Lunch');
  const [mode, setMode] = useState('servings');
  const [servings, setServings] = useState(1);
  const [grams, setGrams] = useState(Math.round(Number(result.baseServingGrams || 100)));

  const baseNutrition = result.baseNutrition || result.nutrition;
  const baseQuantity = result.baseQuantity || result.quantity || '1 serving';
  const baseServingGrams = Number(result.baseServingGrams || 0);
  const canUseWeight = baseServingGrams > 0;

  const adjusted = useMemo(() => {
    const servingScale = Math.max(0.25, Number(servings) || 1);
    const gramValue = Math.max(1, Number(grams) || baseServingGrams || 1);
    const scale = mode === 'weight' && canUseWeight ? gramValue / baseServingGrams : servingScale;
    const quantity = mode === 'weight' && canUseWeight
      ? `${roundMetric(gramValue, 0)} g`
      : servingScale === 1
        ? baseQuantity
        : `${roundMetric(servingScale)} x ${baseQuantity}`;

    return {
      ...result,
      quantity,
      nutrition: scaleNutrition(baseNutrition, scale),
    };
  }, [baseNutrition, baseQuantity, baseServingGrams, canUseWeight, grams, mode, result, servings]);

  const vitamins = Object.entries(adjusted.nutrition.vitamins || {}).slice(0, 6);

  function changeServings(next) {
    const numeric = Number.isFinite(Number(next)) ? Number(next) : 1;
    setMode('servings');
    setServings(Math.max(0.25, roundMetric(numeric)));
  }

  function changeGrams(next) {
    if (!canUseWeight) return;
    const numeric = Number.isFinite(Number(next)) ? Number(next) : baseServingGrams || 1;
    setMode('weight');
    setGrams(Math.max(1, Math.round(numeric)));
  }

  function chooseMode(nextMode) {
    if (nextMode === 'weight' && !canUseWeight) return;
    if (nextMode === 'weight') setGrams(Math.round(baseServingGrams * Math.max(0.25, Number(servings) || 1)));
    if (nextMode === 'servings' && canUseWeight) setServings(Math.max(0.25, roundMetric((Number(grams) || baseServingGrams) / baseServingGrams)));
    setMode(nextMode);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 px-3 pb-3 backdrop-blur-sm sm:items-center sm:p-4">
      <section className="animate-sheet w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0b1713] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="relative p-4">
          <div className="hero-lines absolute inset-0" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-3">
              <FoodVisual foodId={result.foodId} />
              <div className="min-w-0">
                <p className="text-xs uppercase text-limeFresh">{result.source}</p>
                <h2 className="mt-1 truncate text-xl font-black text-[#2d2515]">{result.foodName}</h2>
                <p className="mt-1 text-sm text-[#7a6f5d]">{adjusted.quantity}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-zinc-300 transition hover:border-berry hover:text-berry active:scale-95"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="rounded-[20px] border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">Quantity</h3>
              <div className="flex rounded-xl border border-white/10 bg-black/25 p-1">
                <button
                  type="button"
                  onClick={() => chooseMode('servings')}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs transition ${mode === 'servings' ? 'bg-limeFresh text-ink' : 'text-[#7a6f5d]'}`}
                >
                  <Utensils size={14} />
                  Servings
                </button>
                <button
                  type="button"
                  onClick={() => chooseMode('weight')}
                  disabled={!canUseWeight}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs transition disabled:opacity-35 ${mode === 'weight' ? 'bg-limeFresh text-ink' : 'text-[#7a6f5d]'}`}
                >
                  <Scale size={14} />
                  Grams
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <QuantityCounter
                label="Servings"
                value={servings}
                unit="x"
                active={mode === 'servings'}
                onMinus={() => changeServings(Number(servings) - 0.5)}
                onPlus={() => changeServings(Number(servings) + 0.5)}
                onChange={changeServings}
              />
              <QuantityCounter
                label="Weight"
                value={grams}
                unit="g"
                active={mode === 'weight'}
                disabled={!canUseWeight}
                onMinus={() => changeGrams(Number(grams) - 10)}
                onPlus={() => changeGrams(Number(grams) + 10)}
                onChange={changeGrams}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <NutritionStat label="Calories" value={adjusted.nutrition.calories} unit="kcal" tone="text-limeFresh" />
            <NutritionStat label="Protein" value={adjusted.nutrition.protein} unit="g" tone="text-mint" />
            <NutritionStat label="Carbs" value={adjusted.nutrition.carbs} unit="g" tone="text-aqua" />
            <NutritionStat label="Fat" value={adjusted.nutrition.fat} unit="g" tone="text-sun" />
            <NutritionStat label="Fiber" value={adjusted.nutrition.fiber} unit="g" tone="text-berry" />
            <NutritionStat label="Sodium" value={adjusted.nutrition.sodium} unit="mg" tone="text-zinc-200" />
          </div>

          {vitamins.length > 0 && (
            <div className="mt-4 rounded-[20px] border border-white/10 bg-black/25 p-3">
              <h3 className="text-sm font-bold">Vitamins and minerals</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-300">
                {vitamins.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-2 rounded-xl bg-white/5 px-2 py-2">
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="text-[#7a6f5d]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="mb-2 block text-sm text-[#7a6f5d]" htmlFor="meal-type">Meal</label>
            <div id="meal-type" className="grid grid-cols-4 gap-2">
              {mealTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMealType(type)}
                  className={`rounded-xl border px-2 py-2 text-xs transition active:scale-95 ${mealType === type ? 'border-limeFresh bg-limeFresh text-ink' : 'border-white/10 bg-black/25 text-zinc-300'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAdd(adjusted, mealType)}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-limeFresh px-4 font-bold text-ink transition hover:-translate-y-0.5 active:scale-95"
          >
            <Check size={20} />
            Add to today
          </button>
        </div>
      </section>
    </div>
  );
}

function QuantityCounter({ label, value, unit, active, disabled = false, onMinus, onPlus, onChange }) {
  return (
    <div className={`rounded-xl border p-2 transition ${active ? 'border-limeFresh bg-white/[0.08]' : 'border-white/10 bg-white/5'} ${disabled ? 'opacity-45' : ''}`}>
      <p className="mb-2 text-xs text-[#7a6f5d]">{label}</p>
      <div className="grid grid-cols-[32px_1fr_32px] items-center gap-1">
        <button
          type="button"
          onClick={onMinus}
          disabled={disabled}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-zinc-300 transition hover:text-limeFresh active:scale-95 disabled:cursor-not-allowed"
          aria-label={`Decrease ${label}`}
        >
          <Minus size={16} />
        </button>
        <label className="flex h-8 min-w-0 items-center justify-center rounded-lg bg-black/25 px-1">
          <input
            type="number"
            min="0"
            step={unit === 'g' ? 10 : 0.5}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
            className="min-w-0 flex-1 bg-transparent text-center text-sm font-bold text-[#2d2515] outline-none disabled:cursor-not-allowed"
            aria-label={label}
          />
          <span className="ml-1 text-xs text-[#7a6f5d]">{unit}</span>
        </label>
        <button
          type="button"
          onClick={onPlus}
          disabled={disabled}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/25 text-zinc-300 transition hover:text-limeFresh active:scale-95 disabled:cursor-not-allowed"
          aria-label={`Increase ${label}`}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}

function NutritionStat({ label, value, unit, tone }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <p className="text-xs text-[#7a6f5d]">{label}</p>
      <p className={`mt-1 text-lg font-black ${tone}`}>{roundMetric(value)}</p>
      <p className="text-xs text-[#7a6f5d]">{unit}</p>
    </div>
  );
}

function MealLog({ date, items, onRemove }) {
  const sections = [...mealTypes, 'Water', 'Exercise'];

  return (
    <section className="glass-panel rounded-[22px] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">Daily log</h2>
        <span className="text-xs text-[#7a6f5d]">{items.length} items</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-[#7a6f5d]">
          No meals logged for {formatDayLabel(date)}.
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((mealType) => {
            const mealItems = items.filter((item) => item.mealType === mealType);
            if (mealItems.length === 0) return null;
            return (
              <div key={mealType}>
                <h3 className="mb-2 text-sm font-bold text-zinc-300">{mealType}</h3>
                <div className="space-y-2">
                  {mealItems.map((item) => (
                    <MealRow key={item.id} item={item} onRemove={onRemove} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MealRow({ item, onRemove }) {
  if (item.type === 'exercise') return <ActivityRow item={item} onRemove={onRemove} />;

  return (
    <div className="animate-pop grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3 transition hover:border-white/20">
      <FoodVisual foodId={item.foodId} size="sm" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-[#2d2515]">{item.name}</p>
          <span className="shrink-0 rounded-lg bg-white/[0.08] px-2 py-0.5 text-[11px] text-[#7a6f5d]">{item.source}</span>
        </div>
        <p className="mt-1 text-xs text-[#7a6f5d]">{item.quantity}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#7a6f5d]">
          <span>{roundMetric(item.nutrition.calories, 0)} kcal</span>
          <span>{roundMetric(item.nutrition.protein)}g protein</span>
          <span>{roundMetric(item.nutrition.carbs)}g carbs</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-white/10 px-3 text-xs text-zinc-300 transition hover:border-berry hover:text-berry active:scale-95"
        aria-label={`Remove ${item.name}`}
      >
        <Trash2 size={15} />
        Remove
      </button>
    </div>
  );
}

function ActivityRow({ item, onRemove }) {
  const mode = exerciseModes.find((exercise) => exercise.id === item.foodId) || exerciseModes[4];
  const Icon = mode.icon;

  return (
    <div className="animate-pop grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-xl border border-limeFresh/15 bg-limeFresh/10 p-3 transition hover:border-limeFresh/30">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-black/25 text-limeFresh">
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-[#2d2515]">{item.name}</p>
          <span className="shrink-0 rounded-lg bg-limeFresh/15 px-2 py-0.5 text-[11px] text-limeFresh">Burn</span>
        </div>
        <p className="mt-1 text-xs text-[#7a6f5d]">{item.quantity}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#7a6f5d]">
          <span className="text-limeFresh">{roundMetric(item.nutrition?.burnedCalories, 0)} kcal burned</span>
          {item.exercise?.elapsedSeconds ? <span>{formatDuration(item.exercise.elapsedSeconds)}</span> : null}
          {item.exercise?.speed ? <span>{roundMetric(item.exercise.speed, 1)} speed/intensity</span> : null}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-white/10 px-3 text-xs text-zinc-300 transition hover:border-berry hover:text-berry active:scale-95"
        aria-label={`Remove ${item.name}`}
      >
        <Trash2 size={15} />
        Remove
      </button>
    </div>
  );
}

function History({ logs, goals, selectedDate, setSelectedDate, onRemove, onBack }) {
  const dateKeys = useMemo(() => {
    const keys = Object.keys(logs).sort((a, b) => b.localeCompare(a));
    return keys.length ? keys : [todayKey()];
  }, [logs]);
  const items = logs[selectedDate] || [];
  const totals = useMemo(() => addTotals(items), [items]);

  function moveDate(delta) {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + delta);
    setSelectedDate(todayKey(date));
  }

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:text-[#2d2515] active:scale-95 animate-rise"
        >
          <ChevronLeft size={18} />
          Back to Log
        </button>
      )}
      <section className="hero-panel animate-rise rounded-[26px] border border-white/10 p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => moveDate(-1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-zinc-300"
            aria-label="Previous day"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-xs text-[#7a6f5d]">Selected day</p>
            <h2 className="text-lg font-black">{formatDayLabel(selectedDate)}</h2>
          </div>
          <button
            type="button"
            onClick={() => moveDate(1)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-zinc-300"
            aria-label="Next day"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <NutritionStat label="Calories" value={totals.calories} unit={`/ ${goals.calories}`} tone="text-limeFresh" />
          <NutritionStat label="Protein" value={totals.protein} unit={`/ ${goals.protein}g`} tone="text-mint" />
          <NutritionStat label="Fat" value={totals.fat} unit={`/ ${goals.fat}g`} tone="text-sun" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-bold">Logged days</h2>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {dateKeys.map((date) => (
            <button
              key={date}
              type="button"
              onClick={() => setSelectedDate(date)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-sm transition active:scale-95 ${selectedDate === date ? 'border-limeFresh bg-limeFresh text-ink' : 'border-white/10 bg-white/5 text-zinc-300'}`}
            >
              {formatDayLabel(date)}
            </button>
          ))}
        </div>
      </section>

      <MealLog date={selectedDate} items={items} onRemove={(id) => onRemove(selectedDate, id)} />
    </div>
  );
}

function IdealWeight({ user }) {
  const profile = user.profile || {};
  const [draft, setDraft] = useState(() => ({
    age: profile.age || 25,
    gender: profile.gender || 'male',
    heightUnit: profile.heightUnit || 'cm',
    heightCm: profile.heightCm || 170,
    heightFeet: profile.heightFeet || cmToFeetInches(profile.heightCm || 170).feet,
    heightInches: profile.heightInches || cmToFeetInches(profile.heightCm || 170).inches,
    weightKg: profile.weightKg || 70,
  }));

  function update(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const result = useMemo(() => calculateIdealWeight(draft), [draft]);

  return (
    <div className="space-y-4">
      <section className="hero-panel rounded-[26px] border border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-limeFresh">
            <Gauge size={26} />
          </div>
          <div>
            <p className="text-sm text-limeFresh">Body insight</p>
            <h2 className="text-2xl font-black">Ideal Weight</h2>
          </div>
        </div>
      </section>

      <section className="glass-panel rounded-[22px] p-4">
        <div className="grid grid-cols-2 gap-3">
          <IconInput icon={User} label="Age" value={draft.age} onChange={(value) => update('age', Number(value))} type="number" />
          <SelectInput label="Gender" value={draft.gender} onChange={(value) => update('gender', value)} options={[
            ['male', 'Male'],
            ['female', 'Female'],
            ['other', 'Other'],
          ]} />
        </div>
        <div className="mt-3">
          <HeightFields profile={draft} onChange={update} />
        </div>
        <div className="mt-3">
          <IconInput icon={Scale} label="Current weight" value={draft.weightKg} onChange={(value) => update('weightKg', Number(value))} type="number" unit="kg" />
        </div>
      </section>

      <section className="hero-panel rounded-[26px] border border-white/10 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase text-[#7a6f5d]">Ideal range</p>
            <p className="mt-2 text-2xl font-black text-limeFresh">{result.range}</p>
            <p className="mt-1 text-xs text-[#7a6f5d]">Healthy BMI range</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase text-[#7a6f5d]">BMI category</p>
            <p className="mt-2 text-2xl font-black text-[#2d2515]">{result.category}</p>
            <p className="mt-1 text-xs text-[#7a6f5d]">BMI {result.bmi}</p>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm leading-6 text-zinc-300">{result.note}</p>
        </div>
      </section>
    </div>
  );
}

function AICoaching({ user, goals, aiSettings, onApplyGoals, onToast, messages, setMessages }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const quickPrompts = [
    'What should I eat today?',
    'How many calories should I target?',
    'Give me a workout plan',
    'Help me hit my protein goal',
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  async function sendMessage(event, presetMessage = '') {
    event?.preventDefault?.();
    const message = (presetMessage || input).trim();
    if (!message || loading) return;

    const userMessage = { id: uid(), role: 'user', answer: message };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);

    if (aiSettings.provider === 'offline') {
      const offline = buildOfflineCoachReply(message, user.profile, goals);
      setMessages((current) => [...current, {
        id: uid(),
        role: 'assistant',
        answer: offline.answer,
        suggestedGoals: offline.suggestedGoals,
        source: offline.source,
      }]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          provider: aiSettings.provider,
          profile: user.profile,
          goals,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setMessages((current) => [...current, {
        id: uid(),
        role: 'assistant',
        answer: data.answer,
        suggestedGoals: data.suggestedGoals || null,
        source: data.source || 'Sistum AI Coach',
        warning: data.warning || null,
      }]);
    } catch (error) {
      const offline = buildOfflineCoachReply(message, user.profile, goals);
      setMessages((current) => [...current, {
        id: uid(),
        role: 'assistant',
        answer: `${offline.answer}\n\n(AI backend unavailable: ${error.message})`,
        suggestedGoals: offline.suggestedGoals,
        source: 'Profile coach fallback',
      }]);
      onToast(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="hero-panel animate-rise rounded-[26px] border border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-limeFresh animate-float">
            <Bot size={26} />
          </div>
          <div>
            <p className="text-sm text-limeFresh">Profile-linked AI</p>
            <h2 className="text-2xl font-black">AI Coaching</h2>
          </div>
        </div>
      </section>

      <section className="glass-panel animate-rise animate-stagger-1 flex min-h-[54vh] flex-col rounded-[22px] p-4">
        <div className="no-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={`animate-message-in rounded-2xl border p-3 ${message.role === 'user' ? 'ml-8 border-limeFresh/40 bg-limeFresh/10' : 'mr-8 border-white/10 bg-black/25'}`}
              style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
            >
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{message.answer}</p>
              {message.source && message.role === 'assistant' && (
                <p className="mt-2 text-[10px] uppercase tracking-wider text-[#7a6f5d]">{message.source}</p>
              )}
              {message.suggestedGoals && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 animate-pop">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <MiniMetric label="Kcal" value={message.suggestedGoals.calories || '-'} />
                    <MiniMetric label="Protein" value={`${message.suggestedGoals.protein || '-'}g`} />
                    <MiniMetric label="Carbs" value={`${message.suggestedGoals.carbs || '-'}g`} />
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplyGoals(message.suggestedGoals)}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-limeFresh px-3 text-sm font-bold text-ink transition active:scale-95"
                  >
                    <Target size={16} />
                    Add to my goal
                  </button>
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="mr-8 rounded-2xl border border-white/10 bg-black/25 p-3 animate-pop">
              <div className="flex items-center gap-2 text-sm text-[#7a6f5d]">
                <span className="typing-dot" />
                <span className="typing-dot" style={{ animationDelay: '120ms' }} />
                <span className="typing-dot" style={{ animationDelay: '240ms' }} />
                <span>Coach is thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage(null, prompt)}
              disabled={loading}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-limeFresh/40 hover:text-limeFresh active:scale-95 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form onSubmit={sendMessage} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-w-0 flex-1 rounded-2xl border-none bg-white/[0.05] px-4 text-sm text-[#2d2515] outline-none transition focus:bg-white/[0.08]"
            placeholder="Ask AI Coach..."
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-limeFresh text-ink transition active:scale-95 disabled:opacity-60"
            aria-label="Send"
          >
            {loading ? <RefreshCw className="animate-spin" size={19} /> : <Send size={19} />}
          </button>
        </form>
      </section>
    </div>
  );
}

function CameraScan({ aiSettings, onResult, onToast, onBack }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const busyRef = useRef(false);
  const [active, setActive] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [status, setStatus] = useState(getCameraStatusMessage());
  const [facingMode, setFacingMode] = useState('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [uploadedImage, setUploadedImage] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => () => stopCamera(), []);

  useEffect(() => {
    if (!active || !autoScan) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
      return undefined;
    }

    scanFrame();
    timerRef.current = window.setInterval(scanFrame, 4500);
    return () => window.clearInterval(timerRef.current);
  }, [active, autoScan]);

  async function startCamera(mode = facingMode) {
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      const message = getCameraStatusMessage();
      setStatus(message);
      onToast(message);
      return;
    }

    try {
      const stream = await mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setActive(true);
      setAutoScan(true);
      setStatus('Scanning every few seconds');
    } catch (error) {
      const message = getCameraErrorMessage(error);
      onToast(message);
      setStatus(message);
    }
  }

  function stopCamera() {
    window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setActive(false);
    setAutoScan(false);
    setStatus(getCameraStatusMessage());
  }

  function clearScan() {
    setScanResult(null);
    setUploadedImage(null);
    setStatus(getCameraStatusMessage());
  }

  async function toggleCamera() {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    if (active) {
      stopCamera();
      setTimeout(() => startCamera(newMode), 300);
    }
  }

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (active) stopCamera(); // Stop camera so the uploaded image becomes visible

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        setUploadedImage(base64);
        processImage(base64);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function processImage(image) {
    busyRef.current = true;
    setIsScanning(true);
    setStatus('Reading food...');
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/vision-nutrition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, provider: aiSettings.provider }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      const normalized = normalizeVisionResult(data);
      setScanResult(normalized);
      setStatus(data.cached ? 'Cached scan result' : 'Scan updated');
    } catch (error) {
      const msg = error.message || '';
      if (/quota|rate.limit|429|exceeded/i.test(msg)) {
        setStatus('AI rate limit hit — retrying shortly');
      } else if (/vision ai needs/i.test(msg)) {
        setStatus('No vision provider configured');
      } else {
        setStatus('AI vision unavailable');
      }
      onToast(msg.length > 120 ? msg.slice(0, 117) + '...' : msg);
    } finally {
      busyRef.current = false;
      setIsScanning(false);
    }
  }

  async function scanFrame() {
    if (busyRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth) return;
    const image = captureVideoFrame(video, canvasRef.current);
    processImage(image);
  }

  return (
    <div className="space-y-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:text-[#2d2515] active:scale-95 animate-rise"
        >
          <ChevronLeft size={18} />
          Back to Log
        </button>
      )}
      <section className="hero-panel animate-rise rounded-[26px] border border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-limeFresh">
            <Camera size={26} />
          </div>
          <div>
            <p className="text-sm text-limeFresh">Live nutrition scanner</p>
            <h2 className="text-2xl font-black">Camera Scan</h2>
          </div>
        </div>
      </section>

      <section className="glass-panel overflow-hidden rounded-[22px]">
        <div className="relative aspect-[4/5] bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          {!active && !uploadedImage && (
            <div className="absolute inset-0 grid place-items-center bg-black/70 px-8 text-center">
              <div>
                <Camera className="mx-auto text-limeFresh" size={44} />
                <p className="mt-3 text-sm text-zinc-300">Open camera or upload a photo to scan food.</p>
                {!hasCameraApi() && (
                  <p className="mt-3 rounded-xl border border-sun/25 bg-sun/10 px-3 py-2 text-xs leading-5 text-sun">
                    Camera needs HTTPS on mobile. Install/deploy the app with HTTPS or use a native wrapper for live scanning.
                  </p>
                )}
              </div>
            </div>
          )}
          {!active && uploadedImage && (
            <img src={uploadedImage} alt="Uploaded food" className="absolute inset-0 h-full w-full object-cover" />
          )}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="w-full h-full bg-limeFresh/10 animate-pulse mix-blend-overlay"></div>
              <div className="absolute left-0 right-0 h-1 bg-limeFresh shadow-[0_0_15px_#FFB020] animate-[scan_2s_ease-in-out_infinite]"></div>
            </div>
          )}
          {scanResult && (
            <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur">
              <button type="button" onClick={clearScan} className="absolute right-3 top-3 rounded-full bg-white/10 p-1.5 text-[#7a6f5d] hover:text-[#2d2515]">
                <X size={16} />
              </button>
              <p className="text-xs uppercase text-limeFresh">{scanResult.confidence} confidence</p>
              <h3 className="mt-1 pr-6 text-lg font-black">{scanResult.foodName}</h3>
              <p className="text-sm text-zinc-300">{scanResult.quantity}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <span>{scanResult.nutrition.calories} kcal</span>
                <span>{scanResult.nutrition.protein}g protein</span>
                <span>{scanResult.nutrition.carbs}g carbs</span>
              </div>
              <p className="mt-2 text-xs text-sun">{scanResult.funFact}</p>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
        <div className="grid grid-cols-4 gap-2 p-3">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-11 flex-col items-center justify-center rounded-xl border border-white/10 bg-black/25 text-zinc-200 hover:bg-white/5">
            <Upload size={18} />
          </button>
          <button type="button" onClick={toggleCamera} className="flex h-11 flex-col items-center justify-center rounded-xl border border-white/10 bg-black/25 text-zinc-200 hover:bg-white/5">
            <RefreshCw size={18} />
          </button>
          <button type="button" onClick={active ? stopCamera : startCamera} className="col-span-2 h-11 rounded-xl bg-limeFresh px-3 text-sm font-bold text-ink">
            {active ? 'Stop Camera' : 'Start Camera'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 px-3 pb-3">
          {scanResult ? (
            <button type="button" onClick={clearScan} disabled={isScanning} className="h-11 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-sm font-bold text-rose-400 disabled:opacity-50 hover:bg-rose-500/20">
              Discard Result
            </button>
          ) : uploadedImage ? (
            <button type="button" onClick={clearScan} disabled={isScanning} className="h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-bold text-zinc-200 disabled:opacity-50">
              Clear Image
            </button>
          ) : (
            <button type="button" onClick={scanFrame} disabled={!active || isScanning} className="h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-bold text-zinc-200 disabled:opacity-50">
              {isScanning ? 'Scanning...' : 'Capture Now'}
            </button>
          )}
          <button type="button" onClick={() => scanResult && onResult(scanResult)} disabled={!scanResult} className="h-11 rounded-xl border border-limeFresh px-3 text-sm font-bold text-limeFresh disabled:opacity-50 bg-limeFresh/10 hover:bg-limeFresh/20">
            Log Result
          </button>
        </div>
        <div className="border-t border-white/10 px-3 py-2 text-xs text-[#7a6f5d]">
          {status}. Auto scan is throttled to protect AI credits.
        </div>
      </section>
    </div>
  );
}

function hasCameraApi() {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

function getCameraStatusMessage() {
  if (!window.isSecureContext) return 'Camera needs HTTPS on mobile browsers';
  if (!hasCameraApi()) return 'Camera API is not available in this browser';
  return 'Camera off';
}

function getCameraErrorMessage(error) {
  if (!window.isSecureContext) return 'Camera needs HTTPS on mobile browsers';
  if (error?.name === 'NotAllowedError') return 'Camera permission was denied';
  if (error?.name === 'NotFoundError') return 'No camera was found on this device';
  if (error?.name === 'NotReadableError') return 'Camera is already in use by another app';
  return error?.message || 'Camera permission failed';
}

function getGpsErrorMessage(error) {
  if (!window.isSecureContext) return 'GPS needs HTTPS on mobile browsers';
  if (error?.code === 1 || error?.name === 'NotAllowedError') return 'Location permission was denied';
  if (error?.code === 2 || error?.name === 'PositionUnavailableError') return 'GPS signal unavailable';
  if (error?.code === 3 || error?.name === 'TimeoutError') return 'GPS timed out — try again outdoors';
  return error?.message || 'GPS permission failed';
}

