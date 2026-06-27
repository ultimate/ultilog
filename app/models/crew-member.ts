export type CrewMember = {
  id: string;
  name: string;
  nationality: string;
  role: string;
  address?: string;
  certificate?: string;
  isPrimary?: boolean;
};

export type SheetCrewMember = CrewMember & {
  embarkation: string;
  disembarkation: string;
};
