import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/book/albin")({ component: BookAlbinRedirect });

function BookAlbinRedirect() {
  return <Navigate to="/s/$slug/book" params={{ slug: "painting-plus" }} />;
}
