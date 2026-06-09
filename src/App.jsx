import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  CalendarDays,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Flame,
  Gauge,
  Home,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Minus,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  Scale,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Target,
  Trash2,
  Upload,
  User,
  UserPlus,
  Utensils,
  X,
} from 'lucide-react';
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts';
import { defaultAiSettings, defaultGoals, mealTypes, quickFoods } from './data/foods.js';
import { loadAppState, saveAppState } from './lib/storage.js';
import {
  apiRegister,
  apiLogin,
  apiGetMe,
  apiSaveProfile,
  apiSaveGoals,
  apiSaveAiSettings,
  apiGetDayLog,
  apiAddMeal,
  apiRemoveMeal,
  apiLogout,
  apiForgotPassword,
  apiResetPassword,
} from './lib/api.js';
import { lookupNutrition } from './lib/aiNutrition.js';
import {
  addTotals,
  buildSmartTip,
  clampGoalDraft,
  formatDayLabel,
  goalProgress,
  nutritionFromQuickFood,
  roundMetric,
  scaleNutrition,
  todayKey,
  uid,
} from './lib/nutritionMath.js';

const initialState = {
  goals: defaultGoals,
  aiSettings: defaultAiSettings,
  logs: {},
  users: [],
  sessionUserId: null,
};

const navItems = [
  { id: 'dashboard', label: 'Today', icon: Home },
  { id: 'log', label: 'Log', icon: Search },
  { id: 'coach', label: 'Coach', icon: Bot },
  { id: 'ideal', label: 'Ideal', icon: Gauge },
  { id: 'profile', label: 'Profile', icon: User },
];

const foodVisuals = {
  rice: { type: 'bowl', bg: '#17342c', plate: '#f8fafc', fill: '#f2efe4', accent: '#d7b861' },
  egg: { type: 'egg', bg: '#2d2515', plate: '#fff8df', fill: '#fff7de', accent: '#f0b849' },
  banana: { type: 'banana', bg: '#2c2b11', plate: '#f9f6c9', fill: '#f2d451', accent: '#7f5e21' },
  roti: { type: 'flatbread', bg: '#2d2118', plate: '#f4ead6', fill: '#c58b48', accent: '#7b4b27' },
  dal: { type: 'bowl', bg: '#302316', plate: '#fff0d2', fill: '#d99a31', accent: '#73c657' },
  'chicken-breast': { type: 'protein', bg: '#2c1f1a', plate: '#fff1e5', fill: '#d88a5c', accent: '#8fe77b' },
  'chicken-burger': { type: 'burger', bg: '#302414', plate: '#fff3d6', fill: '#d0903e', accent: '#69d36d' },
  paneer: { type: 'cubes', bg: '#2a2417', plate: '#fff4d6', fill: '#f2dfaa', accent: '#72d38c' },
  idli: { type: 'bowl', bg: '#1c302d', plate: '#f8fafc', fill: '#fff9eb', accent: '#d65b4a' },
  dosa: { type: 'flatbread', bg: '#302214', plate: '#fff4d6', fill: '#d18b38', accent: '#efc45e' },
  oats: { type: 'bowl', bg: '#27301b', plate: '#f4f0d7', fill: '#c7b889', accent: '#9b7656' },
  milk: { type: 'drink', bg: '#142d35', plate: '#e9fbff', fill: '#f7fdff', accent: '#80d7e9' },
  curd: { type: 'bowl', bg: '#18323b', plate: '#eaffff', fill: '#f7ffff', accent: '#8bd1e7' },
  apple: { type: 'fruit', bg: '#2c171b', plate: '#ffe8ed', fill: '#db5b83', accent: '#80d36f' },
  almonds: { type: 'nuts', bg: '#2f2118', plate: '#fff0df', fill: '#9f623b', accent: '#d69d5d' },
  poha: { type: 'bowl', bg: '#302617', plate: '#fff3d3', fill: '#e0b145', accent: '#80c76c' },
  upma: { type: 'bowl', bg: '#2d2a1d', plate: '#fff5db', fill: '#cfb47b', accent: '#5fcf87' },
  fish: { type: 'protein', bg: '#132d35', plate: '#e7fbff', fill: '#8bc8dd', accent: '#b7f34a' },
  tofu: { type: 'cubes', bg: '#1f3025', plate: '#ecfff3', fill: '#eff2df', accent: '#3ee681' },
  potato: { type: 'cubes', bg: '#302719', plate: '#fff3d8', fill: '#c99a5a', accent: '#8bd36e' },
  salad: { type: 'leaf', bg: '#123225', plate: '#e9fff3', fill: '#3ee681', accent: '#f0b849' },
  'peanut-butter': { type: 'jar', bg: '#342315', plate: '#fff0db', fill: '#b7742f', accent: '#f0b849' },
  whey: { type: 'drink', bg: '#1d2937', plate: '#eef6ff', fill: '#dfe8f2', accent: '#4dd5c4' },
  'black-coffee': { type: 'drink', bg: '#17130f', plate: '#f4eadf', fill: '#3a2419', accent: '#c58b48' },
};

const activityMultipliers = {
  low: 1.25,
  moderate: 1.45,
  high: 1.65,
  athlete: 1.85,
};

function getFoodVisual(foodId) {
  return foodVisuals[foodId] || { type: 'bowl', bg: '#14241f', plate: '#eafff2', fill: '#3ee681', accent: '#f0b849' };
}

