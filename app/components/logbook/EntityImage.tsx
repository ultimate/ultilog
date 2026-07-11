/* eslint-disable @next/next/no-img-element */
import type { StoredImage } from "../../models/logbook";

export type EntityImageType = "boat" | "crew" | "sheet";
export type EntityImageVariant = "thumb" | "list" | "preview" | "header";

export type EntityImagePayload = StoredImage | string | null | undefined;

type EntityImageProps = {
  image?: EntityImagePayload;
  entityType: EntityImageType;
  alt: string;
  variant?: EntityImageVariant;
  className?: string;
};

const fallbackIconByType: Record<EntityImageType, string> = {
  boat: "⛵",
  crew: "👤",
  sheet: "📘",
};

export function EntityImage({
  image,
  entityType,
  alt,
  variant = "thumb",
  className,
}: EntityImageProps) {
  const src = getImageSource(image);
  const classes = [
    "entity-image",
    `entity-image--${entityType}`,
    `entity-image--${variant}`,
    !src ? "entity-image--fallback" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (src) {
    return <img className={classes} src={src} alt={alt} />;
  }

  return (
    <span className={classes} role="img" aria-label={alt}>
      <span aria-hidden="true">{fallbackIconByType[entityType]}</span>
    </span>
  );
}

function getImageSource(image: EntityImagePayload) {
  if (!image) return null;
  if (typeof image === "string") return image.startsWith("data:") ? image : null;
  if (!image.data) return null;
  return image.data.startsWith("data:")
    ? image.data
    : `data:${image.mimeType};base64,${image.data}`;
}
