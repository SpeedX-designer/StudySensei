import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import * as mammoth from 'mammoth';

import Header from './components/Header';
import Footer from './components/Footer';
import Loader from './components/Loader';
import { generateStudyMaterials, regenerateQuiz } from './services/geminiService';
import { StudyData, ActiveTab, QuizQuestion as QuizQuestionType, Flashcard as FlashcardType } from './types';

const InputSection: React.FC<{
    onSubmit: (text: string, voiceMode: boolean) => void;
    isLoading: boolean;
}> = ({ onSubmit, isLoading }) => {
    const [text, setText] = useState('');
    const [fileName, setFileName] = useState('');
    const [voiceMode, setVoiceMode] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setFileError(null);

        if (file) {
            setFileName(file.name);
            const reader = new FileReader();
            
            if (file.name.endsWith('.docx')) {
                reader.onload = async (event) => {
                    try {
                        const arrayBuffer = event.target?.result as ArrayBuffer;
                        const result = await mammoth.extractRawText({ arrayBuffer });
                        setText(result.value);
                    } catch (error) {
                        console.error("Error parsing .docx file:", error);
                        setFileError("Could not read the .docx file. It might be corrupted or in an unsupported format.");
                        setText('');
                    }
                };
                reader.readAsArrayBuffer(file);
            } else {
                 reader.onload = (event) => {
                    setText(event.target?.result as string);
                };
                reader.readAsText(file);
            }
        }
    };

    const handleSubmit = () => {
        if (text.trim() && !fileError) {
            onSubmit(text, voiceMode);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-6 bg-slate-800 rounded-lg shadow-xl border border-slate-700">
            <h2 className="text-2xl font-semibold mb-4 text-slate-100">Upload Your Study Material</h2>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your text here, or upload a file below..."
                className="w-full h-48 p-4 bg-slate-900 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:outline-none transition duration-200 resize-none text-slate-300"
                disabled={isLoading}
            />
             {fileError && <p className="text-red-400 text-sm mt-2">{fileError}</p>}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4">
                <div className="relative">
                    <input
                        type="file"
                        id="file-upload"
                        className="absolute w-0 h-0 opacity-0"
                        onChange={handleFileChange}
                        accept=".txt,.md,.html,.docx"
                        disabled={isLoading}
                    />
                    <label
                        htmlFor="file-upload"
                        className={`px-4 py-2 rounded-md transition duration-200 cursor-pointer ${isLoading ? 'bg-slate-600 text-slate-400' : 'bg-slate-700 hover:bg-slate-600'}`}
                    >
                        {fileName || 'Upload File'}
                    </label>
                </div>
                <div className="flex items-center space-x-3 my-4 sm:my-0">
                    <label htmlFor="voice-mode" className="text-slate-300">Voice Mode</label>
                    <input 
                        type="checkbox"
                        id="voice-mode"
                        checked={voiceMode}
                        onChange={(e) => setVoiceMode(e.target.checked)}
                        className="w-5 h-5 text-sky-500 bg-slate-700 border-slate-600 rounded focus:ring-sky-600"
                        disabled={isLoading}
                    />
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={isLoading || !text.trim() || !!fileError}
                    className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-sky-500 to-emerald-500 text-white font-bold rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:from-sky-600 hover:to-emerald-600 transition duration-200"
                >
                    {isLoading ? 'Generating...' : 'Generate'}
                </button>
            </div>
        </div>
    );
};