function reducer(state, action) {
  switch (action.type) {
    case 'hydrate': {
      const payload = action.payload || {};
      const users = Array.isArray(payload.users) ? payload.users : [];
      const sessionUserId = users.some((user) => user.id === payload.sessionUserId) ? payload.sessionUserId : null;

      return {
        goals: { ...defaultGoals, ...payload.goals },
        aiSettings: { ...defaultAiSettings, ...payload.aiSettings },
        logs: payload.logs || {},
        users,
        sessionUserId,
      };
    }
    case 'createUser':
      return {
        ...state,
        users: [...state.users, action.user],
        sessionUserId: action.user.id,
      };
    case 'login':
      return { ...state, sessionUserId: action.userId };
    case 'logout':
      return { ...state, sessionUserId: null };
    case 'saveProfile':
      return {
        ...state,
        users: state.users.map((user) => (user.id === action.userId ? { ...user, name: action.profile.name || user.name, profile: action.profile } : user)),
        goals: action.goals ? { ...state.goals, ...action.goals } : state.goals,
      };
    case 'addMeal': {
      const date = action.date || todayKey();
      const current = state.logs[date] || [];
      return {
        ...state,
        logs: {
          ...state.logs,
          [date]: [action.item, ...current],
        },
      };
    }
    case 'removeMeal': {
      const date = action.date || todayKey();
      const nextItems = (state.logs[date] || []).filter((item) => item.id !== action.id);
      return {
        ...state,
        logs: {
          ...state.logs,
          [date]: nextItems,
        },
      };
    }
    case 'saveGoals':
      return { ...state, goals: clampGoalDraft(action.goals) };
    case 'saveAiSettings':
      return { ...state, aiSettings: { ...defaultAiSettings, ...action.settings } };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [hydrated, setHydrated] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [modalResult, setModalResult] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    let mounted = true;
    async function init() {
      // Load offline cache first for instant UI
      const saved = await loadAppState();
      if (mounted && saved) dispatch({ type: 'hydrate', payload: saved });

      // Try fetching from cloud
      const user = await apiGetMe();
      if (user && mounted) {
        // Sync user profile/goals/settings to local state
        dispatch({
          type: 'hydrate',
          payload: {
            users: [user],
            sessionUserId: user.id || user._id,
            goals: user.goals,
            aiSettings: user.aiSettings,
            logs: saved?.logs || {}, // Keep existing local logs briefly
          },
        });

        // Fetch today's log from cloud
        const today = todayKey();
        try {
          const logData = await apiGetDayLog(today);
          if (mounted && logData?.items) {
            dispatch({
              type: 'hydrate',
              payload: {
                users: [user],
                sessionUserId: user.id || user._id,
                goals: user.goals,
                aiSettings: user.aiSettings,
                logs: { ...(saved?.logs || {}), [today]: logData.items },
              },
            });
          }
        } catch (err) {
          console.warn('Failed to fetch today log:', err);
        }
      }
      if (mounted) setHydrated(true);
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveAppState(state).catch(() => setToast('Could not save changes locally.'));
  }, [hydrated, state]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const currentUser = state.users.find((user) => user.id === state.sessionUserId);
  const todayItems = state.logs[todayKey()] || [];
  const todayTotals = useMemo(() => addTotals(todayItems), [todayItems]);
  const smartTip = useMemo(() => buildSmartTip(todayTotals, state.goals), [todayTotals, state.goals]);

  async function addResultToLog(result, mealType, date = todayKey()) {
    const item = {
      id: uid(),
      mealType,
      foodId: result.foodId,
      name: result.foodName,
      quantity: result.quantity,
      nutrition: result.nutrition,
      source: result.source,
      notes: result.notes,
      createdAt: new Date().toISOString(),
    };

    // Optimistic UI update
    dispatch({ type: 'addMeal', date, item });
    setModalResult(null);
    setSelectedDate(date);
    setToast(`${result.foodName} logged`);

    // Cloud sync
    try {
      await apiAddMeal(date, item);
    } catch (err) {
      setToast('Failed to save meal to cloud');
      dispatch({ type: 'removeMeal', date, id: item.id }); // Revert on failure
    }
  }

  async function handleRegister(account) {
    const email = account.email.trim().toLowerCase();
    try {
      const user = await apiRegister(account.name.trim(), email, account.password);
      dispatch({
        type: 'createUser',
        user: { ...user, id: user._id || user.id },
      });
      setToast('Account created');
      return true;
    } catch (err) {
      setToast(err.message || 'Registration failed');
      return false;
    }
  }

  async function handleLogin(credentials) {
    const email = credentials.email.trim().toLowerCase();
    try {
      const user = await apiLogin(email, credentials.password);
      // Sync cloud data to local state
      dispatch({
        type: 'hydrate',
        payload: {
          users: [{ ...user, id: user._id || user.id }],
          sessionUserId: user._id || user.id,
          goals: user.goals,
          aiSettings: user.aiSettings,
        },
      });
      setToast(`Welcome back, ${user.name}`);

      // Fetch logs for today
      try {
        const today = todayKey();
        const logData = await apiGetDayLog(today);
        if (logData?.items) {
          dispatch({
            type: 'hydrate',
            payload: {
              users: [{ ...user, id: user._id || user.id }],
              sessionUserId: user._id || user.id,
              goals: user.goals,
              aiSettings: user.aiSettings,
              logs: { [today]: logData.items },
            },
          });
        }
      } catch (e) {
        console.warn('Failed to fetch logs after login', e);
      }

      return true;
    } catch (err) {
      setToast(err.message || 'Invalid credentials');
      return false;
    }
  }

  async function handleProfileSave(profile) {
    const goals = estimateGoalsFromProfile(profile);
    // Optimistic UI
    dispatch({ type: 'saveProfile', userId: currentUser.id, profile, goals });
    setToast('Profile ready');
    setActiveTab('dashboard');

    // Cloud sync
    try {
      await apiSaveProfile(profile, goals);
    } catch (err) {
      setToast('Failed to sync profile to cloud');
    }
  }

  async function handleLogout() {
    await apiLogout();
    dispatch({ type: 'logout' });
    setShowLogoutConfirm(false);
  }

  async function handleLogWater(amountL) {
    const item = {
      id: uid(),
      mealType: 'Water',
      foodId: 'water',
      name: 'Water',
      quantity: `${amountL * 1000}ml`,
      nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, water: amountL },
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'addMeal', date: todayKey(), item });
    setToast(`Logged ${amountL * 1000}ml water`);
    try { await apiAddMeal(todayKey(), item); } catch (err) { setToast('Failed to sync'); }
  }

  if (!hydrated || !introDone) {
    return <SplashScreen onDone={() => setIntroDone(true)} />;
  }

  let content;
  if (!currentUser) {
    content = <AuthScreen onLogin={handleLogin} onRegister={handleRegister} onToast={setToast} />;
  } else if (!currentUser.profile?.completed) {
    content = <ProfileSetup user={currentUser} onComplete={handleProfileSave} onLogout={() => dispatch({ type: 'logout' })} />;
  } else {
    content = (
      <TrackerShell
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        goals={state.goals}
        aiSettings={state.aiSettings}
        logs={state.logs}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        todayItems={todayItems}
        todayTotals={todayTotals}
        smartTip={smartTip}
        setModalResult={setModalResult}
        setToast={setToast}
        onLogout={() => setShowLogoutConfirm(true)}
        onLogWater={handleLogWater}
        onRemoveToday={async (id) => {
          dispatch({ type: 'removeMeal', date: todayKey(), id });
          try { await apiRemoveMeal(todayKey(), id); } catch (err) { setToast('Failed to sync delete'); }
        }}
        onRemoveHistory={async (date, id) => {
          dispatch({ type: 'removeMeal', date, id });
          try { await apiRemoveMeal(date, id); } catch (err) { setToast('Failed to sync delete'); }
        }}
        onSaveGoals={async (goals) => {
          dispatch({ type: 'saveGoals', goals });
          setToast('Goals saved');
          try { await apiSaveGoals(goals); } catch (err) { console.warn(err); }
        }}
        onSaveAi={async (settings) => {
          dispatch({ type: 'saveAiSettings', settings });
          setToast('AI settings saved');
          try { await apiSaveAiSettings(settings); } catch (err) { console.warn(err); }
        }}
        onApplyCoachGoals={(goals) => {
          dispatch({ type: 'saveGoals', goals: { ...state.goals, ...goals } });
          setToast('AI coaching goals applied');
          setActiveTab('profile');
        }}
        onSaveProfile={handleProfileSave}
      />
    );
  }

  return (
    <div className="app-shell min-h-screen text-white">
      {content}
      {modalResult && (
        <NutritionModal
          result={modalResult}
          onClose={() => setModalResult(null)}
          onAdd={addResultToLog}
        />
      )}
      {toast && <Toast message={toast} />}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-[24px] border border-white/10 bg-ink p-6 shadow-2xl">
            <h3 className="text-xl font-black text-white">Logout</h3>
            <p className="mt-2 text-sm text-zinc-300">Are you sure you want to log out?</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-zinc-400 hover:text-white">Cancel</button>
              <button type="button" onClick={handleLogout} className="rounded-xl bg-berry px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 active:scale-95">Yes, Logout</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrackerShell({
  activeTab,
  setActiveTab,
  currentUser,
  goals,
  aiSettings,
  logs,
  selectedDate,
  setSelectedDate,
  todayItems,
  todayTotals,
  smartTip,
  setModalResult,
  setToast,
  onLogout,
  onLogWater,
  onRemoveToday,
  onRemoveHistory,
  onSaveGoals,
  onSaveAi,
  onApplyCoachGoals,
  onSaveProfile,
}) {
  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-md flex-col sm:p-5">
      <div className="phone-frame relative flex h-[100dvh] min-h-0 flex-col overflow-hidden sm:h-[calc(100vh-2.5rem)]">
        <AppHeader user={currentUser} onLogout={onLogout} />
        <main className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-32 pt-4">
          {activeTab === 'dashboard' && (
            <Dashboard
              user={currentUser}
              goals={goals}
              items={todayItems}
              totals={todayTotals}
              smartTip={smartTip}
              onRemove={onRemoveToday}
              onLog={() => setActiveTab('log')}
              onLogWater={onLogWater}
            />
          )}

          {activeTab === 'log' && (
            <LogFood
              aiSettings={aiSettings}
              goals={goals}
              todayItems={todayItems}
              todayTotals={todayTotals}
              onResult={setModalResult}
              onToast={setToast}
              onRemove={onRemoveToday}
              onOpenScan={() => setActiveTab('scan')}
              onOpenHistory={() => setActiveTab('history')}
            />
          )}

          {activeTab === 'scan' && (
            <CameraScan
              aiSettings={aiSettings}
              onResult={setModalResult}
              onToast={setToast}
            />
          )}

          {activeTab === 'coach' && (
            <AICoaching
              user={currentUser}
              goals={goals}
              aiSettings={aiSettings}
              onApplyGoals={onApplyCoachGoals}
              onToast={setToast}
            />
          )}

          {activeTab === 'ideal' && (
            <IdealWeight user={currentUser} />
          )}

          {activeTab === 'history' && (
            <History
              logs={logs}
              goals={goals}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onRemove={onRemoveHistory}
            />
          )}

          {activeTab === 'profile' && (
            <ProfilePanel
              user={currentUser}
              goals={goals}
              aiSettings={aiSettings}
              onSaveGoals={onSaveGoals}
              onSaveAi={onSaveAi}
              onSaveProfile={onSaveProfile}
            />
          )}
        </main>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
}

function SplashScreen({ onDone }) {
  useEffect(() => {
    playIntroMusic();
    const timer = window.setTimeout(onDone, 3300);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="app-shell relative grid min-h-screen place-items-center overflow-hidden text-white" onPointerDown={playIntroMusic}>
      <div className="splash-grid absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center px-8 text-center">
        <div className="logo-stage">
          <LogoMark size="xl" animated />
        </div>
        <h1 className="mt-7 text-4xl font-black text-white">Sistum Tracker</h1>
        <p className="mt-2 text-sm uppercase text-limeFresh">Calorie Tracking App</p>
        <div className="mt-8 flex items-end gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((bar) => (
            <span key={bar} className="music-bar" style={{ animationDelay: `${bar * 90}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AuthScreen({ onLogin, onRegister, onToast }) {
  const [mode, setMode] = useState('login'); // login | register | forgot | reset
  const [form, setForm] = useState({ name: '', email: '', password: '', code: '', newPassword: '' });

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (mode === 'login') onLogin({ email: form.email, password: form.password });
    if (mode === 'register') onRegister(form);
    if (mode === 'forgot') {
      try {
        const data = await apiForgotPassword(form.email);
        onToast(data.message || 'Check your email for the code');
        if (data.code) onToast(`Dev Code: ${data.code}`); // For local testing
        setMode('reset');
      } catch (err) {
        onToast(err.message || 'Failed to send reset code');
      }
    }
    if (mode === 'reset') {
      try {
        const data = await apiResetPassword(form.email, form.code, form.newPassword);
        onToast(data.message || 'Password reset successful');
        setMode('login');
      } catch (err) {
        onToast(err.message || 'Reset failed');
      }
    }
  }

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4 py-8">
      <section className="auth-panel w-full overflow-hidden rounded-[28px] border border-white/10">
        <div className="relative p-6">
          <div className="brand-sheen absolute inset-0" />
          <div className="relative flex items-center gap-4">
            <LogoMark />
            <div>
              <h1 className="text-2xl font-black">Sistum Tracker</h1>
              <p className="text-sm text-zinc-300">Calorie Tracking App</p>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`h-11 rounded-lg text-sm font-semibold transition ${mode === 'login' ? 'bg-limeFresh text-ink' : 'text-zinc-300'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`h-11 rounded-lg text-sm font-semibold transition ${mode === 'register' ? 'bg-limeFresh text-ink' : 'text-zinc-300'}`}
            >
              Register
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 pb-6">
          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <IconInput
              icon={Mail}
              label="Email"
              value={form.email}
              onChange={(value) => update('email', value)}
              required
              type="email"
              placeholder="you@example.com"
            />
          )}

          {mode === 'register' && (
            <IconInput
              icon={User}
              label="Name"
              value={form.name}
              onChange={(value) => update('name', value)}
              required
              placeholder="Your name"
            />
          )}

          {(mode === 'login' || mode === 'register') && (
            <IconInput
              icon={Lock}
              label="Password"
              value={form.password}
              onChange={(value) => update('password', value)}
              required
              type="password"
              placeholder="Password"
            />
          )}

          {mode === 'reset' && (
            <>
              <IconInput
                icon={Lock}
                label="Reset Code"
                value={form.code}
                onChange={(value) => update('code', value)}
                required
                placeholder="6-digit code"
              />
              <IconInput
                icon={Lock}
                label="New Password"
                value={form.newPassword}
                onChange={(value) => update('newPassword', value)}
                required
                type="password"
                placeholder="New Password"
              />
            </>
          )}

          {mode === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-xs font-medium text-limeFresh hover:underline"
              >
                Forgot Password?
              </button>
            </div>
          )}

          <button
            type="submit"
            className="group inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-limeFresh px-4 font-bold text-ink shadow-[0_18px_42px_rgba(183,243,74,0.24)] transition hover:-translate-y-0.5 active:scale-95"
          >
            {mode === 'login' && <><LogIn size={19} /> Start logging</>}
            {mode === 'register' && <><UserPlus size={19} /> Create profile</>}
            {mode === 'forgot' && <><Send size={19} /> Send Code</>}
            {mode === 'reset' && <><Lock size={19} /> Reset Password</>}
          </button>
          
          {(mode === 'forgot' || mode === 'reset') && (
            <button
              type="button"
              onClick={() => setMode('login')}
              className="mt-2 w-full text-center text-sm text-zinc-400 hover:text-white"
            >
              Back to login
            </button>
          )}
        </form>
      </section>
    </div>
  );
}

function ProfileSetup({ user, onComplete, onLogout }) {
  const [draft, setDraft] = useState(() => ({
    name: user.name || '',
    gender: 'male',
    dob: '1998-01-01',
    age: '',
    heightUnit: 'cm',
    heightCm: 170,
    heightFeet: 5,
    heightInches: 7,
    weightKg: 70,
    desiredWeightKg: 65,
    activity: 'moderate',
    goal: 'lose',
    dietPreference: 'balanced',
  }));

  function update(key, value) {
    setDraft((current) => {
      if (key === 'dob') {
        const age = getAgeFromDob(value);
        return { ...current, dob: value, age: age || current.age };
      }
      return { ...current, [key]: value };
    });
  }

  function submit(event) {
    event.preventDefault();
    const age = Number(draft.age || getAgeFromDob(draft.dob) || 25);
    onComplete({
      ...draft,
      age,
      heightCm: getHeightCm(draft),
      weightKg: Number(draft.weightKg),
      desiredWeightKg: Number(draft.desiredWeightKg || draft.weightKg),
      completed: true,
      updatedAt: new Date().toISOString(),
    });
  }

  const previewGoals = estimateGoalsFromProfile({ ...draft, age: Number(draft.age || getAgeFromDob(draft.dob) || 25), heightCm: getHeightCm(draft) });

  return (
    <div className="mx-auto min-h-screen w-full max-w-md px-4 py-6">
      <section className="auth-panel overflow-hidden rounded-[28px] border border-white/10">
        <div className="relative p-6">
          <div className="brand-sheen absolute inset-0" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <LogoMark />
              <div>
                <p className="text-sm text-limeFresh">Profile build</p>
                <h1 className="text-2xl font-black">Sistum Tracker</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-zinc-300"
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 pb-6">
          <IconInput icon={User} label="Name" value={draft.name} onChange={(value) => update('name', value)} required />
          <IconInput icon={CalendarDays} label="Date of birth" value={draft.dob} onChange={(value) => update('dob', value)} type="date" required />
          <div className="grid grid-cols-2 gap-3">
            <SelectInput label="Gender" value={draft.gender} onChange={(value) => update('gender', value)} options={[
              ['male', 'Male'],
              ['female', 'Female'],
              ['other', 'Other'],
            ]} />
            <IconInput icon={User} label="Age" value={draft.age} onChange={(value) => update('age', value)} type="number" required />
          </div>
          <HeightFields profile={draft} onChange={update} />
          <div className="grid grid-cols-2 gap-3">
            <IconInput icon={Scale} label="Weight" value={draft.weightKg} onChange={(value) => update('weightKg', value)} type="number" unit="kg" required />
            <IconInput icon={Target} label="Desired weight" value={draft.desiredWeightKg} onChange={(value) => update('desiredWeightKg', value)} type="number" unit="kg" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectInput label="Goal" value={draft.goal} onChange={(value) => update('goal', value)} options={[
              ['lose', 'Lose'],
              ['maintain', 'Maintain'],
              ['gain', 'Gain'],
            ]} />
            <SelectInput label="Activity" value={draft.activity} onChange={(value) => update('activity', value)} options={[
              ['low', 'Low'],
              ['moderate', 'Moderate'],
              ['high', 'High'],
              ['athlete', 'Athlete'],
            ]} />
          </div>
          <SelectInput label="Food style" value={draft.dietPreference} onChange={(value) => update('dietPreference', value)} options={[
            ['balanced', 'Balanced'],
            ['vegetarian', 'Vegetarian'],
            ['high-protein', 'High protein'],
            ['indian', 'Indian meals'],
          ]} />

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-2 text-limeFresh">
              <ShieldCheck size={17} />
              <h2 className="text-sm font-bold text-white">Starting targets</h2>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <MiniMetric label="Kcal" value={previewGoals.calories} />
              <MiniMetric label="Protein" value={`${previewGoals.protein}g`} />
              <MiniMetric label="Carbs" value={`${previewGoals.carbs}g`} />
            </div>
          </div>

          <button type="submit" className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-limeFresh px-4 font-bold text-ink transition hover:-translate-y-0.5 active:scale-95">
            <Check size={20} />
            Enter app
          </button>
        </form>
      </section>
    </div>
  );
}

function AppHeader({ user, onLogout }) {
  return (
    <header className="sticky top-0 z-20 bg-ink/80 px-4 py-4 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-limeFresh">Sistum Tracker</p>
            <h1 className="truncate text-lg font-bold text-white">Hello, {user.name}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.03] text-zinc-400 transition hover:bg-white/[0.08] hover:text-white active:scale-95"
          aria-label="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function GlowingRing({ progress }) {
  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative mx-auto flex h-48 w-48 items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90 transform drop-shadow-[0_0_24px_rgba(255,176,32,0.4)]">
        <circle
          stroke="rgba(255,255,255,0.05)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="#FFB020"
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-white">{progress}%</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Fuel</span>
      </div>
    </div>
  );
}

