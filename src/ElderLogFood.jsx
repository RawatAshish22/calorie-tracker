import React, { useState, useEffect, useRef } from 'react';
import { Mic, Search, Check } from 'lucide-react';
import { commonFoods } from './lib/foods.js';
import { lookupNutrition } from './lib/aiNutrition.js';

export default function ElderLogFood({ items, onAddFood }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [recognition, setRecognition] = useState(null);

  const eaten = items.reduce((sum, item) => sum + (item.nutrition?.calories || 0), 0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'hi-IN'; // Defaulting to Hindi/Indian accent English for better regional food recognition
        
        rec.onresult = (event) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        rec.onend = async () => {
          setIsListening(false);
          setIsProcessing(true);
          
          if (currentTranscript.trim() !== '') {
            try {
              const res = await lookupNutrition(currentTranscript);
              if (res) {
                // If it's a generic AI response, we mock parsing it to an array
                setParsedItems([{
                  id: Date.now().toString(),
                  name: res.foodName,
                  portion: res.quantity,
                  calories: res.nutrition.calories,
                  nutrition: res.nutrition,
                  source: 'ai'
                }]);
              }
            } catch (err) {
              console.error(err);
            }
          }
          setIsProcessing(false);
        };

        rec.onerror = (e) => {
          console.error("Speech recognition error", e.error);
          setIsListening(false);
        };

        setRecognition(rec);
      }
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognition?.stop();
    } else {
      setTranscript('');
      recognition?.start();
      setIsListening(true);
    }
  };

  const [parsedItems, setParsedItems] = useState([]);

  // Removed mock parsed items logic since we now call lookupNutrition

  const handleConfirmVoice = () => {
    const totalCals = parsedItems.reduce((acc, item) => acc + item.calories, 0);
    const mockItem = {
      id: Date.now().toString(),
      name: parsedItems.map(i => i.name).join(', '),
      quantity: parsedItems.map(i => i.portion).join(', '),
      nutrition: { 
        calories: totalCals, 
        protein: parsedItems.reduce((acc, i) => acc + (i.nutrition?.protein || 0), 0), 
        carbs: parsedItems.reduce((acc, i) => acc + (i.nutrition?.carbs || 0), 0), 
        fat: parsedItems.reduce((acc, i) => acc + (i.nutrition?.fat || 0), 0) 
      },
      source: 'voice',
      createdAt: new Date().toISOString()
    };
    onAddFood(mockItem);
    setTranscript('');
    setParsedItems([]);
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-center gap-4 border-b border-[#e8e4d9] pb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f2efe4]">
          <Mic className="h-6 w-6 text-[#c48227]" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-[#2d2515]">Add food</h2>
          <p className="text-[#7a6f5d]">{eaten} calories logged today</p>
        </div>
      </div>

      <div className="rounded-[32px] bg-white p-6 shadow-sm border border-[#e8e4d9]">
        <div className="flex flex-col items-center text-center">
          <button 
            onClick={toggleListen}
            className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
              isListening ? 'bg-red-500 animate-pulse text-white' : 'bg-[#c48227] text-white shadow-lg'
            }`}
          >
            <Mic className="h-10 w-10" />
          </button>
          
          <p className="mt-4 text-lg font-bold text-[#2d2515]">
            {isListening ? 'Listening...' : isProcessing ? 'Processing with AI...' : 'Tap and speak what you ate'}
          </p>
          
          {transcript && (
            <div className="mt-6 w-full rounded-2xl bg-[#f2efe4] p-4 text-left">
              <p className="text-sm font-medium text-[#7a6f5d] mb-1 flex items-center gap-2">
                <Mic className="h-4 w-4" /> You said:
              </p>
              <p className="text-lg font-medium text-[#2d2515]">{transcript}</p>
            </div>
          )}

          {parsedItems.length > 0 && !isListening && (
            <div className="mt-4 w-full text-left">
              <div className="mb-4 divide-y divide-[#e8e4d9]">
                {parsedItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-emerald-500" />
                      <span className="font-bold text-[#2d2515]">{item.name} <span className="text-[#7a6f5d] font-normal">• {item.portion}</span></span>
                    </div>
                    <span className="font-medium text-[#7a6f5d]">{item.calories} kcal</span>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={handleConfirmVoice}
                className="w-full rounded-2xl bg-[#c48227] py-4 text-lg font-bold text-white shadow-lg flex items-center justify-center gap-2"
              >
                <Check className="h-5 w-5" /> Add to today's log • {parsedItems.reduce((a, b) => a + b.calories, 0)} kcal
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="text-center text-[#7a6f5d] my-2">or type to search</div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-[#7a6f5d]" />
        <input
          type="text"
          placeholder="Search foods"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-2xl border border-[#e8e4d9] bg-white p-4 pl-12 text-lg text-[#2d2515] outline-none focus:border-[#c48227]"
        />
      </div>
      
      {/* Mocking Indian Regional DB suggestions */}
      <div className="flex flex-col gap-2">
        {commonFoods.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 3).map((food, idx) => (
          <div key={idx} className="flex items-center justify-between rounded-2xl bg-white p-4 border border-[#e8e4d9]">
            <div>
              <div className="font-bold text-[#2d2515]">{food.name}</div>
              <div className="text-sm text-[#7a6f5d]">{food.portion}</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-[#2d2515]">{food.calories} kcal</div>
              <button onClick={() => onAddFood({...food, id: Date.now().toString()})} className="text-sm font-bold text-[#c48227]">Add</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
