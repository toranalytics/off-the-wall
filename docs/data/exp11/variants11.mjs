// The only file this experiment edits. collapse: null (current selector) or a cosine threshold on quote text.
export const VARIANTS = {
  C0: { note: 'current main', collapse: null },
  C1: { note: 'collapse families by quote similarity 0.50', collapse: 0.5 },
  C2: { note: 'collapse families by quote similarity 0.35', collapse: 0.35 },
  C3: { note: 'collapse families by quote similarity 0.70', collapse: 0.7 },
}
