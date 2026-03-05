export const sum = (left: number, right: number): number => left + right;

export const divide = (numerator: number, denominator: number): number => {
  if (denominator === 0) {
    throw new Error('Cannot divide by zero');
  }

  return numerator / denominator;
};
