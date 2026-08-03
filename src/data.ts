import { Language } from "./types";

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "vi", name: "Tiếng Việt", nativeName: "Tiếng Việt", voiceLang: "vi-VN" },
  { code: "zh-tw", name: "Tiếng Trung (Phồn thể)", nativeName: "繁體中文", voiceLang: "zh-TW" },
  { code: "zh-hans", name: "Tiếng Trung (Giản thể)", nativeName: "简体中文", voiceLang: "zh-CN" },
  { code: "en", name: "Tiếng Anh", nativeName: "English", voiceLang: "en-US" },
  { code: "ja", name: "Tiếng Nhật", nativeName: "日本語", voiceLang: "ja-JP" },
  { code: "ko", name: "Tiếng Hàn", nativeName: "한국어", voiceLang: "ko-KR" },
  { code: "fr", name: "Tiếng Pháp", nativeName: "Français", voiceLang: "fr-FR" },
  { code: "de", name: "Tiếng Đức", nativeName: "Deutsch", voiceLang: "de-DE" },
];

export function getLanguageName(code: string): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code.toLowerCase() === code.toLowerCase());
  return lang ? lang.name : code;
}

export function speakText(htmlContent: string, langCode: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  // Stop any ongoing speech
  window.speechSynthesis.cancel();

  // Strip HTML tags for clean reading
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = htmlContent;
  const plainText = tempDiv.textContent || tempDiv.innerText || "";

  if (!plainText.trim()) return;

  const utterance = new SpeechSynthesisUtterance(plainText);

  // Find voice setting
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code.toLowerCase() === langCode.toLowerCase());
  if (lang?.voiceLang) {
    utterance.lang = lang.voiceLang;
  } else {
    utterance.lang = langCode;
  }

  window.speechSynthesis.speak(utterance);
}
