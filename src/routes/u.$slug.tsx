import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/logo";
import { PageFooter, PublicHeader } from "@/components/site-chrome";
import { SocialMark } from "@/components/social-mark";
import { Skeleton } from "@/components/ui/skeleton";
import { getPublicProfile } from "@/lib/housefile/server";
import { initialsFrom } from "@/lib/housefile/profile";

export const Route = createFileRoute("/u/$slug")({
  loader: async ({ params }) => {
    try {
      return await getPublicProfile({ data: params.slug });
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.displayName} — PlanitService`
          : "Profile — PlanitService",
      },
    ],
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { slug } = Route.useParams();
  const initial = Route.useLoaderData();
  const q = useQuery({
    queryKey: ["public-profile", slug],
    queryFn: () => getPublicProfile({ data: slug }),
    initialData: initial ?? undefined,
    retry: false,
  });

  if (q.isLoading && !q.data) {
    return (
      <div className="min-h-screen bg-background px-5 py-10">
        <Skeleton className="mx-auto h-80 max-w-xl" />
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-5">
        <div className="max-w-md space-y-3 text-center">
          <Wordmark />
          <h1 className="font-display text-2xl font-medium">Profile not found</h1>
          <p className="text-sm text-muted-foreground">This share link may be wrong or not live yet.</p>
        </div>
      </main>
    );
  }

  const profile = q.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader path="choose" />
      <main className="mx-auto max-w-xl px-5 py-12">
        <article className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
          <div className="h-28 bg-ink" />
          <div className="px-6 pb-8">
            <div className="-mt-12 mb-4">
              {profile.photoSrc ? (
                <img
                  src={profile.photoSrc}
                  alt=""
                  className="size-24 rounded-full object-cover shadow-[var(--shadow-border)] outline outline-4 outline-card"
                />
              ) : (
                <div className="grid size-24 place-items-center rounded-full bg-muted font-display text-3xl font-medium text-muted-foreground shadow-[var(--shadow-border)] outline outline-4 outline-card">
                  {initialsFrom(profile.displayName)}
                </div>
              )}
            </div>
            <h1 className="font-display text-3xl font-medium tracking-tight">{profile.displayName}</h1>
            {profile.headline ? (
              <p className="mt-1 text-muted-foreground">{profile.headline}</p>
            ) : null}
            {profile.bio ? (
              <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed">{profile.bio}</p>
            ) : null}
            {profile.links.length > 0 ? (
              <ul className="mt-6 flex flex-wrap gap-2">
                {profile.links.map((link) => (
                  <li key={link.key}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-muted px-3 text-sm font-medium hover:bg-secondary hover:text-secondary-foreground"
                    >
                      <SocialMark kind={link.key} />
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </article>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          On PlanitService.{" "}
          <Link to="/" className="underline underline-offset-2">
            The file for the house.
          </Link>
        </p>
      </main>
      <PageFooter />
    </div>
  );
}
