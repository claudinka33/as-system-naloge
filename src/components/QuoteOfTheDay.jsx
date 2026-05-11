import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';
import { getTodayQuote } from '../quotes.js';

export default function QuoteOfTheDay() {
  const [dismissed, setDismissed] = useState(false);
  const [quote, setQuote] = useState(getTodayQuote());

  useEffect(() => {
    // Preveri ali je uporabnik danes že zaprl misel
    try {
      const today = new Date().toDateString();
      const dismissedDate = localStorage.getItem('as_quote_dismissed_date');
      if (dismissedDate === today) {
        setDismissed(true);
      }
    } catch (e) {}
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('as_quote_dismissed_date', new Date().toDateString());
    } catch (e) {}
  };

  if (dismissed) return null;

  return (
    <div className="mb-4 bg-gradient-to-r from-as-red-50 to-amber-50 border border-as-red-100 rounded-xl p-4 shadow-sm relative overflow-hidden">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-white/50 rounded-full transition text-as-gray-400 hover:text-as-gray-600"
        title="Skrij za danes"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="text-3xl flex-shrink-0">
          {quote.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-as-gray-500">
              Misel dneva
            </span>
          </div>
          <p className="text-sm text-as-gray-700 italic leading-relaxed">
            "{quote.text}"
          </p>
          {quote.author && (
            <p className="text-xs text-as-gray-400 mt-1 font-medium">
              — {quote.author}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
