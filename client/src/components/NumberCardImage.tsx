import { getCardImageUrl } from "../utils/cards";

interface NumberCardImageProps {
  value: number;
}

export function NumberCardImage({ value }: NumberCardImageProps) {
  const src = getCardImageUrl(value);
  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      className="number-card-img"
      width={140}
      height={196}
      loading="lazy"
      decoding="async"
    />
  );
}
