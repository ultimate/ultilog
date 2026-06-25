export type BoatType = "Sail" | "Motor";

export type Boat = {
  id: string;
  name: string;
  type: BoatType;
  registration: string;
  flagState: string;
  homePort: string;
  owner: string;
  dimensions: string;
  yachtData: Record<string, string>;
};
