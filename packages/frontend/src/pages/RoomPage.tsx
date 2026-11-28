import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { NameForm } from '../components/NameForm';
import { ParticipantList } from '../components/ParticipantList';
import { getStoredDisplayName, storeDisplayName } from '../session';
import { joinRoom, useRoomStore } from '../store/useRoomStore';

export default function RoomPage() {
  const { t } = useTranslation(['game', 'common']);
  const roomCode = (useParams().code ?? '').toUpperCase();
  const [displayName, setDisplayName] = useState(getStoredDisplayName);
  const [copied, setCopied] = useState(false);
  const { room, connected, error } = useRoomStore();

  // Joins on mount and whenever the code or name changes; cleanup leaves the room.
  useEffect(() => {
    if (!displayName) return;
    return joinRoom(roomCode, displayName);
  }, [roomCode, displayName]);

  if (!displayName) {
    // Opened via a shared link (or a fresh tab): ask for a name first.
    return (
      <div className="centered">
        <NameForm
          title={t('game:enterNameTitle', { code: roomCode })}
          submitLabel={t('common:join')}
          onSubmit={(name) => {
            storeDisplayName(name);
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
      <ParticipantList players={room.players} myId={room.myId} />
    </div>
  );
}
