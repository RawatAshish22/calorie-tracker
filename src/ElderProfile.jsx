import React, { useState, useEffect, useRef } from 'react';
import { User, Target, Settings, Save, Ruler, Scale, Camera, RefreshCw } from 'lucide-react';

// Math/Conversion Utilities for ElderProfile
function getHeightCm(profile) {
  if (profile?.heightUnit === 'ft') {
    const feet = Number(profile.heightFeet || 0);
    const inches = Number(profile.heightInches || 0);
    return Math.round((feet * 12 + inches) * 2.54);
  }
  return Math.round(Number(profile?.heightCm || 170));
}

function cmToFeetInches(cmValue) {
  const totalInches = Math.max(1, Math.round(Number(cmValue || 170) / 2.54));
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { feet, inches };
}

function formatHeight(profile) {
  if (profile?.heightUnit === 'ft') {
    const feet = Number(profile.heightFeet || cmToFeetInches(profile.heightCm).feet);
    const inches = Number(profile.heightInches || cmToFeetInches(profile.heightCm).inches);
    return `${feet}ft ${inches}in`;
  }
  return `${getHeightCm(profile)}cm`;
}

export default function ElderProfile({ user, goals, aiSettings, onSaveGoals, onSaveAi, onSaveProfile, onSaveProfilePic }) {
  const [goalDraft, setGoalDraft] = useState(goals);
  const [settingsDraft, setSettingsDraft] = useState(aiSettings);
  const [profileDraft, setProfileDraft] = useState(user.profile || {});
  const [picUploading, setPicUploading] = useState(false);
  const picInputRef = useRef(null);

  useEffect(() => setGoalDraft(goals), [goals]);
  useEffect(() => setSettingsDraft(aiSettings), [aiSettings]);
  useEffect(() => setProfileDraft(user.profile || {}), [user.profile]);

  function updateGoal(key, value) {
    setGoalDraft((current) => ({ ...current, [key]: Number(value) }));
  }

  function updateSetting(key, value) {
    setSettingsDraft((current) => ({ ...current, [key]: value }));
  }

  function updateProfile(key, value) {
    setProfileDraft((current) => ({ ...current, [key]: value }));
  }

  function handlePicChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image too large. Please choose an image under 2MB.');
      return;
    }
    setPicUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      onSaveProfilePic?.(reader.result);
      setPicUploading(false);
    };
    reader.readAsDataURL(file);
  }

  const profilePic = user?.profilePic;
  const initial = (user.name || 'U').charAt(0).toUpperCase();

  return (
    <div className="space-y-6 bg-[#fcfaf2] text-[#2d2515] p-4 min-h-full">
      {/* Header Panel */}
      <section className="rounded-[26px] border border-[#e8e4d9] bg-white p-4 shadow-sm">
        {/* Profile Picture */}
        <div className="flex flex-col items-center gap-4">
          <input
            ref={picInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePicChange}
          />
          <button
            type="button"
            onClick={() => picInputRef.current?.click()}
            className="group relative h-28 w-28 cursor-pointer rounded-full border-4 border-[#d7b861] transition hover:border-[#c48227]"
            aria-label="Change profile picture"
          >
            {profilePic ? (
              <img src={profilePic} alt="Profile" className="h-full w-full rounded-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-[#c48227]/10 text-5xl font-black text-[#c48227]">
                {initial}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[#c48227]/40 opacity-0 transition group-hover:opacity-100">
              {picUploading ? (
                <RefreshCw className="h-7 w-7 animate-spin text-white" />
              ) : (
                <Camera className="h-7 w-7 text-white" />
              )}
            </div>
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-[#c48227]">Member Profile</p>
            <h2 className="text-2xl font-black text-[#2d2515]">{user.name}</h2>
            <button
              type="button"
              onClick={() => picInputRef.current?.click()}
              className="mt-1 text-sm font-semibold text-[#7a6f5d] underline hover:text-[#c48227]"
            >
              {profilePic ? 'Change photo' : '+ Add photo'}
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <HeroChip label="Height" value={formatHeight(profileDraft)} />
          <HeroChip label="Weight" value={`${profileDraft.weightKg || '-'}kg`} />
          <HeroChip label="Target" value={`${profileDraft.desiredWeightKg || '-'}kg`} />
        </div>
      </section>

      {/* Body Profile Panel */}
      <section className="rounded-[22px] border border-[#e8e4d9] bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <User className="text-[#c48227]" size={19} />
          <h2 className="text-lg font-bold text-[#2d2515]">Body Profile</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <IconInput icon={User} label="Age" value={profileDraft.age} onChange={(value) => updateProfile('age', Number(value))} type="number" />
          <IconInput icon={Scale} label="Weight" value={profileDraft.weightKg} onChange={(value) => updateProfile('weightKg', Number(value))} type="number" unit="kg" />
          <IconInput icon={Target} label="Target" value={profileDraft.desiredWeightKg} onChange={(value) => updateProfile('desiredWeightKg', Number(value))} type="number" unit="kg" />
        </div>
        <div className="mt-3">
          <HeightFields profile={profileDraft} onChange={updateProfile} />
        </div>
        <button
          type="button"
          onClick={() => onSaveProfile({ ...profileDraft, heightCm: getHeightCm(profileDraft), completed: true, updatedAt: new Date().toISOString() })}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c48227] px-4 font-bold text-white shadow transition hover:bg-[#a86e1e]"
        >
          <Save size={19} />
          Save Body Profile
        </button>
      </section>

      {/* Daily Goals Panel */}
      <section className="rounded-[22px] border border-[#e8e4d9] bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Target className="text-[#c48227]" size={19} />
          <h2 className="text-lg font-bold text-[#2d2515]">Daily Goals</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <GoalInput label="Calories" value={goalDraft.calories} unit="kcal" onChange={(value) => updateGoal('calories', value)} />
          <GoalInput label="Protein" value={goalDraft.protein} unit="g" onChange={(value) => updateGoal('protein', value)} />
          <GoalInput label="Carbs" value={goalDraft.carbs} unit="g" onChange={(value) => updateGoal('carbs', value)} />
          <GoalInput label="Fat" value={goalDraft.fat} unit="g" onChange={(value) => updateGoal('fat', value)} />
          <GoalInput label="Fiber" value={goalDraft.fiber} unit="g" onChange={(value) => updateGoal('fiber', value)} />
          <GoalInput label="Sodium" value={goalDraft.sodium} unit="mg" onChange={(value) => updateGoal('sodium', value)} />
          <GoalInput label="Water" value={goalDraft.water} unit="L" onChange={(value) => updateGoal('water', value)} />
          <GoalInput label="Burn Target" value={goalDraft.burnCalories} unit="kcal" onChange={(value) => updateGoal('burnCalories', value)} />
        </div>
        <button
          type="button"
          onClick={() => onSaveGoals(goalDraft)}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#c48227] px-4 font-bold text-white shadow transition hover:bg-[#a86e1e]"
        >
          <Save size={19} />
          Save Goals
        </button>
      </section>

      {/* AI Provider Panel */}
      <section className="rounded-[22px] border border-[#e8e4d9] bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Settings className="text-[#c48227]" size={19} />
          <h2 className="text-lg font-bold text-[#2d2515]">AI Coaching Provider</h2>
        </div>

        <SelectInput label="Provider" value={settingsDraft.provider} onChange={(value) => updateSetting('provider', value)} options={[
          ['auto', 'Auto from backend'],
          ['offline', 'Offline estimates'],
          ['gemini', 'Google Gemini'],
          ['cloudflare', 'Cloudflare Workers AI'],
          ['openrouter', 'OpenRouter free model'],
        ]} />

        <p className="mt-3 rounded-xl border border-[#e8e4d9] bg-[#f2efe4]/50 px-3 py-3 text-xs leading-5 text-[#7a6f5d]">
          AI keys are configured on the backend server. The app checks locally known items first and caches AI responses.
        </p>

        <button
          type="button"
          onClick={() => onSaveAi(settingsDraft)}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#c48227] bg-transparent px-4 font-bold text-[#c48227] transition hover:bg-[#c48227]/10"
        >
          <Save size={19} />
          Save AI Settings
        </button>
      </section>
    </div>
  );
}

// Input Helpers for ElderProfile
function HeroChip({ label, value }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-[#f2efe4]/60 py-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#7a6f5d]">{label}</span>
      <span className="mt-1 text-sm font-bold text-[#2d2515]">{value}</span>
    </div>
  );
}

function IconInput({ icon: Icon, label, value, onChange, type = 'text', unit, required = false, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[#7a6f5d] font-semibold">{label}</span>
      <span className="flex h-12 items-center gap-2 rounded-xl border border-[#e8e4d9] bg-[#fcfaf2] px-3 transition focus-within:border-[#c48227]">
        <Icon size={17} className="shrink-0 text-[#c48227]" />
        <input
          type={type}
          value={value ?? ''}
          required={required}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#2d2515] outline-none placeholder:text-[#7a6f5d]/60"
        />
        {unit && <span className="text-xs text-[#7a6f5d]">{unit}</span>}
      </span>
    </label>
  );
}

// Select Input
function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-[#7a6f5d] font-semibold">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-[#e8e4d9] bg-[#fcfaf2] px-3 text-sm font-semibold text-[#2d2515] outline-none transition focus:border-[#c48227]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function HeightFields({ profile, onChange }) {
  const unit = profile.heightUnit || 'cm';

  function setUnit(nextUnit) {
    if (nextUnit === unit) return;
    const currentCm = getHeightCm(profile);
    if (nextUnit === 'ft') {
      const { feet, inches } = cmToFeetInches(currentCm);
      onChange('heightUnit', 'ft');
      onChange('heightFeet', feet);
      onChange('heightInches', inches);
      return;
    }

    onChange('heightUnit', 'cm');
    onChange('heightCm', currentCm);
  }

  return (
    <div className="rounded-xl border border-[#e8e4d9] bg-[#f2efe4]/30 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Ruler size={17} className="text-[#c48227]" />
          <span className="text-sm font-bold text-[#2d2515]">Height</span>
        </div>
        <div className="grid grid-cols-2 rounded-lg border border-[#e8e4d9] bg-[#f2efe4] p-1 text-xs">
          <button
            type="button"
            onClick={() => setUnit('cm')}
            className={`h-8 rounded-md px-3 font-semibold transition ${unit === 'cm' ? 'bg-[#c48227] text-white' : 'text-[#7a6f5d]'}`}
          >
            cm
          </button>
          <button
            type="button"
            onClick={() => setUnit('ft')}
            className={`h-8 rounded-md px-3 font-semibold transition ${unit === 'ft' ? 'bg-[#c48227] text-white' : 'text-[#7a6f5d]'}`}
          >
            ft
          </button>
        </div>
      </div>

      {unit === 'ft' ? (
        <div className="grid grid-cols-2 gap-3">
          <IconInput icon={Ruler} label="Feet" value={profile.heightFeet ?? 5} onChange={(value) => onChange('heightFeet', Number(value))} type="number" unit="ft" required />
          <IconInput icon={Ruler} label="Inches" value={profile.heightInches ?? 7} onChange={(value) => onChange('heightInches', Number(value))} type="number" unit="in" required />
        </div>
      ) : (
        <IconInput icon={Ruler} label="Centimeters" value={profile.heightCm ?? 170} onChange={(value) => onChange('heightCm', Number(value))} type="number" unit="cm" required />
      )}
    </div>
  );
}

function GoalInput({ label, value, unit, onChange }) {
  return (
    <label className="rounded-xl border border-[#e8e4d9] bg-white p-3 flex flex-col">
      <span className="block text-xs text-[#7a6f5d] font-semibold">{label}</span>
      <span className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min="0"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-lg font-black text-[#2d2515] outline-none"
        />
        <span className="text-xs text-[#7a6f5d] font-bold">{unit}</span>
      </span>
    </label>
  );
}
