import type { Player } from '@scrum-poker/shared';
import { useTranslation } from 'react-i18next';

interface Props {
  players: Player[];
  myId: string;
}

export function ParticipantList({ players, myId }: Props) {
  const { t } = useTranslation('game');

  return (
    <section aria-labelledby="participants-heading" className="panel">
      <h2 id="participants-heading">{t('participants', { count: players.length })}</h2>
      <ul className="participants">
        {players.map((player) => (
          <li key={player.id} className="participant">
            <span className="participant-name">{player.displayName}</span>
            {player.isFacilitator && <span className="badge">{t('facilitator')}</span>}
            {player.id === myId && <span className="badge badge-muted">{t('you')}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
