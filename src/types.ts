export type Entity = { id: string; name: string; [key: string]: any };
export type Settings = {
  name: string;
  agencyCommission: number;
  monthlyTarget: number;
  meetingTarget: number;
  baseCurrency: string;
  eurUsd: number;
  usdClp: number;
  teamHours: number;
  roadmapStart: string;
  ratesDate: string;
};
export type State = {
  profiles: Entity[];
  quotes: Entity[];
  prospects: Entity[];
  initiatives: Entity[];
  tasks: Entity[];
  content: Entity[];
  partners: Entity[];
  projects: Entity[];
  activities: Entity[];
  offers: Entity[];
  team?: Entity[];
  settings: Settings;
};
export type Collection =
  | "quotes"
  | "profiles"
  | "prospects"
  | "initiatives"
  | "tasks"
  | "content"
  | "partners"
  | "projects"
  | "offers";
export type EditableCollection = Exclude<Collection, "quotes" | "profiles">;
export type User = { id: string; name: string; email: string; role: string };
export type View =
  | "Command Center"
  | "Roadmap"
  | "Mercados"
  | "Pipeline"
  | "Tareas"
  | "Servicios"
  | "Cotizador HH"
  | "Contenido"
  | "Alianzas"
  | "Métricas"
  | "Biblioteca"
  | "Configuración";
export type EditTarget = {
  collection: EditableCollection;
  item?: Entity;
  defaults?: Record<string, any>;
};
