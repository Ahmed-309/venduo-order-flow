import { DESCRIPTION_MAX_LENGTH } from '@/domain/techPack';
import type { SectionProps } from './types';

export function DetailsSection({ pack, readOnly, onChange }: SectionProps) {
  return (
    <div className="stack-16">
      <label className="field">
        <span className="label">Name</span>
        <input
          className="input"
          value={pack.name}
          disabled={readOnly}
          placeholder="For example, Campus hoodie"
          onChange={(event) => onChange({ ...pack, name: event.target.value }, { debounce: true })}
        />
      </label>
      <label className="field">
        <span className="label">Short description</span>
        <textarea
          className="input"
          value={pack.description}
          disabled={readOnly}
          maxLength={DESCRIPTION_MAX_LENGTH}
          placeholder="What makes this garment what it is"
          aria-describedby="description-count"
          onChange={(event) => onChange({ ...pack, description: event.target.value }, { debounce: true })}
        />
        <span id="description-count" className="meta tabular">
          {pack.description.length} of {DESCRIPTION_MAX_LENGTH} characters
        </span>
      </label>
    </div>
  );
}
