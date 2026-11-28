import type { CardValue } from '@scrum-poker/shared';
import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  deck: CardValue[];
  selected: CardValue | null;
  /** True once the round is revealed (votes are locked until a new round). */
  disabled: boolean;
  onSelect: (value: CardValue) => void;
}

export function CardDeck({ deck, selected, disabled, onSelect }: Props) {
  const { t } = useTranslation('game');
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const label = (value: CardValue) =>
    value === '☕' ? t('cardCoffee') : value === '?' ? t('cardUnsure') : value;

  // Every card is a normal tab stop; arrow keys are a shortcut to move focus along the deck.
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    buttons.current[(index + step + deck.length) % deck.length]?.focus();
  };

  return (
    <div className="deck" role="group" aria-label={t('cardDeck')}>
      {deck.map((value, index) => (
        <button
          key={value}
          ref={(el) => {
            buttons.current[index] = el;
          }}
          type="button"
          className={`card${selected === value ? ' card-selected' : ''}`}
          aria-pressed={selected === value}
          aria-label={label(value)}
          disabled={disabled}
          onClick={() => onSelect(value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
