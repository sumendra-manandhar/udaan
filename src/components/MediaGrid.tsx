import { useState } from 'react';
import type { MediaRef } from '../db/types';
import { Icon } from './Icon';
import { Media } from './ui';

/** Thumbnails of photos and clips. Tapping one opens it full screen; an
 * optional remove button is shown while editing. */
export function MediaGrid({ media, onRemove }: { media: MediaRef[]; onRemove?: (path: string) => void }) {
  const [open, setOpen] = useState<MediaRef | null>(null);
  if (media.length === 0) return null;
  return (
    <>
      <div className="media-grid">
        {media.map((m) => (
          <div key={m.path} className="media-tile">
            <button type="button" className="media-open" aria-label={m.kind === 'video' ? 'Play clip' : 'View photo'} onClick={() => setOpen(m)}>
              <Media media={m} thumb />
              {m.kind === 'video' && (
                <span className="media-badge" aria-hidden="true"><Icon name="play" size={14} /></span>
              )}
            </button>
            {onRemove && (
              <button type="button" className="media-remove" aria-label="Remove" onClick={() => onRemove(m.path)}>
                <Icon name="close" size={14} strokeWidth={2.4} />
              </button>
            )}
          </div>
        ))}
      </div>
      {open && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={open.kind === 'video' ? 'Clip' : 'Photo'} onClick={() => setOpen(null)}>
          <button type="button" className="icon-btn glass lightbox-close" aria-label="Close" onClick={() => setOpen(null)}>
            <Icon name="close" />
          </button>
          <div onClick={(e) => e.stopPropagation()} className="lightbox-body">
            <Media media={open} autoPlay />
          </div>
        </div>
      )}
    </>
  );
}
