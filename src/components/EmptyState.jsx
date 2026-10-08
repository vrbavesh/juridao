export default function EmptyState({ text = "Nothing here yet" }) {
  return <div className="rounded-xl border border-dashed border-[#3a2f5a] p-8 text-center text-sm text-gray-400">{text}</div>;
}
