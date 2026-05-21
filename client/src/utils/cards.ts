const imageModules = import.meta.glob<string>("../images/*.png", {
  eager: true,
  import: "default",
});

const cardImagesByNumber: Record<number, string> = {};

for (const [path, url] of Object.entries(imageModules)) {
  const match = path.match(/\/(\d{1,2})\.png$/);
  if (match) {
    const n = Number(match[1]);
    if (n >= 1 && n <= 12) {
      cardImagesByNumber[n] = url;
    }
  }
}

const MAX_CARD_NUMBER = 12;

export function getCardImageUrl(value: number): string {
  if (value < 1 || value > MAX_CARD_NUMBER) return "";
  return cardImagesByNumber[value] ?? "";
}
