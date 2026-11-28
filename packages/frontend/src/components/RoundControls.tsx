import type { RoomState } from '@scrum-poker/shared';
import { useTranslation } from 'react-i18next';
import { resetRound, revealVotes } from '../store/useRoomStore';

export function RoundControls({ room }: { room: RoomState }) {
  const { t } = useTranslation('game');
  const isFacilitator = room.facilitatorId === room.myId;
  const voted = room.players.filter((p) => p.hasVoted).length;
  const revealed = room.phase === 'revealed';

  return (
    <section className="panel controls" aria-live="polite">
      <p className="controls-status">
        {revealed
          ? t('roundRevealed')
          : t('waitingForVotes', { count: voted, total: room.players.length })}
      </p>
      {isFacilitator &&
        (revealed ? (
          <button type="button" className="primary" onClick={resetRound}>
            {t('resetButton')}
          </button>
        ) : (
          <button type="button" className="primary" disabled={voted === 0} onClick={revealVotes}>
            {t('revealButton')}
          </button>
        ))}
    </section>
  );
}
