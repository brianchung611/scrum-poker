import type { CardValue, Player, RoomPhase, VoteStats } from '@scrum-poker/shared';
import { useTranslation } from 'react-i18next';

interface Props {
  players: Player[];
  myId: string;
  /** When set, a remove button is shown on every other participant. */
  onKick?: (player: Player) => void;
  /** When set, a "make facilitator" button is shown on every other participant. */
  onTransfer?: (player: Player) => void;
  phase: RoomPhase;
  votes?: Record<string, CardValue>;
  stats?: VoteStats;
}

const NUMERIC = /^\d+(\.\d+)?$/;

export function ParticipantList({
  players,
  myId,
  onKick,
  onTransfer,
  phase,
  votes,
  stats,
}: Props) {
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
              {player.isObserver && <span className="badge badge-observer">{t('observer')}</span>}
              {player.id === myId && <span className="badge badge-muted">{t('you')}</span>}
              {onTransfer && player.id !== myId && (
                <button
                  type="button"
                  className="kick"
                  aria-label={t('makeFacilitator', { name: player.displayName })}
                  title={t('makeFacilitator', { name: player.displayName })}
                  onClick={() => onTransfer(player)}
                >
                  ★
                </button>
              )}
              {onKick && player.id !== myId && (
                <button
                  type="button"
                  className="kick"
                  aria-label={t('kick', { name: player.displayName })}
                  title={t('kick', { name: player.displayName })}
                  onClick={() => onKick(player)}
                >
                  ✕
                </button>
              )}
              <span className="vote-slot">
                {player.isObserver ? null : player.hasVoted ? (
                  // One element across the reveal so the face-down card animates into the value.
                  // The value is only rendered once the server has revealed it.
                  <span
                    className={`flip${revealed ? ' flipped' : ''}${outlier ? ' outlier' : ''}${(value?.length ?? 0) > 2 ? ' flip-long' : ''}`}
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