function Dashboard({ user, goals, items, totals, smartTip, onRemove, onLog, onLogWater }) {
  const profile = user.profile || {};
  const remaining = Math.max(0, goals.calories - totals.calories);
  const progress = goalProgress(totals.calories, goals.calories);

  return (
    <div className="space-y-4">
      <section className="hero-panel animate-rise animate-stagger-1 relative overflow-hidden rounded-[32px] p-5">
        <div className="hero-lines absolute inset-0" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="inline-flex rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs uppercase text-limeFresh">{formatDayLabel(todayKey())}</p>
            <h2 className="mt-3 text-3xl font-black text-white">{roundMetric(totals.calories, 0)} kcal</h2>
            <p className="mt-1 text-sm text-zinc-300">{remaining} kcal remaining</p>
          </div>
          <button
            type="button"
            onClick={onLog}
            className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-limeFresh text-ink shadow-[0_16px_42px_rgba(183,243,74,0.28)] transition hover:-translate-y-0.5 active:scale-95"
            aria-label="Log food"
          >
            <Plus size={24} />
          </button>
        </div>

        <div className="relative mt-6 flex items-center justify-center py-2">
          <GlowingRing progress={progress} />
        </div>

        <div className="relative mt-3 grid grid-cols-3 gap-2">
          <HeroChip label="Goal" value={`${goals.calories}`} />
          <HeroChip label="Weight" value={`${profile.weightKg || '-'}kg`} />
          <HeroChip label="Target" value={`${profile.desiredWeightKg || '-'}kg`} />
        </div>
      </section>

      <MacroSummary totals={totals} goals={goals} />

      <WaterTracker totals={totals} goals={goals} onLogWater={onLogWater} />

      <section className="animate-rise animate-stagger-4 rounded-[32px] bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-limeFresh">
          <Sparkles size={16} />
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">Smart tip</h2>
        </div>
        <p className="mt-3 text-sm font-light leading-relaxed text-zinc-300">{smartTip}</p>
      </section>

      <MealLog date={todayKey()} items={items} onRemove={onRemove} />
    </div>
  );
}

