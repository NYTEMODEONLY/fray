import { useRef, useState } from "react";
import { Attachment } from "../types";

interface MessageComposerProps {
  replyToId: string | null;
  onClearReply: () => void;
  onSend: (payload: { body: string; attachments?: Attachment[] }) => void;
  placeholder?: string;
}

const uid = () => Math.random().toString(36).slice(2, 9);

export const MessageComposer = ({
  replyToId,
  onClearReply,
  onSend,
  placeholder
}: MessageComposerProps) => {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder ?? "Message"}
          rows={3}
        />
        <div className="composer-actions">
          <button onClick={() => fileInputRef.current?.click()}>Attach</button>
          <button onClick={() => setValue((state) => `${state}**bold**`)}>Bold</button>
          <button onClick={() => setValue((state) => `${state}||spoiler||`)}>Spoiler</button>
          <button onClick={() => setValue((state) => `${state}@nyte `)}>@mention</button>
          <button className="primary" onClick={handleSend}>
            Send
          </button>
        </div>
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