const QuizQuestion: React.FC<{
    questionData: QuizQuestionType;
    questionIndex: number;
    userAnswer: string | null;
    correctAnswer: string;
    showAnswers: boolean;
    onSelectAnswer: (answer: string) => void;
}> = ({ questionData, questionIndex, userAnswer, correctAnswer, showAnswers, onSelectAnswer }) => {
    
    const getOptionClass = (option: string) => {
        if (!showAnswers) {
            return userAnswer === option ? 'bg-sky-700 border-sky-500' : 'bg-slate-700 border-slate-600 hover:bg-slate-600';
        }
        if (option === correctAnswer) {
            return 'bg-emerald-800 border-emerald-600';
        }
        if (option === userAnswer && option !== correctAnswer) {
            return 'bg-red-800 border-red-600';
        }
        return 'bg-slate-700 border-slate-600';
    };

    return (
        <div className="p-6 bg-slate-800 rounded-lg border border-slate-700 mb-4">
            <p className="font-semibold text-lg mb-4">{questionIndex + 1}. {questionData.question}</p>
            <div className="space-y-3">
                {Object.entries(questionData.options).map(([key, value]) => (
                    <div
                        key={key}
                        onClick={() => !showAnswers && onSelectAnswer(key)}
                        className={`p-3 rounded-md border cursor-pointer transition-colors ${getOptionClass(key)}`}
                    >
                        <span className="font-bold mr-2">{key}.</span>{value}
                    </div>
                ))}
            </div>
        </div>
    );
};

const VoiceModePlayer: React.FC<{ flashcards: FlashcardType[], languageCode: string, onExit: () => void }> = ({ flashcards, languageCode, onExit }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showAnswer, setShowAnswer] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
    const synth = window.speechSynthesis;

    useEffect(() => {
        const getVoices = () => {
            const voices = synth.getVoices();
            if (voices.length > 0) {
                // Prefer a voice that exactly matches the language code (e.g., 'en-US')
                let voice = voices.find(v => v.lang === languageCode);
                // Fallback to a voice that matches the language (e.g., 'en')
                if (!voice) {
                    voice = voices.find(v => v.lang.startsWith(languageCode.split('-')[0]));
                }
                // Fallback to the first available voice
                if (!voice) {
                    voice = voices[0];
                }
                setSelectedVoice(voice);
            }
        };

        getVoices();
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = getVoices;
        }
    }, [synth, languageCode]);

    const speak = useCallback((text: string) => {
        if (!selectedVoice) return;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
        utterance.rate = 0.9;
        synth.speak(utterance);
    }, [synth, selectedVoice]);

    const playQuestion = useCallback(() => {
        if (flashcards.length === 0) return;
        setShowAnswer(false);
        speak(flashcards[currentIndex].question);
    }, [currentIndex, flashcards, speak]);

    useEffect(() => {
        playQuestion();
    }, [currentIndex, playQuestion]);
    
    const handleNext = () => {
        if (currentIndex < flashcards.length - 1) {
            setCurrentIndex(prev => prev + 1);
        }
    };
    
    const handleRevealAnswer = () => {
        setShowAnswer(true);
        speak(flashcards[currentIndex].answer);
    };

    if (flashcards.length === 0) {
        return <div>No flashcards available.</div>
    }

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 text-center">
            <h3 className="text-xl font-bold mb-4 text-sky-400">Voice Mode</h3>
            <div className="h-48 flex flex-col justify-center items-center mb-6">
                <p className="text-2xl">{flashcards[currentIndex].question}</p>
                {showAnswer && <p className="text-emerald-400 mt-4 text-xl">{flashcards[currentIndex].answer}</p>}
            </div>
            <div className="flex justify-center space-x-4">
                <button onClick={playQuestion} className="px-4 py-2 bg-slate-700 rounded-md hover:bg-slate-600">Repeat</button>
                <button onClick={handleRevealAnswer} className="px-4 py-2 bg-sky-600 rounded-md hover:bg-sky-500">Reveal Answer</button>
                <button onClick={handleNext} disabled={currentIndex === flashcards.length - 1} className="px-4 py-2 bg-emerald-600 rounded-md hover:bg-emerald-500 disabled:opacity-50">Next</button>
            </div>
            <button onClick={onExit} className="mt-6 text-slate-400 hover:text-slate-200">Exit Voice Mode</button>
        </div>
    );
};

