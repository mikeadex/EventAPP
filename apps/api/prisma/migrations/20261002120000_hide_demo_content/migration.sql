-- Seed organisations are fabricated: a real venue and a real time with nothing
-- actually happening there. They were useful while the platform was empty and
-- are now visible to real users on a shipped app, who can book a place and turn
-- up to an empty room.
--
-- Rather than delete them (people already hold tickets to some of those events,
-- and a ticket must still open), mark them and keep them out of discovery.
-- `User.seesDemoContent` lets the store-review account still see a populated
-- app, so a reviewer signing in with the supplied credentials gets the full
-- product while everyone else gets only real listings.
--
-- Both columns default to false, so this migration changes nothing on its own.
-- Marking the seed organisations is a separate, reversible step:
--   pnpm --filter @ekklesia/api demo-content

ALTER TABLE "Organization" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "seesDemoContent" BOOLEAN NOT NULL DEFAULT false;

-- No index on either column deliberately. "Organization" has nine rows; an
-- index on a boolean that is false for nearly all of them would never be
-- chosen by the planner, and Prisma cannot express a partial index in the
-- schema, so it would show as drift on every future migrate. Revisit if the
-- table ever gets large enough for the join to show up in a query plan.
