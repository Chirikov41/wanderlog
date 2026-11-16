import type { CategoryId } from '../types'

export interface CategoryMeta {
  id: CategoryId
  label: string
  /** Solid colour used for pins, chips and charts. */
  colour: string
  /** Tinted background used behind the colour. */
  soft: string
}

/**
 * A deliberately small, travel-flavoured taxonomy. Keeping it fixed makes the
 * filter row predictable and gives the map pins a meaningful colour code.
 */
export const CATEGORIES: CategoryMeta[] = [
  { id: 'coast', label: 'Coast', colour: '#2f7f92', soft: '#dceef2' },
  { id: 'mountain', label: 'Mountain', colour: '#4b7a52', soft: '#e2efdf' },
  { id: 'city', label: 'City', colour: '#8a5a44', soft: '#f5e4da' },
  { id: 'food', label: 'Food', colour: '#b4762a', soft: '#f8ead2' },
  { id: 'culture', label: 'Culture', colour: '#7b5b9d', soft: '#ece4f5' },
  { id: 'wildlife', label: 'Wildlife', colour: '#3f7d6a', soft: '#def0ea' },
  { id: 'other', label: 'Other', colour: '#6b7268', soft: '#e8e8e2' },
]

export function categoryMeta(id: CategoryId): CategoryMeta {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[CATEGORIES.length - 1]
}
