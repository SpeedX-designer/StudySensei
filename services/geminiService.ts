import { GoogleGenAI, Type } from "@google/genai";
import { StudyData, Quiz } from '../types';

const studySchema = {
  type: Type.OBJECT,
  properties: {
    languageCode: {
      type: Type.STRING,
      description: "The BCP-47 language code for the provided text (e.g., 'en-US', 'es-ES', 'fr-FR').",
    },
    summary: {
      type: Type.STRING,
      description: "A concise summary of the text using bullet points or short paragraphs, focusing on key concepts and definitions. Format with markdown.",
    },
    flashcards: {
      type: Type.ARRAY,
      description: "An array of 10-15 flashcards.",
      items: {
        type: Type.OBJECT,
        properties: {
          question: {
            type: Type.STRING,
            description: "A short, direct question from the text.",
          },
          answer: {
            type: Type.STRING,
            description: "A concise and direct answer to the question.",
          },
        },
        required: ["question", "answer"],
      },
    },
    quiz: {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          description: "An array of 10 multiple-choice questions.",
          items: {
            type: Type.OBJECT,
            properties: {
              question: {
                type: Type.STRING,
                description: "A multiple-choice question based on the text.",
              },
              options: {
                type: Type.OBJECT,
                properties: {
                  A: { type: Type.STRING },
                  B: { type: Type.STRING },
                  C: { type: Type.STRING },
                  D: { type: Type.STRING },
                },
                required: ["A", "B", "C", "D"],
              },
            },
            required: ["question", "options"],
          },
        },
        answers: {
          type: Type.ARRAY,
          description: "An array of the correct answer letters (e.g., 'A', 'C', 'B') for each question in order.",
          items: {
            type: Type.STRING,
          },
        },
      },
      required: ["questions", "answers"],
    },
  },
  required: ["summary", "flashcards", "quiz", "languageCode"],
};


export const generateStudyMaterials = async (text: string, voiceMode: boolean): Promise<StudyData> => {
    if (!process.env.API_KEY) {
        throw new Error("API key is not configured. Please set the API_KEY environment variable.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const voiceModeInstruction = voiceMode 
        ? `Additionally, reformat the flashcards into a verbal quiz style like: “I’ll ask a question, and you try to answer before I reveal the correct one.” Add conversational touches to make it sound interactive and motivational.`
        : '';
    
    const prompt = `
        You are StudySensei, an expert AI tutor. Your task is to analyze the following text and generate a structured JSON object containing study materials.

        Rules:
        - First, detect the language of the provided text and specify its BCP-47 language code (e.g., 'en-US', 'es-ES').
        - Generate 10-15 flashcards.
        - Generate exactly 10 multiple-choice quiz questions.
        - Ensure only one option in each quiz question is correct.
        - The summary should be easy for a high-school student to understand and formatted with markdown (e.g. using #, ##, *, -).
        - If the provided text is in a language other than English, all generated content (summary, flashcards, quiz) MUST be in that same language.
        - Maintain a helpful, encouraging, and teacher-like tone in all generated text.
        ${voiceModeInstruction}

        Here is the text to analyze:
        ---
        ${text}
        ---
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: studySchema,
            },
        });

        const jsonString = response.text;
        const parsedData = JSON.parse(jsonString);

        // Basic validation
        if (!parsedData.summary || !parsedData.flashcards || !parsedData.quiz || !parsedData.languageCode) {
            throw new Error("Invalid data structure received from API.");
        }
        
        return parsedData as StudyData;

    } catch (error) {
        console.error("Error generating study materials:", error);
        throw new Error("Failed to generate study materials. Please check the input and try again.");
    }
};

export const regenerateQuiz = async (text: string): Promise<Quiz> => {
    if (!process.env.API_KEY) {
        throw new Error("API key is not configured. Please set the API_KEY environment variable.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const quizSchema = studySchema.properties.quiz;

    const prompt = `
        You are StudySensei, an expert AI tutor. Based on the following text, generate a completely new set of 10 multiple-choice quiz questions.
        
        Rules:
        - Do not repeat questions you may have generated before for this text.
        - Ensure your response is only the JSON object for the quiz, matching the provided schema.
        - All questions and answers must be in the same language as the provided text.

        Here is the text to analyze:
        ---
        ${text}
        ---
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
            },
        });

        const jsonString = response.text;
        const parsedData = JSON.parse(jsonString);

        if (!parsedData.questions || !parsedData.answers) {
            throw new Error("Invalid quiz data structure received from API.");
        }

        return parsedData as Quiz;

    } catch (error) {
        console.error("Error regenerating quiz:", error);
        throw new Error("Failed to generate a new quiz. Please try again.");
    }
};