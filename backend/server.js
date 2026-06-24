import crypto from 'node:crypto';
import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { estimateNutrition, normalizeNutrition } from '../src/lib/nutritionMath.js';

// New API Routers
import authRouter from './routes/auth.js';
import dataRouter from './routes/data.js';
import groupsRouter from './routes/groups.js';

dotenv.config({ path: new URL('.env', import.meta.url) });

const app = express();
const port = Number(process.env.PORT || 8787);
const cache = new Map();
const cacheVersion = 'v4';

const nutritionPrompt = [
  'You are Sistum Tracker nutrition AI.',
  'Return only valid JSON with no markdown.',
  'Estimate total nutrition for the exact food and quantity.',
  'Use keys: foodName, quantity, calories, protein, carbs, fat, fiber, sugar, sodium, vitamins, notes, servingGrams.',
  'Numbers must be totals. protein, carbs, fat, fiber, sugar are grams. sodium is mg.',
].join(' ');

const coachPrompt = [
  'You are Sistum Coach, a world-class personal trainer, nutritionist, and wellness coach inside a calorie tracking app.',
  'You must answer WHATEVER the user asks you. Whether it is about diet, workouts, lifestyle, general fitness advice, or just a casual conversation, you must provide a helpful and engaging response.',
  'Speak directly to the user as their dedicated, highly knowledgeable, and friendly trainer. Be conversational, interactive, and highly supportive.',
  'If the user asks a brief question or makes a casual comment, give a natural, engaging, and appropriately sized response. Do not force long structured plans unless they explicitly ask for a detailed plan or routine.',
  'Use the provided profile and goals to personalize your advice when relevant (e.g. age, weight, target goal).',
  'When the user DOES ask for detailed diet, meals, or workout plans, provide specific, actionable steps with exact examples (foods, quantities, sets/reps).',
  'Keep the tone energetic, realistic, and highly motivating. Avoid sounding like a generic robot.',
  'Do not diagnose medical conditions, but provide excellent general health and wellness coaching.',
  'When the user explicitly asks for exact nutrition numbers, macros, or calorie goals to hit, calculate realistic targets based on their profile and return them in the suggestedGoals object.',
  'Return valid JSON only. Use this shape: {"answer":"...","suggestedGoals":null}.',
  'suggestedGoals may be null or an object containing calories, protein, carbs, fat, fiber, sugar, sodium.',
].join(' ');

const visionPrompt = [
  'You are Sistum Tracker food vision AI.',
  'Look at the image and estimate visible food items and total nutrition.',
  'This is for a rough estimation only, you must provide your best guess even if uncertain.',
  'Return valid JSON only with keys: detectedItems, foodName, quantity, calories, protein, carbs, fat, fiber, sugar, sodium, vitamins, funFact, confidence, servingGrams.',
  'If uncertain, say so in confidence and notes. Do not invent exactness, but you MUST return the JSON object.'
].join(' ');

app.use(express.json({ limit: '7mb' }));

// CORS for cross-origin deployment (Netlify frontend → Render backend)
app.use((_request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }
  next();
});

