import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client.js";
import { runMigrations } from "../../src/server/db/migrate.js";
import { BookmarkRepository } from "../../src/server/repositories/bookmark-repository.js";

describe("title source race", () => {
  it("never overwrites a user title with late page metadata", () => {
    const db=createDatabase(":memory:");runMigrations(db);db.prepare("INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt) VALUES('u','U','u@example.com',0,0,0)").run();
    const repo=new BookmarkRepository(db);const saved=repo.create("u",{url:"https://example.com",normalizedUrl:"https://example.com/",resolvedTitle:"example.com",titleSource:"fallback",metadataStatus:"pending",metadataFailureCode:null,iconAssetId:null,finalMetadataUrl:null,tagIds:[],isFavorite:false});
    repo.update("u",saved.id,{title:"My own title"});repo.applyMetadata("u",saved.id,{title:"Page title",titleSource:"page",iconAssetId:null,status:"ready",failureCode:null,finalUrl:"https://example.com/"});
    expect(repo.find("u",saved.id)?.title).toBe("My own title");db.close();
  });
});
