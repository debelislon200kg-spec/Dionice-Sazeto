export type StorySentimentInput = {
  direction: 'positive' | 'negative' | 'mixed';
  pressure: string;
};

export type StorySentimentTone = 'positive' | 'positiveSoft' | 'negative' | 'warning' | 'neutral';

export function storySentimentTone(story: StorySentimentInput): StorySentimentTone {
  const pressure = story.pressure.toLocaleLowerCase('hr-HR');

  if (pressure.includes('neutral')) return 'neutral';
  if (story.direction === 'positive') {
    return pressure.includes('blag') ? 'positiveSoft' : 'positive';
  }
  if (story.direction === 'negative') {
    return pressure.includes('blag') ? 'warning' : 'negative';
  }
  if (pressure.includes('prema dolje')) return 'warning';
  return 'neutral';
}