import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { TopicDetails, TopicRankingRow } from "../types/domain";

interface TopicDetailDialogProps {
  topic: TopicRankingRow | null;
  details?: TopicDetails;
  onClose: () => void;
}

export function TopicDetailDialog({ topic, details, onClose }: TopicDetailDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (topic && dialog && !dialog.open) dialog.showModal();
    if (!topic && dialog?.open) dialog.close();
  }, [topic]);
  return (
    <dialog
      ref={dialogRef}
      className="topic-dialog"
      onClose={onClose}
      onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}
      aria-labelledby="topic-dialog-title"
    >
      {topic ? (
        <div className="topic-dialog-content">
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close topic details"><X size={20} /></button>
          <p className="topic-id">{topic.topicId}</p>
          <h2 id="topic-dialog-title">{topic.name}</h2>
          <dl className="topic-stat-grid">
            <div><dt>Rank</dt><dd>{topic.rank}</dd></div>
            <div><dt>Documents</dt><dd>{topic.count.toLocaleString()}</dd></div>
            <div><dt>Share</dt><dd>{(topic.share * 100).toFixed(2)}%</dd></div>
          </dl>
          <dl className="hierarchy-list">
            <div><dt>Domain</dt><dd>{details?.domain?.displayName ?? "Not loaded"}</dd></div>
            <div><dt>Field</dt><dd>{details?.field?.displayName ?? "Not loaded"}</dd></div>
            <div><dt>Subfield</dt><dd>{details?.subfield?.displayName ?? "Not loaded"}</dd></div>
          </dl>
          {details?.description ? <p className="topic-description">{details.description}</p> : null}
          {details?.keywords.length ? <div className="keyword-list" aria-label="Topic keywords">{details.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div> : null}
        </div>
      ) : null}
    </dialog>
  );
}
