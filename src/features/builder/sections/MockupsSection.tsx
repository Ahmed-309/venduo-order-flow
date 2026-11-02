'use client';

import { useState } from 'react';
import { validateMockupFile, type MockupSide } from '@/domain/techPack';
import { MockupPicture } from '@/features/shared/MockupPicture';
import { useServices } from '@/features/shared/RepositoryProvider';
import styles from '../builder.module.css';
import type { SectionProps } from './types';

const SIDES: { side: MockupSide; label: string }[] = [
  { side: 'front', label: 'Front' },
  { side: 'back', label: 'Back' },
];

export function MockupsSection({ pack, category, readOnly, onChange }: SectionProps) {
  const { repository } = useServices();
  const [errors, setErrors] = useState<Partial<Record<MockupSide, string>>>({});
  const [uploading, setUploading] = useState<MockupSide | null>(null);

  async function upload(side: MockupSide, file: File) {
    const problem = validateMockupFile(file);
    setErrors((current) => ({ ...current, [side]: problem ?? undefined }));
    if (problem) return;

    setUploading(side);
    try {
      const assetId = await repository.saveAsset(file);
      onChange((current) => ({
        ...current,
        mockups: { ...current.mockups, [side]: { source: 'upload', assetId, fileName: file.name } },
      }));
    } catch {
      setErrors((current) => ({ ...current, [side]: "We couldn't store that image. Try again." }));
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="stack-16">
      <p className="meta">The front appears as the thumbnail everywhere else. PNG, JPEG or WebP, up to 5 MB.</p>
      <div className={styles.mockups}>
        {SIDES.map(({ side, label }) => {
          const image = pack.mockups[side];
          const error = errors[side];
          return (
            <div key={side} className="stack-8">
              <MockupPicture
                className={styles.mockup}
                image={image}
                side={side}
                category={category}
                alt={`${label} mockup`}
              />
              <p className="meta">
                {label}: {image.source === 'default' ? 'Default sketch' : image.fileName}
              </p>
              {readOnly ? null : (
                <div className="row-8">
                  <label className={`btn btn-secondary ${styles.fileButton}`}>
                    {uploading === side ? 'Uploading' : `Replace ${label.toLowerCase()}`}
                    <input
                      className="visually-hidden"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={uploading !== null}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = '';
                        if (file) void upload(side, file);
                      }}
                    />
                  </label>
                  {image.source === 'upload' ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => onChange({ ...pack, mockups: { ...pack.mockups, [side]: { source: 'default' } } })}
                    >
                      Use default sketch
                    </button>
                  ) : null}
                </div>
              )}
              {error ? (
                <p className="field-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
