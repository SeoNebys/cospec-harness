import { z } from "zod";
import { codePointLength, normalizeDisplay } from "./common.js";

export function nameKey(value: string): string {
  return normalizeDisplay(value).toLocaleLowerCase("und");
}

function nameSchema(max: number, kind: string) {
  return z.string().transform(normalizeDisplay).refine(
    (value) => codePointLength(value) >= 1 && codePointLength(value) <= max,
    `${kind} name must be between 1 and ${max} characters`
  );
}

export const folderNameSchema = nameSchema(80, "Folder");
export const tagNameSchema = nameSchema(50, "Tag");
export const organizationNameInput = (kind: "folder" | "tag") =>
  z.object({ name: kind === "folder" ? folderNameSchema : tagNameSchema });
