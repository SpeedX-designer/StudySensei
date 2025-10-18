
import React, { useState } from 'react';
import { Flashcard as FlashcardType } from '../types';

interface FlashcardProps {
  card: FlashcardType;
}

const Flashcard: React.FC<FlashcardProps> = ({ card }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div
      className="w-full h-64 perspective-1000 cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <div
        className={`relative w-full h-full transform-style-preserve-3d transition-transform duration-700 ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* Front of the card */}
        <div className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center p-6 bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
          <p className="text-sm text-slate-400 mb-2">Question</p>
          <p className="text-center text-lg text-slate-100">{card.question}</p>
        </div>
        {/* Back of the card */}
        <div className="absolute w-full h-full backface-hidden rotate-y-180 flex flex-col items-center justify-center p-6 bg-emerald-900/50 border border-emerald-700 rounded-lg shadow-lg">
          <p className="text-sm text-emerald-300 mb-2">Answer</p>
          <p className="text-center text-lg text-slate-100">{card.answer}</p>
        </div>
      </div>
    </div>
  );
};

export default Flashcard;
