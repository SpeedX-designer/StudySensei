export interface Flashcard {
  question: string;
  answer: string;
}

export interface QuizQuestion {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
}

export interface Quiz {
  questions: QuizQuestion[];
  answers: string[];
}

export interface StudyData {
  summary: string;
  flashcards: Flashcard[];
  quiz: Quiz;
  languageCode: string; // e.g., 'en-US', 'es-ES'
}

export enum ActiveTab {
    Summary = 'summary',
    Flashcards = 'flashcards',
    Quiz = 'quiz',
}