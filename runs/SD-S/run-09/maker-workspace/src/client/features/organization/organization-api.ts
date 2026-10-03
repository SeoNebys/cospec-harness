import type { Folder, Tag } from "../../../shared/contracts/organization.js";
import { api } from "../../lib/api.js";

export const organizationApi = {
  folders: () => api<Folder[]>("/folders"), tags: () => api<Tag[]>("/tags"),
  create: (kind: "folders"|"tags", name: string) => api<Folder|Tag>(`/${kind}`, {method:"POST",body:JSON.stringify({name})}),
  rename: (kind: "folders"|"tags", id: number, name: string) => api(`/${kind}/${id}`, {method:"PATCH",body:JSON.stringify({name})}),
  remove: (kind: "folders"|"tags", id: number) => api<void>(`/${kind}/${id}`, {method:"DELETE",body:"{}"})
};