// MongoDB Connection
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => console.error('❌ MongoDB connection error:', err.message));
} else {
  console.warn('⚠️ MONGODB_URI not set. Auth and data sync features will fail until configured.');
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Mount MongoDB Auth Routes (Public)
app.use('/api/auth', authRouter);

app.post('/api/nutrition', async (request, response) => {
  const query = String(request.body?.query || '').trim();
  const provider = normalizeProvider(request.body?.provider);

  if (!query) {
    response.status(400).json({ error: 'Food query is required.' });
    return;
  }

  const local = estimateNutrition(query);
  if (local.confidence !== 'low') {
    response.json({ ...local, source: 'Local database' });
    return;
  }

  const key = cacheKey('nutrition', provider, query);
  const cached = getCached(key);
  if (cached) {
    response.json({ ...cached, source: `${cached.source} cache`, cached: true });
    return;
  }

  try {
    const result = await callBestTextProvider(`${nutritionPrompt}\nFood query: ${query}`, provider, 'nutrition');
    const normalized = normalizeAiNutrition(result, 'Backend AI');
    setCached(key, normalized);
    response.json(normalized);
  } catch (error) {
    response.status(503).json({ error: error.message, fallback: local });
  }
});

app.post('/api/coach', async (request, response) => {
  const message = String(request.body?.message || '').trim();
  const provider = normalizeProvider(request.body?.provider);
  const profile = request.body?.profile || {};
  const goals = request.body?.goals || {};

  if (!message) {
    response.status(400).json({ error: 'Message is required.' });
    return;
  }

  const key = cacheKey('coach', provider, JSON.stringify({ message, profile, goals }));
  const cached = getCached(key);
  if (cached) {
    response.json({ ...cached, cached: true });
    return;
  }

  try {
    const payload = [
      coachPrompt,
      `User profile: ${JSON.stringify(profile)}`,
      `Current goals: ${JSON.stringify(goals)}`,
      `Question: ${message}`,
    ].join('\n');
    const result = await callBestTextProvider(payload, provider, 'coach');
    const parsed = parseJsonValue(result);
    const currentGoals = sanitizeGoals(goals);
    const suggestedGoals = sanitizeGoals(parsed.suggestedGoals) || (isGoalQuestion(message) ? currentGoals || estimateGoalsFromProfile(profile) : null);
    const answer = {
      answer: buildCoachAnswer(message, profile, parsed.answer, suggestedGoals),
      source: 'Sistum AI Coach',
    };
    answer.suggestedGoals = suggestedGoals;
    setCached(key, answer);
    response.json(answer);
  } catch (error) {
    const currentGoals = sanitizeGoals(goals);
    const suggestedGoals = isGoalQuestion(message) ? currentGoals || estimateGoalsFromProfile(profile) : null;
    response.json({
      answer: buildCoachFallback(message, profile, goals, suggestedGoals),
      suggestedGoals,
      source: 'Profile coach fallback',
      warning: error.message,
    });
  }
});

app.post('/api/vision-nutrition', async (request, response) => {
  const image = String(request.body?.image || '');
  const provider = normalizeProvider(request.body?.provider);

  if (!image.startsWith('data:image/')) {
    response.status(400).json({ error: 'Camera image is required.' });
    return;
  }

  const key = cacheKey('vision', provider, crypto.createHash('sha256').update(image).digest('hex'));
  const cached = getCached(key);
  if (cached) {
    response.json({ ...cached, source: `${cached.source} cache`, cached: true });
    return;
  }

  try {
    const result = await callBestVisionProvider(image, provider);
    const parsed = parseJsonValue(result);
    const nutrition = normalizeNutrition(parsed);
    const normalized = {
      foodName: String(parsed.foodName || parsed.detectedItems?.join(', ') || 'Visible food'),
      quantity: String(parsed.quantity || 'visible portion'),
      detectedItems: Array.isArray(parsed.detectedItems) ? parsed.detectedItems : [],
      nutrition,
      baseNutrition: nutrition,
      baseQuantity: String(parsed.quantity || 'visible portion'),
      baseServingGrams: Number(parsed.servingGrams || parsed.grams || 0) > 0 ? Number(parsed.servingGrams || parsed.grams) : null,
      source: 'Camera AI scan',
      confidence: parsed.confidence || 'ai',
      funFact: String(parsed.funFact || 'Small food choices add up fast.'),
      notes: String(parsed.notes || 'Vision estimate from camera frame.'),
    };
    setCached(key, normalized);
    response.json(normalized);
  } catch (error) {
    response.status(503).json({ error: error.message });
  }
});

// Mount Authenticated MongoDB Data Routes
app.use('/api/user', dataRouter); // Profile, goals, ai-settings
app.use('/api/groups', groupsRouter); // Social groups
app.use('/api', dataRouter);      // Logs and meals

if (process.env.VERCEL !== '1') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Sistum Tracker backend listening at http://0.0.0.0:${port}`);
  });
}

export default app;

function normalizeProvider(provider) {
  return String(provider || process.env.AI_PROVIDER || 'auto').toLowerCase();
}

function cacheKey(type, provider, value) {
  return `${cacheVersion}:${type}:${provider}:${value.toLowerCase ? value.toLowerCase().replace(/\s+/g, ' ') : value}`;
}

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return item.value;
}

