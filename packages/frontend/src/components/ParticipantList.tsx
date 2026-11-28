import type { CardValue, Player, RoomPhase, VoteStats } from '@scrum-poker/shared';
import { useTranslation } from 'react-i18next';

interface Props {
  players: Player[];
  myId: string;
  phase: RoomPhase;
  votes?: Record<string, CardValue>;
  stats?: VoteStats;
}

const NUMERIC = /^\d+(\.\d+)?$/;

export function ParticipantList({ players, myId, phase, votes, stats }: Props) {
  const { t } = useTranslation('game');
  const revealed = phase === 'revealed';

  // The highest and lowest votes are flagged to prompt discussion, but only when
  // at least three numeric votes were cast and they actually disagree.
  const numericCount = Object.values(votes ?? {}).filter((v) => NUMERIC.test(v)).length;
  const isOutlier = (value: CardValue | undefined) =>
    value !== undefined &&
    NUMERIC.test(value) &&
    numericCount >= 3 &&
    stats?.min != null &&
    stats.max !== stats.min &&
    (Number(value) === stats.min || Number(value) === stats.max);

  return (
    <section aria-labelledby="participants-heading" className="panel">
      <h2 id="participants-heading">{t('participants', { count: players.length })}</h2>
      <ul className="participants">
        {players.map((player) => {
          const value = revealed ? votes?.[player.id] : undefined;
          const outlier = isOutlier(value);
          return (
            <li key={player.id} className="participant">
              <span className="participant-name">{player.displayName}</span>
              {player.isFacilitator && <span className="badge">{t('facilitator')}</span>}
              {player.id === myId && <span className="badge badge-muted">{t('you')}</span>}
              <span className="vote-slot">
                {player.hasVoted ? (
                  // One element across the reveal so the face-down card animates into the value.
                  // The value is only rendered once the server has revealed it.
                  <span
                    className={`flip${revealed ? ' flipped' : ''}${outlier ? ' outlier' : ''}`}
                    role="img"
                    aria-label={
                      revealed && value !== undefined
                        ? `${value}${outlier ? ` (${t('outlier')})` : ''}`
                        : t('voted')
                    }
                  >
                    <span className="flip-inner">
                      <span className="face back" aria-hidden="true">
                        ✓
                      </span>
                      <span className="face front" aria-hidden="true">
                        {value}
                      </span>
                    </span>
                  </span>
                ) : (
                  <span className="flip empty" role="img" aria-label={revealed ? t('noVote') : t('notVotedYet')}>
                    <span className="face" aria-hidden="true">
                      {revealed ? '–' : '…'}
                    </span>
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
