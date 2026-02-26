export type AuthUser = {
  id: string;
  email: string;
  role: "admin" | "reseller";
  resellerId?: string;
};
