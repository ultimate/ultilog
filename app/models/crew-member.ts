import type { StoredImage } from "./stored-image";

export type CrewMember = {
  revision?: number;
  createdAt?: string;
  updatedAt?: string;
  id: string;
  name: string;
  nationality: string;
  role: string;
  address?: string;
  certificate?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  gender?: string;
  identityDocumentType?: string;
  identityDocumentNumber?: string;
  identityDocumentIssuingDate?: string;
  identityDocumentExpiryDate?: string;
  isPrimary?: boolean;
  image?: StoredImage;
  imageId?: string;
};

export type SheetCrewMember = CrewMember & {
  embarkationDateTime: string;
  embarkationPosition: string;
  disembarkationDateTime: string;
  disembarkationPosition: string;
};
