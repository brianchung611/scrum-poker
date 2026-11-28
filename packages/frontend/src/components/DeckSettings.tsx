import type { CardValue, DeckId } from '@scrum-poker/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeDeck } from '../store/useRoomStore';
import {
  customCardsOf,
  DeckPicker,
  isDeckChoiceValid,
  type DeckChoice,
} from './DeckPicker';

/** Facilitator-only: switch the deck, which also starts a new round. */
export function DeckSettings({
  currentDeckId,
  currentCards,
}: {
  currentDeckId: DeckId;
  currentCards: CardValue[];
}) {
  const { t } = useTranslation('game');
  const [choice, setChoice] = useState<DeckChoice>({
    deckId: currentDeckId,
    customText: currentDeckId === 'custom' ? currentCards.join(', ') : '',
  });

  const apply = () => {
    const cards = customCardsOf(choice);
    if (cards === null) return;
    changeDeck(choice.deckId, choice.deckId === 'custom' ? cards : undefined);
  };

  return (
    <details className="deck-settings">
      <summary>{t('changeDeck')}</summary>
      <div className="form">
        <DeckPicker value={choice} onChange={setChoice} />
        <p className="muted">{t('changeDeckWarning')}</p>
        <button type="button" disabled={!isDeckChoiceValid(choice)} onClick={apply}>
          {t('applyDeck')}
        </button>
      </div>
    </details>
  );
}