function setCached(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + getCacheTtlMs() });
}

function getCacheTtlMs() {
  const hours = Number(process.env.CACHE_TTL_HOURS || 168);
  return Math.max(1, hours) * 60 * 60 * 1000;
}

function providerOrder(provider, mode) {
  const defaults = mode === 'coach'
    ? ['gemini', 'openrouter', 'cloudflare']
    : mode === 'vision'
      ? ['gemini', 'cloudflare', 'openrouter']
      : ['cloudflare', 'gemini', 'openrouter'];
  if (provider === 'auto' || provider === 'offline') return defaults;
  return [provider, ...defaults.filter((item) => item !== provider)];
}

async function callBestTextProvider(prompt, provider, mode) {
  const errors = [];
  const maxTokens = mode === 'coach' ? 1400 : 620;
  for (const candidate of providerOrder(provider, mode)) {
    try {
      if (candidate === 'cloudflare' && process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) return await callCloudflare(prompt, maxTokens);
      if (candidate === 'gemini' && process.env.GEMINI_API_KEY) return await callGemini(prompt, maxTokens);
      if (candidate === 'openrouter' && process.env.OPENROUTER_API_KEY) return await callOpenRouter(prompt, maxTokens);
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(errors.join(' | ') || 'No backend AI provider is configured. Fill backend/.env.');
}

async function callBestVisionProvider(image, provider) {
  const errors = [];
  for (const candidate of providerOrder(provider, 'vision')) {
    try {
      if (candidate === 'gemini' && process.env.GEMINI_API_KEY) return await callGeminiVision(image);
      if (candidate === 'cloudflare' && process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) return await callCloudflareVision(image);
      if (candidate === 'openrouter' && process.env.OPENROUTER_API_KEY) return await callOpenRouterVision(image);
    } catch (error) {
      errors.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(errors.join(' | ') || 'Vision AI needs Gemini, Cloudflare, or a vision-capable OpenRouter model in backend/.env.');
}

async function callGemini(prompt, maxTokens = 620, retries = 2) {
  const model = encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-2.0-flash');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: maxTokens },
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      signal: aiTimeoutSignal(),
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (response.status === 429 && attempt < retries) {
      const retryAfter = parseRetryAfter(response);
      console.warn(`gemini rate-limited, retrying in ${retryAfter}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(retryAfter);
      continue;
    }

    const data = await readJsonResponse(response);
    return requireProviderText(data?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n'), 'gemini');
  }
}

async function callGeminiVision(image, retries = 2) {
  const model = encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-2.0-flash');
  const { mimeType, base64 } = splitDataUrl(image);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const body = JSON.stringify({
    contents: [{
      role: 'user',
      parts: [
        { text: visionPrompt },
        { inlineData: { mimeType, data: base64 } },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 620 },
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      signal: aiTimeoutSignal(),
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (response.status === 429 && attempt < retries) {
      const retryAfter = parseRetryAfter(response);
      console.warn(`gemini vision rate-limited, retrying in ${retryAfter}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(retryAfter);
      continue;
    }

    const data = await readJsonResponse(response);
    return requireProviderText(data?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n'), 'gemini vision');
  }
}

async function callCloudflare(prompt, maxTokens = 620) {
  const accountId = encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID);
  const modelPath = (process.env.CLOUDFLARE_TEXT_MODEL || process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.1-8b-instruct').replace(/^\/+/, '');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelPath}`, {
    method: 'POST',
    signal: aiTimeoutSignal(),
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: maxTokens,
    }),
  });
  const data = await readJsonResponse(response);
  const result = data?.result?.response || data?.result?.text || data?.result?.output || data?.result;
  if (!result) throw new Error('cloudflare returned an empty response');
  return result;
}

async function callCloudflareVision(image) {
  const accountId = encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID);
  const visionModel = (process.env.CLOUDFLARE_VISION_MODEL || process.env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.2-11b-vision-instruct').replace(/^\/+/, '');
  const { base64 } = splitDataUrl(image);

  // Cloudflare vision models require the direct /run/ endpoint with prompt and image (byte array)
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${visionModel}`, {
    method: 'POST',
    signal: aiTimeoutSignal(25000),
    headers: {
      Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt: visionPrompt + '\n\nOutput only a raw JSON object, starting with {',
      image: Array.from(Buffer.from(base64, 'base64')),
      temperature: 0.1,
      max_tokens: 620,
    }),
  });
  const data = await readJsonResponse(response);
  const result = data?.result?.response || data?.result?.text || data?.result?.output || data?.result;
  if (!result) throw new Error('cloudflare vision returned an empty response');
  return result;
}

async function callOpenRouter(prompt, maxTokens = 620) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: aiTimeoutSignal(),
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'Sistum Tracker',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openrouter/free',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  });
  const data = await readJsonResponse(response);
  return requireProviderText(data?.choices?.[0]?.message?.content, 'openrouter');
}

async function callOpenRouterVision(image) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: aiTimeoutSignal(),
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Title': 'Sistum Tracker',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-nano-12b-v2-vl:free',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: visionPrompt },
          { type: 'image_url', image_url: { url: image } },
        ],
      }],
      temperature: 0.1,
      max_tokens: 620,
      response_format: { type: 'json_object' },
    }),
  });
  const data = await readJsonResponse(response);
  return requireProviderText(data?.choices?.[0]?.message?.content, 'openrouter vision');
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: { message: text } };
  }
  if (!response.ok) throw new Error(data?.error?.message || data?.errors?.[0]?.message || `HTTP ${response.status}`);
  return data;
}

function requireProviderText(value, provider) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${provider} returned an empty response`);
  return text;
}

