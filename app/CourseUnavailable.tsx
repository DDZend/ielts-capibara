import Link from "next/link";
import { ArrowLeft, BookOpen, Clock3 } from "lucide-react";
import type { CourseModule } from "../lib/course-catalog";

export function CourseUnavailable({ module }: { module: CourseModule }) {
  return <main className="course-unavailable"><section><span><Clock3 /></span><small>{module.toUpperCase()} COURSE</small><h1>New lessons are being prepared.</h1><p>Your teacher has temporarily hidden this module while updating its materials. Please return to your study plan and choose another skill.</p><Link href="/dashboard"><ArrowLeft /> Return to dashboard</Link><i><BookOpen /></i></section></main>;
}
