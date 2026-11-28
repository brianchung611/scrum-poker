import {
  DECK_IDS,
  MAX_CARD_LENGTH,
  MAX_CUSTOM_CARDS,
  MIN_CUSTOM_CARDS,
  normalizeCustomCards,
  splitCustomCards,
  type CardValue,
  type DeckId,
} from '@scrum-poker/shared';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

export interface DeckChoice {
  deckId: DeckId;
  /** Raw text of the custom card list, e.g. "1, 2, 3, ?". */
  customText: string;
}

export const DEFAULT_DECK_CHOICE: DeckChoice = { deckId: 'fibonacci', customText: '' };

/** The custom cards if the choice is usable, otherwise null. Presets always have none. */
export function customCardsOf(choice: DeckChoice): CardValue[] | null {
  return choice.deckId === 'custom' ? normalizeCustomCards(splitCustomCards(choice.customText)) : [];
}

export function isDeckChoiceValid(choice: DeckChoice): boolean {
  return customCardsOf(choice) !== null;
}

interface Props {
  value: DeckChoice;
  onChange: (value: DeckChoice) => void;
}

export function DeckPicker({ value, onChange }: Props) {
  const { t } = useTranslation('common');
  const selectId = useId();
  const customId = useId();
  const hintId = useId();
  const invalid = value.deckId === 'custom' && value.customText.trim() !== '' && !isDeckChoiceValid(value);

  return (
    <>
      <label htmlFor={selectId}>{t('deck')}</label>
      <select
        id={selectId}
        value={value.deckId}
        onChange={(event) => onChange({ ...value, deckId: event.target.value as DeckId })}
      >
        {DECK_IDS.map((id) => (
          <option key={id} value={id}>
            {t(`decks.${id}`)}
          </option>
        ))}
      </select>
      {value.deckId === 'custom' && (
        <>
          <label htmlFor={customId}>{t('customCards')}</label>
          <input
            id={customId}
            value={value.customText}
            placeholder={t('customCardsPlaceholder')}
            onChange={(event) => onChange({ ...value, customText: event.target.value })}
            aria-describedby={hintId}
            aria-invalid={invalid}
            autoComplete="off"
            spellCheck={false}
          />
          <p id={hintId} className={invalid ? 'error' : 'muted'}>
            {t('customCardsHint', {
              min: MIN_CUSTOM_CARDS,
              max: MAX_CUSTOM_CARDS,
              length: MAX_CARD_LENGTH,
            })}
          </p>
        </>
      )}
    </>
  );
}
