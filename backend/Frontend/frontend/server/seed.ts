import { db } from "./db";
import { users, workspaces } from "@shared/schema";

async function seed() {
  const [user] = await db
    .insert(users)
    .values({
      auth0Id: "auth0|seed-user",
      email: "seed@infrabox.ai",
      name: "Seed User",
      authProvider: "auth0",
    })
    .onConflictDoNothing({ target: users.auth0Id })
    .returning();

  if (!user) {
    console.log("Seed user already exists");
    return;
  }

  await db
    .insert(workspaces)
    .values({
      userId: user.id,
      name: "Seed Workspace",
    })
    .onConflictDoNothing({ target: workspaces.userId });

  console.log("Seed completed");
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
