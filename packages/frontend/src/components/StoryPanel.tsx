import { MAX_STORY_LENGTH } from '@scrum-poker/shared';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { setStory } from '../store/useRoomStore';

interface Props {
  story: string;
  isFacilitator: boolean;
}

/** Shows what is being estimated; the facilitator can edit it. Hidden for others when empty. */
export function StoryPanel({ story, isFacilitator }: Props) {
  const { t } = useTranslation('game');
  const [draft, setDraft] = useState(story);
  const inputId = useId();

  // Follow changes from the server (new round clears it, or the facilitator role moved here).
  useEffect(() => setDraft(story), [story]);

  if (!isFacilitator) {
    return story ? (
      <section className="panel story" aria-label={t('story')}>
        <span className="muted">{t('story')}</span>
        <strong className="story-text">{story}</strong>
      </section>
    ) : null;
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setStory(draft);
  };

  return (
    <form className="panel story story-form" onSubmit={handleSubmit}>
      <label htmlFor={inputId}>{t('story')}</label>
      <div className="story-row">
        <input
          id={inputId}
          value={draft}
          maxLength={MAX_STORY_LENGTH}
          placeholder={t('storyPlaceholder')}
          onChange={(event) => setDraft(event.target.value)}
          autoComplete="off"
        />
        <button type="submit" disabled={draft.trim() === story}>
          {t('storySave')}
        </button>
      </div>
    </form>
  );
}
