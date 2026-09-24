"use client";

import { TaskBoard } from "@/features/tasks/components/TaskBoard";
import { PageFrame } from "@/shared/ui";

/**
 * Staff home (ARCHITECTURE.md §7: "open tasks / work queue") — the Penpot
 * tasks-board layout: clock + counts on the cream canvas, today's queue in
 * the charcoal card.
 */
export default function StaffHomePage() {
  return (
    <PageFrame className="min-h-0 gap-0">
      <TaskBoard />
    </PageFrame>
  );
}
