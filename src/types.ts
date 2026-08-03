export interface Language {
  code: string;
  name: string;
  nativeName: string;
  voiceLang?: string; // language tag for SpeechSynthesis
}

export interface TranslationHistoryItem {
  id: string;
  sourceText: string; // Keep HTML formatted content
  translatedText: string;
  sourceLangCode: string;
  targetLangCode: string;
  sourceLangName: string;
  targetLangName: string;
  timestamp: number;
  isStarred?: boolean;
}

export type ProviderType = "DeepL" | "Gemini";

export type ForcedProviderType = "Auto" | "DeepL" | "Gemini";
