export const sizeFormate = (bytes) => {
  if (typeof bytes === 'number') return bytes;
  return 0;
};

export const formatPlayTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return 0;
  return Math.floor(seconds);
};
