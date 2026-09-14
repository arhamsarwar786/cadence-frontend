"use client";

import { TaskBoard } from "@/features/tasks/components/TaskBoard";

/**
 * Staff home (ARCHITECTURE.md §7: "open tasks / work queue") — the Penpot
 * tasks-board layout: clock + counts on the cream canvas, today's queue in
 * the charcoal card.
 */
export default function StaffHomePage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TaskBoard />
    </div>
  );
}
