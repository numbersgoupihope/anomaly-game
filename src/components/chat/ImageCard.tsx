import type { ImageContent } from "@/lib/chat-script";

export default function ImageCard({ content }: { content: ImageContent }) {
  return (
    <div className="max-w-[85%] overflow-hidden rounded-lg border border-black/10 bg-[#fbfbf9] text-[#1a1a1a] shadow-lg shadow-black/30">
      {content.kind === "craigslist" ? (
        <div className="px-4 py-3">
          <p className="mb-2 text-[11px] font-bold tracking-tight text-[#5c1c6e]">
            craigslist
          </p>
          <p className="text-[15px] font-medium leading-snug text-[#0000cc]">
            {content.title}
          </p>
          <p className="mt-1 text-xs text-[#666]">{content.meta}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-[#222]">
            {content.body}
          </p>
        </div>
      ) : (
        <div className="px-4 py-3">
          <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold text-[#666]">
            <span className="rounded bg-[#ff4500] px-1 py-0.5 text-[10px] font-bold text-white">
              r/
            </span>
            {content.byline}
          </p>
          <p className="text-[15px] font-semibold leading-snug text-[#1a1a1a]">
            {content.title}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#222]">
            {content.body}
          </p>
          <div className="mt-3 border-l-2 border-[#ddd] pl-3">
            <p className="text-[11px] font-semibold text-[#0079d3]">
              {content.commentAuthor}
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-[#333]">
              {content.commentBody}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
