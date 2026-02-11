import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Attachment } from "../types";
import { AtSign, Bold, EyeOff, Paperclip, SendHorizontal } from "lucide-react";

interface MessageComposerProps {
  replyToId: string | null;
  onClearReply: () => void;
  onSend: (payload: { body: string; attachments?: Attachment[] }) => void;
  placeholder?: string;
  enterToSend?: boolean;
  focusSignal?: number;
  spellCheckEnabled?: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 9);

export const MessageComposer = ({
  replyToId,
  onClearReply,
  onSend,
  placeholder,
  enterToSend = true,
  focusSignal,
  spellCheckEnabled = true
}: MessageComposerProps) => {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resizeTextarea = (node: HTMLTextAreaElement | null) => {
    if (!node) return;
    node.style.height = "0px";
    const nextHeight = Math.min(Math.max(node.scrollHeight, 22), 180);
    node.style.height = `${nextHeight}px`;
  };

  useEffect(() => {
    if (typeof focusSignal !== "number") return;
    textareaRef.current?.focus();
    resizeTextarea(textareaRef.current);
  }, [focusSignal]);

  useEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [value]);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: Attachment[] = Array.from(files).map((file) => ({
      id: uid(),
      name: file.name,
      type: file.type.startsWith("image/") ? "image" : "file",
      size: file.size,
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      file
    }));
    setAttachments((state) => [...state, ...next]);
  };

  const handleSend = () => {
    if (!value.trim() && attachments.length === 0) return;
    onSend({ body: value.trim() || "(attachment)", attachments });
    setValue("");
    setAttachments([]);
    resizeTextarea(textareaRef.current);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;
    if (event.nativeEvent.isComposing || isComposing) return;

    if (enterToSend) {
      if (event.shiftKey) return;
      event.preventDefault();
      handleSend();
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="composer">
      {replyToId && (
        <div className="composer-reply">
          Replying to message {replyToId.slice(0, 4)}
          <button onClick={onClearReply}>Dismiss</button>
        </div>
      )}

      <div className="composer-input">
        <div className="composer-shell">
          <button
            className="composer-icon composer-icon-attach"
            aria-label="Attach"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip size={14} strokeWidth={1.9} aria-hidden="true" />
          </button>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              resizeTextarea(event.currentTarget);
            }}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={placeholder ?? "Message"}
            rows={1}
            spellCheck={spellCheckEnabled}
          />
          <div className="composer-actions">
            <button
              className="composer-icon composer-icon-glyph"
              aria-label="Bold"
              onClick={() => setValue((state) => `${state}**bold**`)}
            >
              <Bold size={15} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <button
              className="composer-icon composer-icon-glyph"
              aria-label="Spoiler"
              onClick={() => setValue((state) => `${state}||spoiler||`)}
            >
              <EyeOff size={15} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <button
              className="composer-icon composer-icon-glyph"
              aria-label="@mention"
              onClick={() => setValue((state) => `${state}@nyte `)}
            >
              <AtSign size={15} strokeWidth={1.9} aria-hidden="true" />
            </button>
            <button className="composer-icon composer-icon-send" aria-label="Send" onClick={handleSend}>
              <SendHorizontal size={14} strokeWidth={1.9} aria-hidden="true" />
            </button>
          </div>
        </div>
        <p className="composer-hint">
          {enterToSend ? "Enter to send, Shift+Enter for newline" : "Ctrl/Cmd+Enter to send"}
        </p>
      </div>

      {attachments.length > 0 && (
        <div className="composer-attachments">
          {attachments.map((file) => (
            <div key={file.id} className="attachment">
              {file.type === "image" && file.url ? (
                <img src={file.url} alt={file.name} />
              ) : (
                <div className="file-icon">FILE</div>
              )}
              <div>
                <p>{file.name}</p>
                <span>{Math.round(file.size / 1024)}kb</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => handleFiles(event.target.files)}
      />
    </div>
  );
};
