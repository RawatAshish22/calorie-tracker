import { estimateNutrition, normalizeNutrition } from './nutritionMath.js';

export async function lookupNutrition(query, settings = {}) {
  const local = estimateNutrition(query);
  if (local.confidence !== 'low' || settings.provider === 'offline') return local;

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/nutrition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        provider: settings.provider || 'auto',
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
    return normalizeServerResult(data);
  } catch (error) {
    return {
      ...local,
      source: `${local.source} after AI fallback`,
      notes: error?.message ? `AI lookup failed: ${error.message}` : local.notes,
    };
  }
}

function normalizeServerResult(data) {
  const nutrition = normalizeNutrition(data.nutrition || data);

  return {
    foodName: String(data.foodName || data.food || 'Food'),
    quantity: String(data.quantity || '1 serving'),
    nutrition,
    baseNutrition: nutrition,
    baseQuantity: String(data.quantity || '1 serving'),
    baseServingGrams: Number(data.baseServingGrams || data.servingGrams || data.grams || 0) > 0 ? Number(data.baseServingGrams || data.servingGrams || data.grams) : null,
    source: String(data.source || 'Backend AI'),
    confidence: data.confidence || 'ai',
    notes: String(data.notes || 'AI-generated estimate.'),
  };
}
