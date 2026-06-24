import React, { useState, useEffect, useRef } from 'react';
import { Mic, Search, Check, Camera, CalendarDays, Trash2, RefreshCw } from 'lucide-react';
import { commonFoods } from './lib/foods.js';
import { lookupNutrition } from './lib/aiNutrition.js';
import { roundMetric, goalProgress } from './lib/nutritionMath.js';

export default function ElderLogFood({
  aiSettings,
  goals,
  todayItems,
  todayTotals,
  onResult,
  onToast,
  onRemove,
  onOpenScan,
  onOpenHistory,
}) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [recognition, setRecognition] = useState(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'hi-IN'; // Indian accent English / Hindi

        rec.onresult = (event) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
          transcriptRef.current = currentTranscript;
        };

        rec.onend = async () => {
          setIsListening(false);
          const speechText = transcriptRef.current;
          if (speechText.trim()) {
            setIsProcessing(true);
            try {
              const res = await lookupNutrition(speechText, aiSettings);
              if (res) {
                onResult(res);
                if (res.source.includes('fallback') || res.confidence === 'low') {
                  onToast('AI was unavailable, so an estimate was used');
                }
              }
            } catch (err) {
              console.error(err);
              onToast(err.message || 'AI processing failed');
            } finally {
              setIsProcessing(false);
            }
          }
        };

        rec.onerror = (e) => {
          console.error("Speech recognition error", e.error);
          setIsListening(false);
          onToast(`Microphone error: ${e.error}`);
        };

        setRecognition(rec);
      }
    }
  }, [aiSettings, onResult, onToast]);

  const toggleListen = () => {
    if (isListening) {
      recognition?.stop();
    } else {
      setTranscript('');
      transcriptRef.current = '';
      try {
        recognition?.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
        onToast('Failed to start microphone');
      }
    }
  };

  const [isSearchingAI, setIsSearchingAI] = useState(false);

  async function handleAISearch(e) {
    e?.preventDefault();
    const query = searchTerm.trim();
    if (!query || isSearchingAI) return;
    setIsSearchingAI(true);
    try {
      const res = await lookupNutrition(query, aiSettings);
      if (res) {
        onResult(res);
        if (res.source.includes('fallback') || res.confidence === 'low') {
          onToast('AI was unavailable, so an estimate was used');
        }
      }
    } catch (err) {
      console.error(err);
      onToast(err.message || 'AI search failed');
    } finally {
      setIsSearchingAI(false);
    }
  }

  function handleSelectCommonFood(food) {
    const nutrition = {
      calories: Number(food.calories || 0),
      protein: Number(food.protein || 0),
      carbs: Number(food.carbs || 0),
      fat: Number(food.fat || 0),
      fiber: Number(food.fiber || 0),
      sodium: Number(food.sodium || 0),
      vitamins: {},
    };
    onResult({
      foodId: food.foodId || 'generic',
      foodName: food.name,
      quantity: food.portion,
      source: 'Quick database',
      nutrition,
      baseNutrition: nutrition,
      baseQuantity: food.portion,
      baseServingGrams: food.servingGrams || 40,
    });
  }

  const progress = goalProgress(todayTotals.calories, goals.calories);

  return (
    <div className="space-y-6 bg-[#fcfaf2] text-[#2d2515] p-1 font-sans">
      {/* Header Summary */}
      <div className="flex items-center justify-between border-b border-[#e8e4d9] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c48227]/10 text-[#c48227]">
            <Mic size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-[#2d2515]">Add Food</h2>
            <p className="text-sm text-[#7a6f5d]">Speak or search what you ate</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-[#c48227]">{roundMetric(todayTotals.calories, 0)} kcal</p>
          <p className="text-xs text-[#7a6f5d]">eaten today</p>
        </div>
      </div>

      {/* Voice Recorder Card */}
      <section className="rounded-[32px] bg-white p-6 shadow-sm border border-[#e8e4d9]">
        <div className="flex flex-col items-center text-center">
          <button 
            type="button"
            onClick={toggleListen}
            disabled={isProcessing}
            className={`flex h-24 w-24 items-center justify-center rounded-full transition-all duration-300 active:scale-95 ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' 
                : 'bg-[#c48227] text-white shadow-lg shadow-[#c48227]/30 hover:bg-[#a86e1e]'
            }`}
          >
            {isProcessing ? (
              <RefreshCw className="h-10 w-10 animate-spin" />
            ) : (
              <Mic className="h-12 w-12" />
            )}
          </button>
          
          <h3 className="mt-4 text-lg font-black text-[#2d2515]">
            {isListening ? 'Listening... Speak now' : isProcessing ? 'Processing with AI...' : 'Tap to speak what you ate'}
          </h3>
          <p className="mt-1 text-xs text-[#7a6f5d] max-w-[250px]">
            Example: "I had two eggs, one banana, and a cup of tea for breakfast"
          </p>
          
          {transcript && (
            <div className="mt-4 w-full rounded-2xl bg-[#f2efe4]/60 border border-[#e8e4d9] p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-[#7a6f5d] mb-1 flex items-center gap-1">
                <Mic className="h-3 w-3 text-[#c48227]" /> You said:
              </p>
              <p className="text-base font-bold text-[#2d2515] italic">"{transcript}"</p>
            </div>
          )}
        </div>
      </section>

      {/* Camera Scan & History Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onOpenScan}
          className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#c48227] text-base font-bold text-white shadow transition active:scale-95 hover:bg-[#a86e1e]"
        >
          <Camera size={20} />
          Scan Food
        </button>
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex h-14 items-center justify-center gap-3 rounded-2xl border border-[#e8e4d9] bg-white text-base font-bold text-[#2d2515] shadow-sm transition active:scale-95 hover:bg-[#f2efe4]"
        >
          <CalendarDays size={20} />
          View History
        </button>
      </div>

      <div className="text-center text-[#7a6f5d] font-bold text-sm my-2">— OR SEARCH BY TEXT —</div>

      {/* Text Search Bar */}
      <form onSubmit={handleAISearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7a6f5d]" />
          <input
            type="text"
            placeholder="Type food (e.g. 2 Roti, Chicken Curry)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-14 rounded-2xl border border-[#e8e4d9] bg-white pl-12 pr-4 text-base text-[#2d2515] outline-none focus:border-[#c48227] shadow-sm font-semibold"
          />
        </div>
        <button
          type="submit"
          disabled={!searchTerm.trim() || isSearchingAI}
          className="h-14 px-5 rounded-2xl bg-[#c48227] text-white font-bold flex items-center justify-center transition active:scale-95 disabled:opacity-50"
        >
          {isSearchingAI ? <RefreshCw className="h-5 w-5 animate-spin" /> : 'AI Search'}
        </button>
      </form>

      {/* Quick Search Suggestions */}
      {searchTerm && (
        <div className="flex flex-col gap-2">
          {commonFoods.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 4).map((food, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-2xl bg-white p-4 border border-[#e8e4d9] shadow-sm animate-pop">
              <div>
                <div className="font-bold text-[#2d2515] text-base">{food.name}</div>
                <div className="text-sm text-[#7a6f5d]">{food.portion}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right font-black text-[#2d2515]">{food.calories} kcal</div>
                <button
                  type="button"
                  onClick={() => handleSelectCommonFood(food)}
                  className="rounded-xl bg-[#c48227] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95 hover:bg-[#a86e1e]"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Today's Tray / Daily Log summary */}
      <section className="rounded-[26px] border border-[#e8e4d9] bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check size={18} className="text-[#c48227]" />
            <h3 className="text-base font-bold text-[#2d2515]">Today's Food Log</h3>
          </div>
          <span className="text-xs text-[#7a6f5d] font-bold">{todayItems.filter(i => i.type !== 'exercise').length} items</span>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs font-bold text-[#7a6f5d] mb-1">
            <span>Progress</span>
            <span>{roundMetric(todayTotals.calories, 0)} / {goals.calories} kcal</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-[#f2efe4]">
            <div className="h-full rounded-full bg-[#c48227] transition-all duration-700" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
        </div>

        {/* Logged Items List */}
        {todayItems.filter(i => i.type !== 'exercise').length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#e8e4d9] p-6 text-center text-sm text-[#7a6f5d]">
            Nothing logged yet for today. Use the microphone or search to add food!
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {todayItems.filter(i => i.type !== 'exercise').map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-[#fcfaf2] border border-[#e8e4d9] text-sm">
                <div className="min-w-0">
                  <p className="font-bold text-[#2d2515] truncate">{item.name}</p>
                  <p className="text-xs text-[#7a6f5d]">{item.quantity} • {roundMetric(item.nutrition?.calories, 0)} kcal</p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="p-2 rounded-lg text-[#7a6f5d] hover:bg-[#e8e4d9] hover:text-red-500 transition active:scale-95"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