const FlashcardViewer: React.FC<{ cards: FlashcardType[] }> = ({ cards }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        // Reset flip state when card changes
        setIsFlipped(false);
    }, [currentIndex]);
    
    const handleNext = useCallback(() => {
        if (currentIndex < cards.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    }, [currentIndex, cards.length]);
    
    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    }, [currentIndex]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'ArrowRight') handleNext();
            if (e.code === 'ArrowLeft') handlePrev();
            if (e.code === 'Space') {
                e.preventDefault();
                setIsFlipped(f => !f);
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleNext, handlePrev]);
    
    if (!cards || cards.length === 0) {
        return <p>No flashcards to display.</p>
    }

    return (
        <div className="flex flex-col items-center">
            <div className="w-full max-w-xl mb-4">
                <div
                    className="w-full h-64 perspective-1000"
                    onClick={() => setIsFlipped(!isFlipped)}
                    >
                    <div
                        className={`relative w-full h-full transform-style-preserve-3d transition-transform duration-700 ${isFlipped ? 'rotate-y-180' : ''}`}
                    >
                        {/* Front of the card */}
                        <div className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center p-6 bg-slate-800 border border-slate-700 rounded-lg shadow-lg cursor-pointer">
                        <p className="text-sm text-slate-400 mb-2">Question</p>
                        <p className="text-center text-lg text-slate-100">{cards[currentIndex].question}</p>
                        </div>
                        {/* Back of the card */}
                        <div className="absolute w-full h-full backface-hidden rotate-y-180 flex flex-col items-center justify-center p-6 bg-emerald-900/50 border border-emerald-700 rounded-lg shadow-lg cursor-pointer">
                        <p className="text-sm text-emerald-300 mb-2">Answer</p>
                        <p className="text-center text-lg text-slate-100">{cards[currentIndex].answer}</p>
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-slate-400 mb-4">
                Card {currentIndex + 1} of {cards.length}
            </p>

            <div className="flex items-center space-x-4">
                <button onClick={handlePrev} disabled={currentIndex === 0} className="px-5 py-2 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50">Previous</button>
                <button onClick={() => setIsFlipped(!isFlipped)} className="px-5 py-2 bg-sky-600 rounded-md hover:bg-sky-500">Flip Card</button>
                <button onClick={handleNext} disabled={currentIndex === cards.length - 1} className="px-5 py-2 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50">Next</button>
            </div>
            <p className="text-sm text-slate-500 mt-4">Use Arrow Keys to navigate and Spacebar to flip.</p>
        </div>
    );
};