function aiTimeoutSignal(overrideMs) {
  const timeoutMs = overrideMs || Math.max(3000, Number(process.env.AI_TIMEOUT_MS || 15000));
  return AbortSignal.timeout(timeoutMs);
}

function parseRetryAfter(response) {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 30000);
  }
  // Default: 5 seconds if no retry-after header
  return 5000;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAiNutrition(value, source) {
  const parsed = parseJsonValue(value);
  const nutrition = normalizeNutrition(parsed);
  return {
    foodName: String(parsed.foodName || parsed.food || 'Food'),
    quantity: String(parsed.quantity || '1 serving'),
    nutrition,
    baseNutrition: nutrition,
    baseQuantity: String(parsed.quantity || '1 serving'),
    baseServingGrams: Number(parsed.servingGrams || parsed.grams || 0) > 0 ? Number(parsed.servingGrams || parsed.grams) : null,
    source,
    confidence: 'ai',
    notes: String(parsed.notes || 'AI-generated estimate.'),
  };
}

function parseJsonValue(value) {
  if (value && typeof value === 'object') return value;
  const cleaned = String(value || '').replace(/```json|```/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const json = extractFirstJsonObject(cleaned);
    if (json) {
      try { return JSON.parse(json); } catch (err2) {}
    }
    
    // Robust fallback for missing commas/quotes (common LLM failure)
    const extractNum = (regex) => {
      const match = cleaned.match(regex);
      return match ? Number(match[1]) : 0;
    };
    
    const calories = extractNum(/['"]?calories['"]?\s*[:]\s*(\d+)/i);
    const protein = extractNum(/['"]?protein['"]?\s*[:]\s*(\d+)/i);
    const carbs = extractNum(/['"]?carbs['"]?\s*[:]\s*(\d+)/i);
    const fat = extractNum(/['"]?fat['"]?\s*[:]\s*(\d+)/i);
    
    if (calories > 0 || protein > 0 || carbs > 0 || fat > 0) {
      const foodMatch = cleaned.match(/['"]?foodName['"]?\s*[:]\s*['"]([^'"]+)['"]/i);
      const qtyMatch = cleaned.match(/['"]?quantity['"]?\s*[:]\s*['"]([^'"]+)['"]/i);
      return {
        foodName: foodMatch ? foodMatch[1].trim() : 'Visible food',
        quantity: qtyMatch ? qtyMatch[1].trim() : '1 serving',
        calories, protein, carbs, fat,
        fiber: extractNum(/['"]?fiber['"]?\s*[:]\s*(\d+)/i),
        sugar: extractNum(/['"]?sugar['"]?\s*[:]\s*(\d+)/i),
        sodium: extractNum(/['"]?sodium['"]?\s*[:]\s*(\d+)/i)
      };
    }

    const rawSnippet = cleaned.length > 60 ? cleaned.substring(0, 60) + '...' : cleaned;
    throw new Error(`AI generated malformed JSON: ${error.message}. Output: ${rawSnippet}`);
  }
}

function extractFirstJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = inString;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }

  return null;
}

function sanitizeGoals(value) {
  if (!value || typeof value !== 'object') return null;
  const output = {};
  for (const key of ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium']) {
    const number = Number(value[key]);
    if (Number.isFinite(number) && number > 0) output[key] = Math.round(number);
  }
  return Object.keys(output).length ? output : null;
}

function isGoalQuestion(message) {
  return /calorie|macro|protein|carb|fat|nutrition|goal|diet|weight|cut|bulk|gain|loss|muscle|meal|food|eat/i.test(message);
}

function estimateGoalsFromProfile(profile = {}) {
  const weight = Number(profile.weightKg || 70);
  const height = Number(profile.heightCm || 170);
  const age = Number(profile.age || 25);
  const genderOffset = profile.gender === 'female' ? -161 : profile.gender === 'male' ? 5 : -80;
  const activityMultipliers = { low: 1.25, moderate: 1.45, high: 1.65, athlete: 1.85 };
  const activity = activityMultipliers[profile.activity] || activityMultipliers.moderate;
  const goalOffset = profile.goal === 'gain' ? 320 : profile.goal === 'maintain' ? 0 : -420;
  const bmr = 10 * weight + 6.25 * height - 5 * age + genderOffset;
  const calories = Math.round(Math.max(1200, bmr * activity + goalOffset));
  const protein = Math.round(Math.max(60, weight * (profile.goal === 'gain' ? 1.9 : 1.6)));
  const fat = Math.round(Math.max(35, (calories * 0.27) / 9));
  const carbs = Math.round(Math.max(80, (calories - protein * 4 - fat * 9) / 4));

  return {
    calories,
    protein,
    carbs,
    fat,
    fiber: 30,
    sugar: 50,
    sodium: 2300,
  };
}

function profileDietLabel(profile = {}) {
  return String(profile.dietPreference || profile.diet || '').toLowerCase();
}

function buildCoachAnswer(message, profile = {}, aiAnswer, suggestedGoals) {
  const answer = cleanCoachText(aiAnswer);
  const isCasual = /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|cool|great)[!.?\s]*$/i.test(message.trim());
  const tooVague = !answer
    || (!isCasual && answer.length < 80)
    || /consult.*(professional|dietitian|doctor)/i.test(answer)
    || /\bas an ai\b/i.test(answer);

  if (isFoodPlanQuestion(message) && suggestedGoals) {
    if (!tooVague && hasFoodQuantities(answer)) return answer;
    return buildFoodPlanAnswer(profile, suggestedGoals);
  }

  if (!suggestedGoals) {
    return tooVague
      ? 'Ask me for calories, macros, meal ideas, workout plans, or consistency help based on your profile.'
      : answer;
  }

  if (!tooVague) {
    if (!isGoalQuestion(message) || hasMacroTargets(answer) || hasFoodQuantities(answer)) return answer;
    return `${buildTargetLine(profile, suggestedGoals)}\n\n${answer}`;
  }

  return buildCoachFallback(message, profile, suggestedGoals, suggestedGoals);
}

function cleanCoachText(value) {
  return String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function buildTargetLine(profile = {}, goals = {}) {
  const height = profile.heightCm ? `${profile.heightCm} cm` : 'your height';
  const weight = profile.weightKg ? `${profile.weightKg} kg` : 'your current weight';
  return `Target: based on ${height}, ${weight}, ${profile.gender || 'your gender'}, age ${profile.age || 'not set'}, aim around ${goals.calories} kcal with ${goals.protein}g protein, ${goals.carbs}g carbs, and ${goals.fat}g fat.`;
}

function hasMacroTargets(answer) {
  return /(calorie|kcal)/i.test(answer) && /protein/i.test(answer) && /carb/i.test(answer) && /\bfat\b/i.test(answer);
}

function hasFoodQuantities(answer) {
  return /\b(\d+\s?(g|gram|grams|kg|ml|l|cup|cups|bowl|bowls|piece|pieces|slice|slices|roti|rotis|egg|eggs|scoop|scoops|tbsp|tsp))\b/i.test(answer);
}

function isFoodPlanQuestion(message) {
  return /what.*(eat|drink|food|product)|exact.*(eat|drink|food|product)|meal|diet|breakfast|lunch|dinner|snack|muscle|bulk|gain/i.test(message);
}

function buildFoodPlanAnswer(profile = {}, goals = {}) {
  const calories = Number(goals.calories || 0);
  const protein = Number(goals.protein || 0);
  const carbs = Number(goals.carbs || 0);
  const fat = Number(goals.fat || 0);
  const calorieText = calories ? `${calories} kcal` : 'your calorie target';
  const proteinText = protein ? `${protein}g protein` : 'high protein';
  const carbText = carbs ? `${carbs}g carbs` : 'enough carbs for training';
  const fatText = fat ? `${fat}g fat` : 'moderate fats';
  const isVegetarian = /veg|vegetarian/i.test(profileDietLabel(profile));
  const proteinOptions = isVegetarian
    ? 'paneer 150g, tofu 200g, dal 1.5 bowls, Greek yogurt or curd 250g, milk 300ml, whey 1 scoop, sprouts 1 bowl'
    : 'eggs 3 whole plus 2 whites, chicken breast 180g, fish 180g, paneer 120g, Greek yogurt or curd 250g, whey 1 scoop, milk 300ml';

  return [
    `For muscle growth, eat real foods in measured portions. Use ${calorieText}, ${proteinText}, ${carbText}, and ${fatText} as the daily target.`,
    `Best protein products to rotate: ${proteinOptions}. Pick 3 to 4 of these daily so protein is spread across the day.`,
    'Breakfast: oats 60g cooked in milk 250ml + banana 1 medium + eggs 2 whole and 2 whites. Vegetarian swap: paneer 100g or tofu 150g.',
    'Lunch: rice 1.5 bowls or 3 rotis + dal 1 bowl + chicken or fish 150-180g. Vegetarian swap: paneer or tofu 150-200g. Add salad 1 bowl and curd 150g.',
    'Pre-workout: banana 1 medium or bread 2 slices + peanut butter 1 tbsp. Drink water 400-600ml.',
    'Post-workout: whey 1 scoop in water or milk. Food-only option: curd or Greek yogurt 250g with fruit.',
    'Dinner: rice 1 bowl or 2 rotis + protein 150-180g + vegetables 1-2 bowls. Add milk 250ml before sleep if protein is still short.',
    'Simple rule for today: every meal must contain one palm-sized protein item, and your workout meal should include rice, roti, oats, banana, or potatoes.',
  ].join('\n\n');
}

function buildCoachFallback(message, profile = {}, goals = {}, suggestedGoals) {
  const activeGoals = sanitizeGoals(suggestedGoals) || sanitizeGoals(goals);
  const targetCalories = activeGoals?.calories || Number(goals.calories || 0);
  const targetProtein = activeGoals?.protein || Number(goals.protein || 0);
  const targetCarbs = activeGoals?.carbs || Number(goals.carbs || 0);
  const targetFat = activeGoals?.fat || Number(goals.fat || 0);
  const targetLine = activeGoals
    ? buildTargetLine(profile, activeGoals)
    : 'Target: save your calorie and protein goals to make this fully personalized. Until then, use a steady protein source at every meal and keep the plan repeatable.';
  const macroLine = targetCalories && targetProtein
    ? `Nutrition anchor: keep the day around ${targetCalories} kcal with ${targetProtein}g protein${targetCarbs ? `, ${targetCarbs}g carbs` : ''}${targetFat ? `, and ${targetFat}g fat` : ''}.`
    : 'Nutrition anchor: hit protein first, then adjust carbs around training and keep fats moderate.';
  const lower = String(message || '').toLowerCase();

  if (isFoodPlanQuestion(message)) return buildFoodPlanAnswer(profile, activeGoals || goals);

  if (/motivation|motivated|discipline|consistent|habit/.test(lower) && /workout|exercise|training|gym|cardio|strength/.test(lower)) {
    return [
      targetLine,
      'Why: motivation is easier when the workout has a small entry point. Your goal is to start the session, then let momentum do the rest.',
      'Plan: warm up for 5 minutes with marching, arm circles, hip hinges, and bodyweight squats. Then do 3 rounds: 12 squats, 8-12 push-ups, 12 rows or backpack rows, 10 lunges each leg, and a 30-45 second plank. Rest 60-90 seconds between rounds.',
      'Intensity: finish each set with 2 reps left in the tank. If it feels too easy, slow the lowering phase or add load. If it feels too hard, reduce reps and keep form clean.',
      'Progression: add 1-2 reps next session or add a fourth round after two easy sessions. Finish with a 10 minute walk to cool down.',
      `Today: set a 10 minute minimum. Once you complete the warm-up and first round, you have already won the habit. ${macroLine}`,
    ].join('\n\n');
  }
  if (/workout|exercise|training|gym|cardio|strength/.test(lower)) {
    return [
      targetLine,
      'Plan: do a 35-45 minute full-body session. Warm up for 5 minutes, then complete 3 rounds of squats, push-ups, rows, lunges, and planks.',
      'Sets and reps: 10-15 squats, 8-12 push-ups, 10-12 rows, 10 lunges per leg, and a 30-45 second plank. Rest 60-90 seconds, breathe through the set, and keep every rep controlled.',
      'Progression: when all rounds feel smooth, add 1-2 reps per move or use a slightly heavier backpack/dumbbell. Do not chase soreness; chase better form and a little more work over time.',
      `Recovery: walk 5-10 minutes after training, hydrate, and get a protein meal within a few hours. ${macroLine}`,
    ].join('\n\n');
  }
  if (/muscle|bulk|gain/.test(lower) && /eat|food|meal|diet|daily|protein/.test(lower)) {
    return [
      targetLine,
      'Why: muscle growth needs progressive strength training, enough protein to repair tissue, and enough carbs to train hard. Protein builds the muscle; carbs let you perform the work that signals growth.',
      `Plan: split ${targetProtein ? `${targetProtein}g protein` : 'your protein target'} across 3-5 meals. Each meal should have one strong protein source, one carb source, vegetables or fruit, and a small fat source.`,
      'Food options: eggs, chicken, fish, paneer, tofu, dal, curd, milk, whey, sprouts, rice, roti, oats, potatoes, bananas, vegetables, nuts, and peanut butter.',
      'Example day: breakfast with eggs or paneer plus roti/oats; lunch with dal or chicken/tofu, rice, curd, and salad; pre-workout banana or oats; dinner with paneer/chicken/fish/tofu, rice or roti, and vegetables.',
      'Today: make your first two meals protein-led. If you train, place carbs before and after the workout so strength stays high.',
    ].join('\n\n');
  }
  if (/breakfast|lunch|dinner|meal|snack|food|eat|diet/.test(lower)) {
    return [
      'Build each meal with one protein source, one carb source, vegetables or fruit, and a small fat source.',
      'Examples: eggs or paneer with roti; dal with rice and curd; chicken or tofu with potatoes; Greek yogurt with fruit and oats; sprouts with fruit and milk.',
      'A good daily rhythm is 25-35g protein at breakfast, 35-45g at lunch, 20-30g as a snack or post-workout, and 35-45g at dinner.',
      macroLine,
    ].join('\n\n');
  }
  if (/water|hydrate|hydration/.test(lower)) {
    return [
      'Aim for steady hydration through the day instead of drinking a lot at once.',
      'A simple target is pale-yellow urine, plus extra water around workouts, hot weather, or salty meals. Add electrolytes if you sweat heavily.',
    ].join('\n\n');
  }

  return [
    'I can help with meals, workouts, calories, macros, weight goals, and consistency.',
    'Ask for a specific plan like “make me a muscle gain diet for today” or “give me a 30 minute home workout” and I will turn your profile into practical steps.',
    targetLine,
  ].join('\n\n');
}

function splitDataUrl(image) {
  const [header, base64] = image.split(',');
  const mimeType = header.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
  return { mimeType, base64 };
}
