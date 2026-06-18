import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus } from "lucide-react";
import { followWorkspace, unfollowWorkspace } from "@/lib/api";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Button } from "@/components/ui/button";

export function FollowButton({
  slug,
  initialFollowing,
  initialCount,
  onChange,
}: {
  slug: string;
  initialFollowing: boolean;
  initialCount: number;
  onChange?: (state: { following: boolean; followerCount: number }) => void;
}) {
  const { user } = useWorkspace();
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link to="/">Sign in to follow</Link>
      </Button>
    );
  }

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !following;
    const prevCount = count;
    const optimisticCount = prevCount + (next ? 1 : -1);
    // optimistic — apply locally and notify the parent immediately
    setFollowing(next);
    setCount(optimisticCount);
    onChange?.({ following: next, followerCount: optimisticCount });
    try {
      const res = next ? await followWorkspace(slug) : await unfollowWorkspace(slug);
      setFollowing(res.following);
      setCount(res.followerCount);
      onChange?.({ following: res.following, followerCount: res.followerCount });
    } catch {
      // revert to the pre-toggle state
      setFollowing(!next);
      setCount(prevCount);
      onChange?.({ following: !next, followerCount: prevCount });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant={following ? "outline" : "brand"}
      size="sm"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
    >
      {following ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
