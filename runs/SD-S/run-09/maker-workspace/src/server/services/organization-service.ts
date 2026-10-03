import { AppError } from "../api/errors.js";
import type { OrganizationRepository } from "../repositories/organization-repository.js";
import { nameKey } from "../../shared/validation/organization.js";

export class OrganizationService {
  constructor(private readonly repository: OrganizationRepository) {}
  create(kind: "folders" | "tags", userId: string, name: string) {
    try { return this.repository.create(kind, userId, name, nameKey(name)); }
    catch (error) {
      if (String(error).includes("UNIQUE")) throw new AppError(409, "NAME_CONFLICT", `That ${kind === "folders" ? "folder" : "tag"} already exists`);
      throw error;
    }
  }
  rename(kind: "folders" | "tags", userId: string, id: number, name: string): void {
    try {
      if (!this.repository.rename(kind, userId, id, name, nameKey(name))) throw new AppError(404, "NOT_FOUND", "Item not found");
    } catch (error) {
      if (String(error).includes("UNIQUE")) throw new AppError(409, "NAME_CONFLICT", "That name is already in use");
      throw error;
    }
  }
  delete(kind: "folders" | "tags", userId: string, id: number): void {
    if (!this.repository.delete(kind, userId, id)) throw new AppError(404, "NOT_FOUND", "Item not found");
  }
}
