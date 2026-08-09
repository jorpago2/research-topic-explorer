import { useQuery } from "@tanstack/react-query";
import { InlineLoading, InlineNotification, Modal, Tag } from "@carbon/react";
import { loadTopicEvidence } from "../features/topic-ranking/evidence";
import type { AnalysisResult, TopicDetails, TopicRankingRow } from "../types/domain";

interface TopicDetailDialogProps {
  topic: TopicRankingRow | null;
  analysis: AnalysisResult | null;
  details?: TopicDetails;
  onClose: () => void;
}

export function TopicDetailDialog({ topic, analysis, details, onClose }: TopicDetailDialogProps) {
  const evidence = useQuery({
    queryKey: ["topic-evidence", analysis?.metadata.generatedAt, topic?.topicId],
    queryFn: ({ signal }) => loadTopicEvidence(analysis!, topic!.topicId, signal),
    enabled: Boolean(topic && analysis),
    staleTime: 24 * 60 * 60_000,
  });
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
          <section className="rte-topic-evidence" aria-labelledby="topic-evidence-heading">
            <h3 id="topic-evidence-heading">Evidence publications</h3>
            <p>Most-cited publications in the selected corpus whose OpenAlex primary topic is this Topic. Citations select the examples but do not affect the topic ranking.</p>
            {evidence.isPending ? <InlineLoading description="Loading evidence publications…" /> : evidence.isError ? <InlineNotification kind="error" lowContrast hideCloseButton title="Evidence unavailable" subtitle={evidence.error.message} /> : evidence.data?.works.length ? (
              <ol className="rte-evidence-list">
                {evidence.data.works.map((work) => (
                  <li key={work.id}>
                    <a href={work.doi ?? `https://openalex.org/${work.id}`} target="_blank" rel="noreferrer">{work.title}</a>
                    <p>{work.source?.displayName ?? "Source unavailable"} · {work.publicationYear} · {work.citedByCount.toLocaleString()} OpenAlex citations</p>
                    {work.primaryTopic && work.primaryTopic.score !== null ? <p>Primary-topic score: {(work.primaryTopic.score * 100).toFixed(1)}%</p> : null}
                  </li>
                ))}
              </ol>
            ) : <p>No matching evidence publications were returned.</p>}
          </section>
        </div>
      ) : null}
    </Modal>
  );
}
