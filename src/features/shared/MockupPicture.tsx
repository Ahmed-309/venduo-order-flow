'use client';

import { useEffect, useState } from 'react';
import type { Category } from '@/domain/catalogue/types';
import type { MockupImage, MockupSide } from '@/domain/techPack';
import { useServices } from './RepositoryProvider';

/** Resolves a stored upload to an object URL, and releases it when no longer shown. */
function useAssetUrl(assetId: string | null): string | null {
  const { repository } = useServices();
  const [loaded, setLoaded] = useState<{ assetId: string; url: string } | null>(null);

  useEffect(() => {
    if (!assetId) return;
    let url: string | null = null;
    let isCurrent = true;
    repository.getAsset(assetId).then(
      (blob) => {
        if (!isCurrent || !blob) return;
        url = URL.createObjectURL(blob);
        setLoaded({ assetId, url });
      },
      () => undefined, // The alt text stands in for an image that fails to load.
    );
    return () => {
      isCurrent = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [assetId, repository]);

  return loaded && loaded.assetId === assetId ? loaded.url : null;
}

interface MockupPictureProps {
  image: MockupImage;
  side: MockupSide;
  category: Category;
  alt: string;
  className?: string;
}

export function MockupPicture({ image, side, category, alt, className }: MockupPictureProps) {
  const uploadUrl = useAssetUrl(image.source === 'upload' ? image.assetId : null);
  const src = image.source === 'default' ? category.sketches[side] : uploadUrl;
  if (!src) return <div className={`${className ?? ''} skeleton`} role="img" aria-label={alt} />;
  return <img className={className} src={src} alt={alt} />;
}
