import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { CardDeck } from '../components/CardDeck';
import { DeckSettings } from '../components/DeckSettings';
import { NameForm } from '../components/NameForm';
import { ParticipantList } from '../components/ParticipantList';
import { RoundControls } from '../components/RoundControls';
import { StoryPanel } from '../components/StoryPanel';
import { TimerPanel } from '../components/TimerPanel';
import { VoteStats } from '../components/VoteStats';
import {
  getStoredDisplayName,
  getStoredObserver,
  storeDisplayName,
  storeObserver,
} from '../session';
import {
  castVote,
  joinRoom,
  kickParticipant,
  transferFacilitator,
  useRoomStore,
} from '../store/useRoomStore';

export default function RoomPage() {
  const { t } = useTranslation(['game', 'common']);
  const roomCode = (useParams().code ?? '').toUpperCase();
  const [displayName, setDisplayName] = useState(getStoredDisplayName);
  const [observer, setObserver] = useState(getStoredObserver);
  const [copied, setCopied] = useState(false);
  const { room, connected, error, notice, timerEndsAt } = useRoomStore();

  // Joins on mount and whenever the code or name changes; cleanup leaves the room.
  useEffect(() => {
    if (!displayName) return;
    return joinRoom(roomCode, displayName, observer);
  }, [roomCode, displayName, observer]);

  if (!displayName) {
    // Opened via a shared link (or a fresh tab): ask for a name first.
    return (
      <div className="centered">
        <NameForm
          title={t('game:enterNameTitle', { code: roomCode })}
          submitLabel={t('common:join')}
          allowObserver
          onSubmit={(name, asObserver) => {
            storeDisplayName(name);
            storeObserver(asObserver);
            setObserver(asObserver);
            setDisplayName(name);
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="centered">
        <div className="panel">
          <p role="alert" className="error">
            {t(`common:errors.${error}`, { defaultValue: t('common:errors.generic') })}
          </p>
          <Link to="/">{t('common:backHome')}</Link>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="centered">
        <p className="muted">{t('game:connecting')}</p>
      </div>
    );
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${room.roomCode}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the URL is still in the address bar.
    }
  };

  const isFacilitator = room.facilitatorId === room.myId;
  const me = room.players.find((p) => p.id === room.myId);
  const isObserver = me?.isObserver ?? false;

  return (
    <div className="room">
      {!connected && (
        <p role="status" className="banner">
          {t('game:reconnecting')}
        </p>
      )}
      <section className="panel room-info">
        <div>
          <span className="muted">{t('game:roomCodeLabel')}</span>
          <strong className="room-code">{room.roomCode}</strong>
        </div>
        <button type="button" onClick={copyLink}>
          {copied ? t('game:linkCopied') : t('game:copyLink')}
        </button>
      </section>
      {notice && (
        <p role="alert" className="banner banner-error">
          {t(`common:errors.${notice}`, { defaultValue: t('common:errors.generic') })}
        </p>
      )}
      <StoryPanel story={room.story} isFacilitator={isFacilitator} />
      <RoundControls room={room} />
      {room.phase === 'voting' && <TimerPanel endsAt={timerEndsAt} isFacilitator={isFacilitator} />}
      <section className="panel" aria-labelledby="deck-heading">
        <h2 id="deck-heading">{isObserver ? t('observing') : t('pickACard')}</h2>
        {isObserver && <p className="muted">{t('observerHint')}</p>}
        {isFacilitator && (
          <DeckSettings
            key={`${room.deckId}:${room.cards.join(',')}`}
            currentDeckId={room.deckId}
            currentCards={room.cards}
          />
        )}
        {!isObserver && (
          <CardDeck
            deck={room.cards}
            selected={room.myVote}
            disabled={room.phase === 'revealed'}
            onSelect={castVote}
          />
        )}
      </section>
      {room.phase === 'revealed' && room.stats && (
        <VoteStats stats={room.stats} cards={room.cards} votes={room.votes} />
      )}
      <ParticipantList
        players={room.players}
        myId={room.myId}
        onKick={
          isFacilitator
            ? (player) => {
                if (window.confirm(t('kickConfirm', { name: player.displayName }))) {
                  kickParticipant(player.id);
                }
              }
            : undefined
        }
        onTransfer={
          isFacilitator
            ? (player) => {
                if (window.confirm(t('transferConfirm', { name: player.displayName }))) {
                  transferFacilitator(player.id);
                }
              }
            : undefined
        }
        phase={room.phase}
        votes={room.votes}
        stats={room.stats}
      />
    </div>
  );
}