const App: React.FC = () => {
    const [studyData, setStudyData] = useState<StudyData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.Summary);

    const [userAnswers, setUserAnswers] = useState<(string | null)[]>([]);
    const [showQuizAnswers, setShowQuizAnswers] = useState(false);
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    
    const [originalText, setOriginalText] = useState<string>('');
    const [isRefreshingQuiz, setIsRefreshingQuiz] = useState(false);

    const handleGenerate = useCallback(async (text: string, voiceMode: boolean) => {
        setIsLoading(true);
        setError(null);
        setStudyData(null);
        setUserAnswers([]);
        setShowQuizAnswers(false);
        setIsVoiceMode(false);
        setOriginalText(text); // Save original text
        try {
            const data = await generateStudyMaterials(text, voiceMode);
            setStudyData(data);
            setActiveTab(ActiveTab.Summary);
            setUserAnswers(new Array(data.quiz.questions.length).fill(null));
        } catch (e: any) {
            setError(e.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    const handleQuizRefresh = useCallback(async () => {
        if (!originalText) return;
        
        setIsRefreshingQuiz(true);
        setError(null);
        try {
            const newQuiz = await regenerateQuiz(originalText);
            setStudyData(prevData => prevData ? { ...prevData, quiz: newQuiz } : null);
            setUserAnswers(new Array(newQuiz.questions.length).fill(null));
            setShowQuizAnswers(false);
        } catch(e: any) {
            setError(e.message || 'An unexpected error occurred while refreshing the quiz.');
        } finally {
            setIsRefreshingQuiz(false);
        }

    }, [originalText]);

    const handleSelectAnswer = (questionIndex: number, answer: string) => {
        setUserAnswers(prev => {
            const newAnswers = [...prev];
            newAnswers[questionIndex] = answer;
            return newAnswers;
        });
    };

    const quizScore = useMemo(() => {
        if (!studyData) return 0;
        return userAnswers.reduce((score, userAnswer, index) => {
            if (userAnswer === studyData.quiz.answers[index]) {
                return score + 1;
            }
            return score;
        }, 0);
    }, [userAnswers, studyData]);
    
    // When switching tabs, clean up states
    useEffect(() => {
        // Exit voice mode if user switches away from flashcards tab
        if (activeTab !== ActiveTab.Flashcards && isVoiceMode) {
            setIsVoiceMode(false);
            window.speechSynthesis.cancel();
        }
    }, [activeTab, isVoiceMode])


    const renderContent = () => {
        if (!studyData) return null;

        switch (activeTab) {
            case ActiveTab.Summary:
                return <div className="prose prose-invert prose-p:text-slate-300 prose-headings:text-slate-100 prose-strong:text-sky-400 p-6 bg-slate-800 rounded-lg border border-slate-700" dangerouslySetInnerHTML={{ __html: studyData.summary.replace(/\n/g, '<br />') }} />;
            
            case ActiveTab.Flashcards:
                 if (isVoiceMode) {
                    return <VoiceModePlayer flashcards={studyData.flashcards} languageCode={studyData.languageCode} onExit={() => setIsVoiceMode(false)} />;
                 }
                 return (
                    <div>
                        <div className="flex justify-end mb-4">
                            <button onClick={() => setIsVoiceMode(true)} className="px-4 py-2 bg-sky-600 rounded-md hover:bg-sky-500">
                                Start Voice Mode
                            </button>
                        </div>
                        <FlashcardViewer cards={studyData.flashcards} />
                    </div>
                 );
                 
            case ActiveTab.Quiz:
                return (
                    <div>
                        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setShowQuizAnswers(!showQuizAnswers)} className="px-4 py-2 bg-sky-600 rounded-md hover:bg-sky-500">
                                    {showQuizAnswers ? 'Hide Answers' : 'Show Answers'}
                                </button>
                                <button 
                                    onClick={handleQuizRefresh} 
                                    disabled={isRefreshingQuiz}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-wait"
                                >
                                     <svg className={`w-5 h-5 ${isRefreshingQuiz ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-11.664 0l4.992-4.993m-4.993 0l3.181-3.183a8.25 8.25 0 0111.664 0l3.181 3.183" />
                                    </svg>
                                    {isRefreshingQuiz ? 'Refreshing...' : 'New Quiz'}
                                </button>
                            </div>
                             {showQuizAnswers && <div className="text-xl font-bold text-emerald-400">Score: {quizScore} / {studyData.quiz.questions.length}</div>}
                        </div>
                        {studyData.quiz.questions.map((q, index) => (
                            <QuizQuestion 
                                key={index} 
                                questionData={q}
                                questionIndex={index}
                                userAnswer={userAnswers[index]}
                                correctAnswer={studyData.quiz.answers[index]}
                                showAnswers={showQuizAnswers}
                                onSelectAnswer={(answer) => handleSelectAnswer(index, answer)}
                            />
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };
    
    const TabButton: React.FC<{tab: ActiveTab; label: string}> = ({ tab, label }) => (
        <button
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg font-semibold transition-colors ${
                activeTab === tab 
                    ? 'bg-slate-800 text-sky-400 border-b-2 border-sky-400' 
                    : 'text-slate-400 hover:bg-slate-700'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <Header />
            <main className="flex-grow container mx-auto px-4 py-8">
                <InputSection onSubmit={handleGenerate} isLoading={isLoading} />
                {isLoading && <Loader />}
                {error && <div className="text-center my-6 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-md">{error}</div>}
                {studyData && (
                    <div className="mt-12 max-w-4xl mx-auto">
                        <div className="border-b border-slate-700 mb-6">
                           <TabButton tab={ActiveTab.Summary} label="Summary" />
                           <TabButton tab={ActiveTab.Flashcards} label="Flashcards" />
                           <TabButton tab={ActiveTab.Quiz} label="Quiz" />
                        </div>
                        <div>{renderContent()}</div>
                    </div>
                )}
            </main>
            <Footer />
            <style>{`
                .perspective-1000 { perspective: 1000px; }
                .transform-style-preserve-3d { transform-style: preserve-3d; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
            `}</style>
        </div>
    );
};

export default App;