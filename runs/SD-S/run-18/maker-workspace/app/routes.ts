import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_library._index.tsx"),
  route("login", "routes/_auth.login.tsx"),
  route("api/auth/*", "routes/api.auth.$.ts"),
  route("api/bookmarks", "routes/api.bookmarks.ts"),
  route("api/bookmarks/:bookmarkId", "routes/api.bookmarks.$bookmarkId.ts"),
  route("api/metadata/preview", "routes/api.metadata.preview.ts"),
  route("api/tags", "routes/api.tags.ts"),
] satisfies RouteConfig;
