import { useState } from "react";

// EvidenceForm (B4: { onSubmit(title, description, fileName, fileText) }) —
// SPEC 8.5 "Add evidence" form. The page owns the file read (readFileAsText) so
// this stays presentational; the submit callback receives the plain values.
export default function EvidenceForm({ onSubmit }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(title.trim(), description.trim(), file ? file.name || "" : "", file);
  };

  return (
    <form onSubmit={submit} className="space-y-2 bg-[#0f0b1a] border border-[#3a2f5a] rounded-xl p-3">
      <div className="text-sm font-medium text-gray-200">Add evidence</div>
      <input
        className="w-full min-h-[44px] rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3 text-sm"
        placeholder="Title (required)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="w-full rounded-lg bg-[#0f0b1a] border border-[#3a2f5a] px-3 py-2 min-h-[64px] text-sm"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-300 min-h-[44px]">
          <input type="file" onChange={(e) => setFile(e.target.files && e.target.files[0])} />
        </label>
        <button className="min-h-[44px] rounded-lg bg-[#8b5cf6] px-4 text-white text-sm" type="submit">
          Submit evidence
        </button>
      </div>
    </form>
  );
}