function MacroSummary({ totals, goals }) {
  const rows = [
    { key: 'protein', label: 'Protein', unit: 'g', color: '#B026FF' },
    { key: 'carbs', label: 'Carbs', unit: 'g', color: '#00F0FF' },
    { key: 'fat', label: 'Fat', unit: 'g', color: '#FFEA00' },
    { key: 'fiber', label: 'Fiber', unit: 'g', color: '#FF3366' },
  ];

  return (
    <section className="animate-rise animate-stagger-2 animate-shimmer rounded-[32px] bg-white/[0.02] p-5">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Daily Fuel</h2>
      </div>
      <div className="grid gap-4">
        {rows.map((row) => {
          const progress = goalProgress(totals[row.key], goals[row.key]);
          return (
            <div key={row.key}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-white">{row.label}</span>
                <span className="font-light text-zinc-500">
                  <span className="text-white">{roundMetric(totals[row.key])}</span> / {goals[row.key]}{row.unit}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: row.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function WaterTracker({ totals, goals, onLogWater }) {
  const progress = goalProgress(totals.water, goals.water);
  const [showInput, setShowInput] = useState(false);
  const [amount, setAmount] = useState('250');

  function handleAdd() {
    const val = Number(amount);
    if (val > 0) {
      onLogWater(val / 1000); // Convert ml to L
      setShowInput(false);
      setAmount('250');
    }
  }

  return (
    <section className="animate-rise animate-stagger-3 animate-shimmer rounded-[32px] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Hydration</h2>
        <span className="text-sm font-light text-zinc-500">
          <span className="font-medium text-white">{roundMetric(totals.water || 0)}</span> / {goals.water}L
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-12 flex-1 overflow-hidden rounded-2xl bg-white/[0.04]">
          <div className="absolute bottom-0 left-0 top-0 bg-aqua transition-all duration-700" style={{ width: `${progress}%`, opacity: 0.8 }} />
        </div>
        {showInput ? (
          <div className="flex h-12 w-[120px] items-center rounded-2xl bg-white/[0.05] pr-1">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent px-3 text-sm text-white outline-none"
              placeholder="ml"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aqua/20 text-aqua hover:bg-aqua/30"
            >
              <Check size={16} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowInput(true)}
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-aqua/10 px-4 text-sm font-medium text-aqua transition hover:-translate-y-0.5 active:scale-95"
            aria-label="Add water"
          >
            <Plus size={16} /> Add
          </button>
        )}
      </div>
    </section>
  );
}

function LogFood({ aiSettings, goals, todayItems, todayTotals, onResult, onToast, onRemove, onOpenScan, onOpenHistory }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = ['All', ...Array.from(new Set(quickFoods.map((food) => food.category)))];
  const foods = selectedCategory === 'All' ? quickFoods : quickFoods.filter((food) => food.category === selectedCategory);

  async function handleLookup(event) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    const result = await lookupNutrition(trimmed, aiSettings);
    onResult(result);
    if (result.source.includes('fallback') || result.confidence === 'low') onToast('AI was unavailable, so an estimate was used');
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <section className="hero-panel animate-rise overflow-hidden rounded-[32px]">
        <div className="relative p-5">
          <div className="hero-lines absolute inset-0" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-limeFresh">
              <Utensils size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black">Log food</h2>
              <p className="text-sm text-zinc-300">{roundMetric(todayTotals.calories, 0)} kcal today</p>
            </div>
          </div>
        </div>
        <form onSubmit={handleLookup} className="flex gap-2 px-4 pb-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 rounded-2xl border-none bg-white/[0.05] px-4 text-base text-white outline-none transition focus:bg-white/[0.08]"
            placeholder="Food and quantity"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-limeFresh text-ink transition hover:-translate-y-0.5 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Lookup nutrition"
          >
            {loading ? <RefreshCw className="animate-spin" size={21} /> : <Search size={21} />}
          </button>
        </form>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4">
          <button type="button" onClick={onOpenScan} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-limeFresh/20 text-sm font-bold text-limeFresh hover:bg-limeFresh/30">
            <Camera size={18} /> Camera Scan
          </button>
          <button type="button" onClick={onOpenHistory} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/20 text-sm font-bold text-zinc-300 hover:text-white">
            <CalendarDays size={18} /> History
          </button>
        </div>
        <div className="px-4 pb-4">
          <TodayTray items={todayItems} goals={goals} totals={todayTotals} onRemove={onRemove} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold">Quick foods</h2>
          <span className="rounded-lg bg-white/[0.08] px-2 py-1 text-xs text-zinc-400">{foods.length}</span>
        </div>

        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-sm transition active:scale-95 ${selectedCategory === category ? 'border-limeFresh bg-limeFresh text-ink' : 'border-white/10 bg-white/5 text-zinc-300'}`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          {foods.map((food) => (
            <QuickFoodCard
              key={food.id}
              food={food}
              onSelect={() => onResult(nutritionFromQuickFood(food))}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function TodayTray({ items, goals, totals, onRemove }) {
  const progress = goalProgress(totals.calories, goals.calories);

  return (
    <div className="rounded-[24px] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingBasket className="text-limeFresh" size={18} />
          <h3 className="text-sm font-bold">Today</h3>
        </div>
        <span className="text-xs text-zinc-400">{items.length} items</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-limeFresh transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>

      {items.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-sm text-zinc-400">
          Nothing logged yet.
        </div>
      ) : (
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <CompactMealRow key={item.id} item={item} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompactMealRow({ item, onRemove }) {
  return (
    <div className="animate-pop grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2">
      <FoodVisual foodId={item.foodId} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{item.name}</p>
        <p className="truncate text-xs text-zinc-500">{item.quantity}</p>
        <p className="mt-1 text-xs text-zinc-400">{roundMetric(item.nutrition.calories, 0)} kcal</p>
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

function QuickFoodCard({ food, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group animate-rise grid min-h-24 grid-cols-[72px_1fr_auto] items-center gap-3 rounded-[20px] border border-white/10 bg-white/5 p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-limeFresh hover:bg-white/[0.08] focus:border-limeFresh focus:outline-none active:scale-[0.99]"
    >
      <FoodVisual foodId={food.id} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-base font-bold text-white">{food.shortName}</span>
          <span className="shrink-0 rounded-lg bg-black/25 px-2 py-0.5 text-[11px] text-zinc-400">{food.category}</span>
        </div>
        <p className="mt-1 truncate text-xs text-zinc-400">{food.quantity} | {food.servingGrams} g</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg bg-black/25 px-2 py-1 text-limeFresh">{food.nutrition.calories} kcal</span>
          <span className="rounded-lg bg-black/25 px-2 py-1 text-mint">{food.nutrition.protein}g protein</span>
        </div>
      </div>
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-limeFresh text-ink transition group-hover:rotate-90">
        <Plus size={20} />
      </span>
    </button>
  );
}

function FoodHeroVisual() {
  return (
    <div className="relative h-32 w-28">
      <div className="animate-float absolute left-0 top-5">
        <FoodVisual foodId="salad" />
      </div>
      <div className="animate-float-delayed absolute right-0 top-0">
        <FoodVisual foodId="egg" size="sm" />
      </div>
      <div className="animate-float-slow absolute bottom-0 right-2">
        <FoodVisual foodId="rice" />
      </div>
    </div>
  );
}

function NutritionModal({ result, onClose, onAdd }) {
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
                <h2 className="mt-1 truncate text-xl font-black text-white">{result.foodName}</h2>
                <p className="mt-1 text-sm text-zinc-400">{adjusted.quantity}</p>
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
                  className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs transition ${mode === 'servings' ? 'bg-limeFresh text-ink' : 'text-zinc-400'}`}
                >
                  <Utensils size={14} />
                  Servings
                </button>
                <button
                  type="button"
                  onClick={() => chooseMode('weight')}
                  disabled={!canUseWeight}
                  className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs transition disabled:opacity-35 ${mode === 'weight' ? 'bg-limeFresh text-ink' : 'text-zinc-400'}`}
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
                    <span className="text-zinc-400">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="mb-2 block text-sm text-zinc-400" htmlFor="meal-type">Meal</label>
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
      <p className="mb-2 text-xs text-zinc-400">{label}</p>
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
            className="min-w-0 flex-1 bg-transparent text-center text-sm font-bold text-white outline-none disabled:cursor-not-allowed"
            aria-label={label}
          />
          <span className="ml-1 text-xs text-zinc-500">{unit}</span>
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
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-black ${tone}`}>{roundMetric(value)}</p>
      <p className="text-xs text-zinc-500">{unit}</p>
    </div>
  );
}

function MealLog({ date, items, onRemove }) {
  return (
    <section className="glass-panel rounded-[22px] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold">Meal log</h2>
        <span className="text-xs text-zinc-400">{items.length} items</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center text-sm text-zinc-400">
          No meals logged for {formatDayLabel(date)}.
        </div>
      ) : (
        <div className="space-y-4">
          {mealTypes.map((mealType) => {
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
  return (
    <div className="animate-pop grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-3 transition hover:border-white/20">
      <FoodVisual foodId={item.foodId} size="sm" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-white">{item.name}</p>
          <span className="shrink-0 rounded-lg bg-white/[0.08] px-2 py-0.5 text-[11px] text-zinc-400">{item.source}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">{item.quantity}</p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
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

function History({ logs, goals, selectedDate, setSelectedDate, onRemove }) {
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
      <section className="hero-panel rounded-[26px] border border-white/10 p-4">
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
            <p className="text-xs text-zinc-400">Selected day</p>
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
            <p className="text-xs uppercase text-zinc-500">Ideal range</p>
            <p className="mt-2 text-2xl font-black text-limeFresh">{result.range}</p>
            <p className="mt-1 text-xs text-zinc-400">Healthy BMI range</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs uppercase text-zinc-500">BMI category</p>
            <p className="mt-2 text-2xl font-black text-white">{result.category}</p>
            <p className="mt-1 text-xs text-zinc-400">BMI {result.bmi}</p>
          </div>
        </div>
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm leading-6 text-zinc-300">{result.note}</p>
        </div>
      </section>
    </div>
  );
}

function AICoaching({ user, goals, aiSettings, onApplyGoals, onToast }) {
  const [messages, setMessages] = useState([
    {
      id: uid(),
      role: 'assistant',
      answer: 'Ask me about your calories, protein, fat loss, muscle gain, workouts, or meal planning. I will use your profile when the backend AI is configured.',
      suggestedGoals: null,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendMessage(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    const userMessage = { id: uid(), role: 'user', answer: message };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/coach`, {
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
      setMessages((current) => [...current, { id: uid(), role: 'assistant', answer: data.answer, suggestedGoals: data.suggestedGoals || null }]);
    } catch (error) {
      const localGoals = estimateGoalsFromProfile(user.profile || {});
      setMessages((current) => [...current, {
        id: uid(),
        role: 'assistant',
        answer: `Backend AI is not available yet, so here is a profile-based estimate: ${localGoals.calories} kcal, ${localGoals.protein}g protein, ${localGoals.carbs}g carbs, ${localGoals.fat}g fat. Fill backend/.env to unlock full coaching answers.`,
        suggestedGoals: localGoals,
      }]);
      onToast(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="hero-panel rounded-[26px] border border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-black/25 text-limeFresh">
            <Bot size={26} />
          </div>
          <div>
            <p className="text-sm text-limeFresh">Profile-linked AI</p>
            <h2 className="text-2xl font-black">AI Coaching</h2>
          </div>
        </div>
      </section>

      <section className="glass-panel flex min-h-[54vh] flex-col rounded-[22px] p-4">
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.map((message) => (
            <div key={message.id} className={`rounded-2xl border p-3 ${message.role === 'user' ? 'ml-8 border-limeFresh/40 bg-limeFresh/10' : 'mr-8 border-white/10 bg-black/25'}`}>
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">{message.answer}</p>
              {message.suggestedGoals && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <MiniMetric label="Kcal" value={message.suggestedGoals.calories || '-'} />
                    <MiniMetric label="Protein" value={`${message.suggestedGoals.protein || '-'}g`} />
                    <MiniMetric label="Carbs" value={`${message.suggestedGoals.carbs || '-'}g`} />
                  </div>
                  <button
                    type="button"
                    onClick={() => onApplyGoals(message.suggestedGoals)}
                    className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-limeFresh px-3 text-sm font-bold text-ink"
                  >
                    <Target size={16} />
                    Add to my goal
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-w-0 flex-1 rounded-2xl border-none bg-white/[0.05] px-4 text-sm text-white outline-none transition focus:bg-white/[0.08]"
            placeholder="Ask AI Coach..."
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-limeFresh text-ink disabled:opacity-60"
            aria-label="Send"
          >
            {loading ? <RefreshCw className="animate-spin" size={19} /> : <Send size={19} />}
          </button>
        </form>
      </section>
    </div>
  );
}

function CameraScan({ aiSettings, onResult, onToast }) {
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
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/vision-nutrition`, {
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
      <section className="hero-panel rounded-[26px] border border-white/10 p-4">
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
              <button type="button" onClick={clearScan} className="absolute right-3 top-3 rounded-full bg-white/10 p-1.5 text-zinc-400 hover:text-white">
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
          {uploadedImage ? (
            <button type="button" onClick={clearScan} disabled={isScanning} className="h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-bold text-zinc-200 disabled:opacity-50">
              Clear Image
            </button>
          ) : (
            <button type="button" onClick={scanFrame} disabled={!active || isScanning} className="h-11 rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-bold text-zinc-200 disabled:opacity-50">
              {isScanning ? 'Scanning...' : 'Capture Now'}
            </button>
          )}
          <button type="button" onClick={() => scanResult && onResult(scanResult)} disabled={!scanResult} className="h-11 rounded-xl border border-limeFresh px-3 text-sm font-bold text-limeFresh disabled:opacity-50">
            Log Result
          </button>
        </div>
        <div className="border-t border-white/10 px-3 py-2 text-xs text-zinc-400">
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

function ProfilePanel({ user, goals, aiSettings, onSaveGoals, onSaveAi, onSaveProfile }) {
  const [goalDraft, setGoalDraft] = useState(goals);
  const [settingsDraft, setSettingsDraft] = useState(aiSettings);
  const [profileDraft, setProfileDraft] = useState(user.profile);

  useEffect(() => setGoalDraft(goals), [goals]);
  useEffect(() => setSettingsDraft(aiSettings), [aiSettings]);
  useEffect(() => setProfileDraft(user.profile), [user.profile]);

  function updateGoal(key, value) {
    setGoalDraft((current) => ({ ...current, [key]: value }));
  }

  function updateSetting(key, value) {
    setSettingsDraft((current) => ({ ...current, [key]: value }));
  }

  function updateProfile(key, value) {
    setProfileDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-4">
      <section className="hero-panel rounded-[26px] border border-white/10 p-4">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div>
            <p className="text-sm text-limeFresh">Member profile</p>
            <h2 className="text-xl font-black">{user.name}</h2>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <HeroChip label="Height" value={formatHeight(profileDraft)} />
          <HeroChip label="Weight" value={`${profileDraft.weightKg}kg`} />
          <HeroChip label="Target" value={`${profileDraft.desiredWeightKg}kg`} />
        </div>
      </section>

      <section className="glass-panel rounded-[22px] p-4">
        <div className="mb-4 flex items-center gap-2">
          <User className="text-limeFresh" size={19} />
          <h2 className="text-lg font-black">Body profile</h2>
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
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-limeFresh px-4 font-bold text-ink"
        >
          <Save size={19} />
          Save profile
        </button>
      </section>

      <section className="glass-panel rounded-[22px] p-4">
        <div className="mb-4 flex items-center gap-2">
          <Target className="text-limeFresh" size={19} />
          <h2 className="text-lg font-black">Daily goals</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <GoalInput label="Calories" value={goalDraft.calories} unit="kcal" onChange={(value) => updateGoal('calories', value)} />
          <GoalInput label="Protein" value={goalDraft.protein} unit="g" onChange={(value) => updateGoal('protein', value)} />
          <GoalInput label="Carbs" value={goalDraft.carbs} unit="g" onChange={(value) => updateGoal('carbs', value)} />
          <GoalInput label="Fat" value={goalDraft.fat} unit="g" onChange={(value) => updateGoal('fat', value)} />
          <GoalInput label="Fiber" value={goalDraft.fiber} unit="g" onChange={(value) => updateGoal('fiber', value)} />
          <GoalInput label="Sodium" value={goalDraft.sodium} unit="mg" onChange={(value) => updateGoal('sodium', value)} />
        </div>
        <button
          type="button"
          onClick={() => onSaveGoals(goalDraft)}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-limeFresh px-4 font-bold text-ink"
        >
          <Save size={19} />
          Save goals
        </button>
      </section>

      <section className="glass-panel rounded-[22px] p-4">
        <div className="mb-4 flex items-center gap-2">
          <Settings className="text-aqua" size={19} />
          <h2 className="text-lg font-black">AI provider</h2>
        </div>

        <SelectInput label="Provider" value={settingsDraft.provider} onChange={(value) => updateSetting('provider', value)} options={[
          ['auto', 'Auto from backend'],
          ['offline', 'Offline estimates'],
          ['gemini', 'Google Gemini'],
          ['cloudflare', 'Cloudflare Workers AI'],
          ['openrouter', 'OpenRouter free model'],
        ]} />

        <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-xs leading-5 text-zinc-400">
          AI keys are loaded from <span className="font-semibold text-zinc-200">backend/.env</span>. Known quick-list foods are answered locally first, and repeated AI results are cached by the backend to protect credits.
        </p>

        <button
          type="button"
          onClick={() => onSaveAi(settingsDraft)}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-limeFresh bg-transparent px-4 font-bold text-limeFresh"
        >
          <Save size={19} />
          Save AI settings
        </button>
      </section>
    </div>
  );
}

function LogoMark({ size = 'md', animated = false }) {
  const sizeClass = size === 'xl' ? 'h-32 w-32' : size === 'sm' ? 'h-11 w-11' : 'h-16 w-16';

  return (
    <div className={`${sizeClass} ${animated ? 'logo-pulse' : ''} shrink-0`} aria-hidden="true">
      <svg viewBox="0 0 256 256" className="h-full w-full">
        <defs>
          <linearGradient id="logoRing" x1="42" y1="28" x2="216" y2="224" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#00F0FF" />
            <stop offset="0.45" stopColor="#3ee681" />
            <stop offset="1" stopColor="#4dd5c4" />
          </linearGradient>
          <linearGradient id="logoCore" x1="76" y1="60" x2="180" y2="196" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#fff8d7" />
            <stop offset="0.42" stopColor="#00F0FF" />
            <stop offset="1" stopColor="#22d3b6" />
          </linearGradient>
        </defs>
        <rect width="256" height="256" rx="56" fill="#06100d" />
        <path d="M52 130c0-50.8 36.8-91.5 86-91.5 29.6 0 54 13.2 68.3 33.8" fill="none" stroke="url(#logoRing)" strokeWidth="18" strokeLinecap="round" opacity="0.95" />
        <path d="M204 126c0 50.8-36.8 91.5-86 91.5-29.6 0-54-13.2-68.3-33.8" fill="none" stroke="url(#logoRing)" strokeWidth="18" strokeLinecap="round" opacity="0.95" />
        <path d="M154.8 82.7c-18.9-13-55.1-9.5-59.7 15.9-6.5 35.8 72.4 26.8 65.4 63.7-5.5 28.7-52.7 31.5-76.3 12.1" fill="none" stroke="url(#logoCore)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M171 61.5c22.9 1.9 37.5 17.7 40.8 41.9-24.8-1.1-40.5-16.4-40.8-41.9Z" fill="#3ee681" />
        <path d="M74 195.5c-19.9-4.4-32.3-19.3-34.4-40.3 21.9 2.4 35.6 17.1 34.4 40.3Z" fill="#f0b849" />
        <circle cx="128" cy="128" r="40" fill="#0d1a16" opacity="0.88" />
        <path d="M104 134c9.1 12.3 27.6 18.4 47.4 4.1" fill="none" stroke="#b7f34a" strokeWidth="8" strokeLinecap="round" />
        <circle cx="104" cy="112" r="7" fill="#fff8d7" />
        <circle cx="151" cy="112" r="7" fill="#fff8d7" />
      </svg>
    </div>
  );
}

function FoodVisual({ foodId, size = 'md' }) {
  const visual = getFoodVisual(foodId);
  const sizeClass = size === 'sm' ? 'h-12 w-12' : size === 'lg' ? 'h-28 w-28' : 'h-16 w-16';

  return (
    <div
      className={`${sizeClass} shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-[0_12px_28px_rgba(0,0,0,0.25)]`}
      style={{ background: `linear-gradient(135deg, ${visual.bg}, #06100d)` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <FoodShape visual={visual} />
      </svg>
    </div>
  );
}

function FoodShape({ visual }) {
  const { type, plate, fill, accent } = visual;
  const shadow = 'rgba(0,0,0,0.22)';

  if (type === 'egg') {
    return (
      <g>
        <ellipse cx="52" cy="74" rx="33" ry="10" fill={shadow} />
        <ellipse cx="40" cy="50" rx="20" ry="27" fill={plate} />
        <ellipse cx="60" cy="50" rx="20" ry="27" fill={fill} />
        <circle cx="44" cy="52" r="8" fill={accent} />
        <circle cx="62" cy="49" r="8" fill={accent} />
      </g>
    );
  }

  if (type === 'banana') {
    return (
      <g>
        <ellipse cx="52" cy="75" rx="33" ry="10" fill={shadow} />
        <path d="M22 50c20 28 48 29 60 1-16 12-37 9-55-14-4 4-6 8-5 13Z" fill={fill} />
        <path d="M23 47c17 19 43 24 61 6" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      </g>
    );
  }

  if (type === 'flatbread') {
    return (
      <g>
        <ellipse cx="50" cy="73" rx="34" ry="10" fill={shadow} />
        <ellipse cx="50" cy="50" rx="34" ry="26" fill={fill} />
        <circle cx="38" cy="43" r="5" fill={accent} opacity="0.65" />
        <circle cx="58" cy="56" r="6" fill={accent} opacity="0.55" />
        <circle cx="63" cy="41" r="4" fill={plate} opacity="0.5" />
      </g>
    );
  }

  if (type === 'protein') {
    return (
      <g>
        <ellipse cx="50" cy="74" rx="34" ry="10" fill={shadow} />
        <path d="M25 54c5-18 26-25 45-17 15 6 15 22 1 31-17 12-55 7-46-14Z" fill={fill} />
        <path d="M33 52c15 8 30 9 48 2" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
        <circle cx="72" cy="40" r="5" fill={plate} opacity="0.65" />
      </g>
    );
  }

  if (type === 'burger') {
    return (
      <g>
        <ellipse cx="50" cy="76" rx="34" ry="10" fill={shadow} />
        <path d="M23 43c6-17 48-20 58 0Z" fill="#d99447" />
        <rect x="23" y="49" width="58" height="11" rx="5" fill={accent} />
        <rect x="25" y="58" width="54" height="13" rx="6" fill={fill} />
        <circle cx="38" cy="38" r="2" fill={plate} />
        <circle cx="52" cy="36" r="2" fill={plate} />
        <circle cx="65" cy="39" r="2" fill={plate} />
      </g>
    );
  }

  if (type === 'cubes') {
    return (
      <g>
        <ellipse cx="50" cy="76" rx="34" ry="10" fill={shadow} />
        <rect x="24" y="39" width="24" height="22" rx="5" fill={fill} />
        <rect x="51" y="34" width="24" height="22" rx="5" fill={plate} />
        <rect x="44" y="58" width="24" height="22" rx="5" fill={fill} />
        <circle cx="34" cy="34" r="4" fill={accent} />
        <circle cx="72" cy="65" r="4" fill={accent} />
      </g>
    );
  }

  if (type === 'drink') {
    return (
      <g>
        <ellipse cx="50" cy="78" rx="23" ry="8" fill={shadow} />
        <path d="M33 23h34l-5 58H38Z" fill={plate} />
        <path d="M37 48h26l-3 29H40Z" fill={fill} />
        <path d="M35 30h30" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      </g>
    );
  }

  if (type === 'fruit') {
    return (
      <g>
        <ellipse cx="51" cy="76" rx="29" ry="9" fill={shadow} />
        <path d="M49 34c12-12 31 0 27 20-3 18-16 31-28 26-15 6-28-10-29-26-1-20 19-31 30-20Z" fill={fill} />
        <path d="M50 35c0-10 7-15 15-16" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      </g>
    );
  }

  if (type === 'nuts') {
    return (
      <g>
        <ellipse cx="50" cy="75" rx="34" ry="10" fill={shadow} />
        {[28, 42, 56, 70, 36, 52, 64].map((x, index) => (
          <ellipse key={x} cx={x} cy={index < 4 ? 48 : 61} rx="9" ry="13" fill={index % 2 ? fill : accent} transform={`rotate(${index * 22} ${x} ${index < 4 ? 48 : 61})`} />
        ))}
      </g>
    );
  }

  if (type === 'leaf') {
    return (
      <g>
        <ellipse cx="50" cy="76" rx="34" ry="10" fill={shadow} />
        <path d="M24 60c12-28 37-30 51-11-24 1-33 12-51 11Z" fill={fill} />
        <path d="M37 42c14-19 35-16 43 3-22-1-30 7-43-3Z" fill={accent} />
        <path d="M30 58c17-8 35-12 54-10" stroke={plate} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
      </g>
    );
  }

  if (type === 'jar') {
    return (
      <g>
        <ellipse cx="50" cy="78" rx="27" ry="8" fill={shadow} />
        <rect x="31" y="26" width="38" height="13" rx="4" fill={accent} />
        <rect x="28" y="37" width="44" height="43" rx="11" fill={fill} />
        <rect x="35" y="51" width="30" height="14" rx="7" fill={plate} opacity="0.7" />
      </g>
    );
  }

  return (
    <g>
      <ellipse cx="50" cy="76" rx="34" ry="10" fill={shadow} />
      <path d="M19 48h62c-2 24-14 36-31 36S21 72 19 48Z" fill={plate} />
      <ellipse cx="50" cy="48" rx="32" ry="18" fill={fill} />
      <circle cx="38" cy="43" r="4" fill={accent} />
      <circle cx="53" cy="51" r="4" fill={accent} opacity="0.75" />
      <circle cx="64" cy="42" r="4" fill={accent} opacity="0.65" />
    </g>
  );
}

function HeroChip({ label, value }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl bg-white/[0.03] py-3">
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="mt-1 text-sm font-medium text-white">{value}</span>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
      <p className="text-base font-black text-white">{value}</p>
      <p className="text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

function IconInput({ icon: Icon, label, value, onChange, type = 'text', unit, required = false, placeholder }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-400">{label}</span>
      <span className="flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 transition focus-within:border-limeFresh">
        <Icon size={17} className="shrink-0 text-limeFresh" />
        <input
          type={type}
          value={value ?? ''}
          required={required}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
        />
        {unit && <span className="text-xs text-zinc-500">{unit}</span>}
      </span>
    </label>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-zinc-400">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-semibold text-white outline-none transition focus:border-limeFresh"
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
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Ruler size={17} className="text-limeFresh" />
          <span className="text-sm font-semibold text-zinc-300">Height</span>
        </div>
        <div className="grid grid-cols-2 rounded-lg border border-white/10 bg-black/25 p-1 text-xs">
          <button
            type="button"
            onClick={() => setUnit('cm')}
            className={`h-8 rounded-md px-3 font-semibold transition ${unit === 'cm' ? 'bg-limeFresh text-ink' : 'text-zinc-400'}`}
          >
            cm
          </button>
          <button
            type="button"
            onClick={() => setUnit('ft')}
            className={`h-8 rounded-md px-3 font-semibold transition ${unit === 'ft' ? 'bg-limeFresh text-ink' : 'text-zinc-400'}`}
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
    <label className="rounded-xl border border-white/10 bg-black/25 p-3">
      <span className="block text-xs text-zinc-400">{label}</span>
      <span className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-lg font-black text-white outline-none"
        />
        <span className="text-xs text-zinc-500">{unit}</span>
      </span>
    </label>
  );
}

function BottomNav({ activeTab, setActiveTab }) {
  return (
    <nav className="absolute bottom-6 left-4 right-4 z-30 rounded-[32px] border border-white/5 bg-[#0a1411]/80 px-2 py-2 shadow-2xl backdrop-blur-2xl">
      <div className="flex justify-between gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex h-12 flex-1 flex-col items-center justify-center gap-1 rounded-[20px] text-[10px] font-medium transition active:scale-95 ${active ? 'bg-white/10 text-limeFresh' : 'text-zinc-500 hover:text-zinc-300'}`}
              aria-label={item.label}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span className={active ? 'block' : 'hidden'}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Toast({ message }) {
  return (
    <div className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-white/10 bg-[#0b1713] px-4 py-3 text-sm text-zinc-100 shadow-[0_20px_70px_rgba(0,0,0,0.55)]">
      {message}
    </div>
  );
}

function calculateIdealWeight(profile) {
  const heightCm = getHeightCm(profile);
  const heightM = heightCm / 100;
  const heightInches = heightCm / 2.54;
  const minWeight = Math.round(18.5 * heightM * heightM);
  const maxWeight = Math.round(24.9 * heightM * heightM);
  const bmi = roundMetric(Number(profile.weightKg || 70) / (heightM * heightM), 1);
  const referenceWeight = profile.gender === 'female'
    ? 45.5 + 2.3 * Math.max(0, heightInches - 60)
    : profile.gender === 'male'
      ? 50 + 2.3 * Math.max(0, heightInches - 60)
      : (47.75 + 2.3 * Math.max(0, heightInches - 60));

  return {
    range: `${minWeight}-${maxWeight} kg`,
    reference: Math.round(referenceWeight),
    bmi,
    category: bmiCategory(bmi),
    note: `For ${formatHeight(profile)}, a healthy BMI range is roughly ${minWeight}-${maxWeight} kg. A practical target can sit near ${Math.round(referenceWeight)} kg, then be adjusted for muscle, frame size, and performance goals.`,
  };
}

function bmiCategory(bmi) {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

function captureVideoFrame(video, canvas) {
  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.62);
}

function normalizeVisionResult(data) {
  const nutrition = data.nutrition || data;
  return {
    foodName: String(data.foodName || data.detectedItems?.join(', ') || 'Visible food'),
    quantity: String(data.quantity || 'visible portion'),
    nutrition,
    baseNutrition: nutrition,
    baseQuantity: String(data.quantity || 'visible portion'),
    baseServingGrams: Number(data.baseServingGrams || data.servingGrams || data.grams || 0) > 0 ? Number(data.baseServingGrams || data.servingGrams || data.grams) : null,
    source: data.source || 'Camera AI scan',
    confidence: data.confidence || 'AI',
    funFact: data.funFact || 'Food recognition works best with a clear, steady view.',
    notes: data.notes || 'Camera vision estimate.',
  };
}

function getAgeFromDob(dob) {
  if (!dob) return '';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return Math.max(1, age);
}

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

function estimateGoalsFromProfile(profile) {
  const weight = Number(profile.weightKg || 70);
  const height = getHeightCm(profile);
  const age = Number(profile.age || getAgeFromDob(profile.dob) || 25);
  const genderOffset = profile.gender === 'female' ? -161 : profile.gender === 'male' ? 5 : -80;
  const bmr = 10 * weight + 6.25 * height - 5 * age + genderOffset;
  const activity = activityMultipliers[profile.activity] || activityMultipliers.moderate;
  const goalOffset = profile.goal === 'lose' ? -420 : profile.goal === 'gain' ? 320 : 0;
  const calories = Math.round(Math.max(1200, bmr * activity + goalOffset));
  const protein = Math.round(Math.max(60, weight * (profile.goal === 'gain' ? 1.9 : 1.6)));
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return {
    calories,
    protein,
    carbs: Math.max(80, carbs),
    fat: Math.max(35, fat),
    fiber: 30,
    sugar: 50,
    sodium: 2300,
    water: Math.max(1.5, Math.round((weight * 35) / 100) / 10),
  };
}

function playIntroMusic() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    if (context.state === 'suspended') context.resume();

    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.05);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 2.25);
    master.connect(context.destination);

    const melody = [
      [392, 0, 0.16],
      [494, 0.16, 0.16],
      [587, 0.32, 0.18],
      [784, 0.52, 0.2],
      [659, 0.78, 0.16],
      [784, 0.94, 0.16],
      [988, 1.1, 0.32],
      [784, 1.48, 0.18],
      [659, 1.68, 0.18],
      [587, 1.88, 0.24],
    ];
    const bass = [
      [98, 0, 0.28],
      [123.47, 0.52, 0.28],
      [146.83, 1.04, 0.28],
      [196, 1.56, 0.34],
    ];
    const chords = [
      [[392, 494, 587], 0, 0.38],
      [[494, 622.25, 784], 0.78, 0.42],
      [[392, 587, 784], 1.45, 0.5],
    ];

    melody.forEach(([frequency, offset, duration], index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index % 3 === 0 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + offset);
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + offset + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + duration + 0.04);
    });

    bass.forEach(([frequency, offset, duration]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, context.currentTime + offset);
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + duration + 0.04);
    });

    chords.forEach(([frequencies, offset, duration]) => {
      frequencies.forEach((frequency) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, context.currentTime + offset);
        gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
        gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + offset + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + duration);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(context.currentTime + offset);
        oscillator.stop(context.currentTime + offset + duration + 0.05);
      });
    });

    [0.26, 0.66, 1.02, 1.38, 1.78].forEach((offset) => {
      const buffer = context.createBuffer(1, context.sampleRate * 0.05, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.setValueAtTime(0.035, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.05);
      source.connect(gain);
      gain.connect(master);
      source.start(context.currentTime + offset);
    });

    window.setTimeout(() => context.close(), 2600);
  } catch {
    // Browsers can block startup audio until the first user gesture.
  }
}
