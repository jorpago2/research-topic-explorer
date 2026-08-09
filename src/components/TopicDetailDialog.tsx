import { Modal, Tag } from "@carbon/react";
import type { TopicDetails, TopicRankingRow } from "../types/domain";

interface TopicDetailDialogProps {
  topic: TopicRankingRow | null;
  details?: TopicDetails;
  onClose: () => void;
}

export function TopicDetailDialog({ topic, details, onClose }: TopicDetailDialogProps) {
  return (
    <Modal open={Boolean(topic)} passiveModal size="md" modalLabel={topic?.topicId} modalHeading={topic?.name ?? "Topic details"} onRequestClose={onClose}>
      {topic ? (
        <div className="rte-topic-modal">
          <dl className="rte-topic-metrics">
            <div><dt>Rank</dt><dd>{topic.rank}</dd></div>
            <div><dt>Documents</dt><dd>{topic.count.toLocaleString()}</dd></div>
            <div><dt>Share</dt><dd>{(topic.share * 100).toFixed(2)}%</dd></div>
          </dl>
          <dl className="rte-topic-hierarchy">
            <div><dt>Domain</dt><dd>{details?.domain?.displayName ?? "Not loaded"}</dd></div>
            <div><dt>Field</dt><dd>{details?.field?.displayName ?? "Not loaded"}</dd></div>
            <div><dt>Subfield</dt><dd>{details?.subfield?.displayName ?? "Not loaded"}</dd></div>
          </dl>
          {details?.description ? <p>{details.description}</p> : null}
          {details?.keywords.length ? <div className="rte-keywords" aria-label="Topic keywords">{details.keywords.map((keyword) => <Tag key={keyword}>{keyword}</Tag>)}</div> : null}
        </div>
      ) : null}
    </Modal>
  );
}
