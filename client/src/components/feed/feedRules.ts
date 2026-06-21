export type HomeMode = "discovery" | "following";

/** Adaptive Home: show the following feed once the user follows anything, else discovery. */
export function homeMode(followingCount: number): HomeMode {
  return followingCount > 0 ? "following" : "discovery";
}
