import { useState, useCallback } from "react";

interface UseAutocompleteOptions {
  text: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  vocabulary: string[];
  onTextChange: (newText: string) => void;
}

interface UseAutocompleteResult {
  acVisible: boolean;
  acItems: string[];
  acIndex: number;
  acPos: { top: number; left: number };
  setAcVisible: (v: boolean) => void;
  updateAutocomplete: () => void;
  applyAutocomplete: (name: string) => void;
  handleAutocompleteKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
}

export function useAutocomplete({ text, textareaRef, vocabulary, onTextChange }: UseAutocompleteOptions): UseAutocompleteResult {
  const [acVisible, setAcVisible] = useState(false);
  const [acItems, setAcItems] = useState<string[]>([]);
  const [acIndex, setAcIndex] = useState(0);
  const [acPos, setAcPos] = useState({ top: 0, left: 0 });

  const getWordAtCursor = useCallback((): { word: string; start: number; end: number } | null => {
    const ta = textareaRef.current;
    if (!ta) return null;
    const pos = ta.selectionStart;
    const before = text.substring(0, pos);
    const match = before.match(/[A-Za-z][\w\s-]*$/);
    if (!match) return null;
    return { word: match[0], start: pos - match[0].length, end: pos };
  }, [text, textareaRef]);

  const updateAutocomplete = useCallback(() => {
    const wordInfo = getWordAtCursor();
    if (!wordInfo || wordInfo.word.length < 2) {
      setAcVisible(false);
      return;
    }
    const prefix = wordInfo.word.toLowerCase();
    const matches = vocabulary.filter((name) =>
      name.toLowerCase().startsWith(prefix) && name.toLowerCase() !== prefix,
    ).slice(0, 8);
    if (matches.length === 0) {
      setAcVisible(false);
      return;
    }
    setAcItems(matches);
    setAcIndex(0);
    const ta = textareaRef.current;
    if (ta) {
      const rect = ta.getBoundingClientRect();
      const lines = text.substring(0, ta.selectionStart).split("\n");
      const lineIdx = lines.length - 1;
      const lineHeight = 16;
      setAcPos({
        top: rect.top + (lineIdx * lineHeight) - ta.scrollTop + lineHeight + 4,
        left: rect.left + 8,
      });
    }
    setAcVisible(true);
  }, [getWordAtCursor, vocabulary, text, textareaRef]);

  const applyAutocomplete = useCallback((name: string) => {
    const wordInfo = getWordAtCursor();
    if (!wordInfo) return;
    const newText = text.substring(0, wordInfo.start) + name + text.substring(wordInfo.end);
    onTextChange(newText);
    setAcVisible(false);
    const newPos = wordInfo.start + name.length;
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    });
  }, [text, getWordAtCursor, onTextChange, textareaRef]);

  /** Returns true if the key event was consumed by autocomplete */
  const handleAutocompleteKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!acVisible) return false;
    if (e.key === "ArrowDown") { e.preventDefault(); setAcIndex((i) => Math.min(i + 1, acItems.length - 1)); return true; }
    if (e.key === "ArrowUp") { e.preventDefault(); setAcIndex((i) => Math.max(i - 1, 0)); return true; }
    if (e.key === "Enter" || e.key === "Tab") {
      if (acItems[acIndex]) { e.preventDefault(); applyAutocomplete(acItems[acIndex]!); return true; }
    }
    if (e.key === "Escape") { e.preventDefault(); setAcVisible(false); return true; }
    return false;
  }, [acVisible, acItems, acIndex, applyAutocomplete]);

  return { acVisible, acItems, acIndex, acPos, setAcVisible, updateAutocomplete, applyAutocomplete, handleAutocompleteKeyDown };
}
