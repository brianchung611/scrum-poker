import { ROOM_CODE_LENGTH } from '@scrum-poker/shared';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../api';
import {
  customCardsOf,
  DEFAULT_DECK_CHOICE,
  DeckPicker,
  isDeckChoiceValid,
  type DeckChoice,
} from '../components/DeckPicker';
import { NameForm } from '../components/NameForm';
import {
  getStoredDisplayName,
  getStoredObserver,
  storeDisplayName,
  storeObserver,
} from '../session';

export default function HomePage() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deck, setDeck] = useState<DeckChoice>(DEFAULT_DECK_CHOICE);
  const [code, setCode] = useState('');
  const codeId = useId();
  const initialName = getStoredDisplayName();
  const initialObserver = getStoredObserver();

  const handleCreate = async (displayName: string, observer: boolean) => {
    setCreating(true);
    setCreateError(null);
    try {
      const { roomCode } = await createRoom({
        deckId: deck.deckId,
        customCards: deck.deckId === 'custom' ? (customCardsOf(deck) ?? undefined) : undefined,
      });
      storeDisplayName(displayName);
      storeObserver(observer);
      navigate(`/room/${roomCode}`);
    } catch {
      setCreateError(t('createFailed'));
      setCreating(false);
    }
  };

  const handleJoin = (displayName: string, observer: boolean) => {
    storeDisplayName(displayName);
    storeObserver(observer);
    navigate(`/room/${code.trim().toUpperCase()}`);
  };

  return (
    <div className="home">
      <div className="hero">
        <h1>{t('appName')}</h1>
        <p>{t('tagline')}</p>
      </div>
      <div className="home-forms">
        <NameForm
          title={t('createRoom')}
          hint={t('createRoomHint')}
          submitLabel={t('start')}
          busy={creating || !isDeckChoiceValid(deck)}
          error={createError}
          initialName={initialName}
          allowObserver
          initialObserver={initialObserver}
          onSubmit={handleCreate}
        >
          <DeckPicker value={deck} onChange={setDeck} />
        </NameForm>
        <NameForm
          title={t('joinRoom')}
          hint={t('joinRoomHint')}
          submitLabel={t('join')}
          busy={!code.trim()}
          initialName={initialName}
          allowObserver
          initialObserver={initialObserver}
          onSubmit={handleJoin}
        >
          <label htmlFor={codeId}>{t('roomCode')}</label>
          <input
            id={codeId}
            value={code}
            maxLength={ROOM_CODE_LENGTH}
            placeholder={t('roomCodePlaceholder')}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            required
          />
        </NameForm>
      </div>
    </div>
  );
}
