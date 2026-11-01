import type { Catalogue, Category } from '@/domain/catalogue/types';
import type { TechPack } from '@/domain/techPack';

export interface SectionProps {
  pack: TechPack;
  catalogue: Catalogue;
  category: Category;
  readOnly: boolean;
  onChange: (next: TechPack, options?: { debounce?: boolean }) => void;
}
