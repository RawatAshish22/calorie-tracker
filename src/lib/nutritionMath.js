import { defaultGoals, quickFoods } from '../data/foods.js';

const numberFields = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar', 'sodium'];

export function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyTotals() {
  return numberFields.reduce((totals, key) => ({ ...totals, [key]: 0 }), {});
}

export function roundMetric(value, digits = 1) {
  if (!Number.isFinite(Number(value))) return 0;
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

export function normalizeNutrition(raw = {}) {
  const normalized = {};
  for (const key of numberFields) {
    normalized[key] = roundMetric(raw[key] ?? 0, key === 'calories' || key === 'sodium' ? 0 : 1);
  }
  normalized.vitamins = raw.vitamins && typeof raw.vitamins === 'object' ? raw.vitamins : {};
  return normalized;
}

export function addTotals(items = []) {
  return items.reduce((totals, item) => {
    for (const key of numberFields) {
      totals[key] = roundMetric((totals[key] || 0) + Number(item.nutrition?.[key] || 0));
    }
    return totals;
  }, emptyTotals());
}

export function goalProgress(value, goal) {
  if (!goal) return 0;
  return Math.min(100, Math.round((Number(value || 0) / Number(goal || 1)) * 100));
}

export function formatDayLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function findFoodMatch(text) {
  const lowered = String(text || '').toLowerCase();
  return quickFoods.find((food) => food.aliases.some((alias) => lowered.includes(alias)));
}

export function parseQuantityScale(text, food) {
  const lowered = String(text || '').toLowerCase();
  const gramsMatch = lowered.match(/(\d+(?:\.\d+)?)\s*(kg|g|gram|grams|ml|milliliter|milliliters)\b/);
  if (gramsMatch) {
    const amount = Number(gramsMatch[1]);
    const unit = gramsMatch[2];
    const grams = unit === 'kg' ? amount * 1000 : amount;
    return {
      scale: grams / food.servingGrams,
      quantity: `${roundMetric(grams, 0)} g`,
    };
  }

  const countMatch = lowered.match(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:x\s*)?(?:piece|pieces|pcs|serving|servings|cup|cups|bowl|bowls|scoop|scoops|slice|slices|egg|eggs|idli|idlis|roti|rotis|chapati|chapatis)?\b/);
  if (countMatch && !lowered.includes('cal')) {
    const count = Number(countMatch[1]);
    return {
      scale: Number.isFinite(count) && count > 0 ? count : 1,
      quantity: count === 1 ? food.quantity : `${roundMetric(count)} x ${food.quantity}`,
    };
  }

  return { scale: 1, quantity: food.quantity };
}

export function scaleNutrition(nutrition, scale) {
  const scaled = {};
  for (const key of numberFields) {
    scaled[key] = roundMetric(Number(nutrition[key] || 0) * scale, key === 'calories' || key === 'sodium' ? 0 : 1);
  }
  scaled.vitamins = nutrition.vitamins || {};
  return scaled;
}

export function estimateNutrition(text) {
  const match = findFoodMatch(text);
  if (match) {
    const { scale, quantity } = parseQuantityScale(text, match);
    const nutrition = scaleNutrition(match.nutrition, scale);
    return {
      foodId: match.id,
      foodName: match.name,
      quantity,
      nutrition,
      baseNutrition: normalizeNutrition(match.nutrition),
      baseQuantity: match.quantity,
      baseServingGrams: match.servingGrams,
      source: 'Quick list estimate',
      confidence: 'medium',
      notes: 'Estimated from the predefined food database.',
    };
  }

  const nutrition = normalizeNutrition({
    calories: 250,
    protein: 8,
    carbs: 30,
    fat: 10,
    fiber: 3,
    sugar: 5,
    sodium: 300,
    vitamins: { vitaminC: 'varies', calcium: 'varies', iron: 'varies' },
  });

  return {
    foodName: String(text || 'Food').trim() || 'Food',
    quantity: '1 serving',
    nutrition,
    baseNutrition: nutrition,
    baseQuantity: '1 serving',
    baseServingGrams: null,
    source: 'Generic estimate',
    confidence: 'low',
    notes: 'No exact local match found. Add an AI key for better parsing.',
  };
}

export function nutritionFromQuickFood(food) {
  const nutrition = normalizeNutrition(food.nutrition);
  return {
    foodId: food.id,
    foodName: food.name,
    quantity: food.quantity,
    nutrition,
    baseNutrition: nutrition,
    baseQuantity: food.quantity,
    baseServingGrams: food.servingGrams,
    source: 'Quick list',
    confidence: 'high',
    notes: 'Predefined nutrition profile.',
  };
}

export function buildSmartTip(totals, goals = defaultGoals) {
  const caloriesProgress = Number(totals.calories || 0) / Number(goals.calories || 1);
  const proteinProgress = Number(totals.protein || 0) / Number(goals.protein || 1);
  const fiberProgress = Number(totals.fiber || 0) / Number(goals.fiber || 1);
  const sodiumProgress = Number(totals.sodium || 0) / Number(goals.sodium || 1);
  const sugarProgress = Number(totals.sugar || 0) / Number(goals.sugar || 1);

  if (totals.calories === 0) return 'Log your first meal to start today with a clear nutrition snapshot.';
  if (sodiumProgress > 0.9 && caloriesProgress < 0.75) return 'Sodium is moving fast today. Fresh fruit, curd, or a simple salad can balance the next meal.';
  if (sugarProgress > 0.8 && proteinProgress < 0.6) return 'Sugar is high relative to protein. A protein-led snack can make the day steadier.';
  if (proteinProgress + 0.2 < caloriesProgress) return 'Protein is trailing your calorie pace. Eggs, dal, paneer, tofu, or chicken would help.';
  if (fiberProgress < 0.35 && caloriesProgress > 0.45) return 'Fiber is light so far. Add vegetables, fruit, oats, dal, or whole grains next.';
  if (caloriesProgress > 1) return 'You have crossed the calorie goal. Keep the next choices light and protein-forward.';
  return 'Your day is balanced so far. Keep logging meals to make the next choice easier.';
}

export function clampGoalDraft(goals) {
  return {
    calories: Math.max(800, Number(goals.calories || defaultGoals.calories)),
    protein: Math.max(20, Number(goals.protein || defaultGoals.protein)),
    carbs: Math.max(20, Number(goals.carbs || defaultGoals.carbs)),
    fat: Math.max(10, Number(goals.fat || defaultGoals.fat)),
    fiber: Math.max(5, Number(goals.fiber || defaultGoals.fiber)),
    sugar: Math.max(5, Number(goals.sugar || defaultGoals.sugar)),
    sodium: Math.max(500, Number(goals.sodium || defaultGoals.sodium)),
  };
}
