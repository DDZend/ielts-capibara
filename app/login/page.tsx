import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GraduationCap, LogOut, Presentation, ShieldCheck, Sparkles } from "lucide-react";
import { getStaffAccess } from "../../db/staff";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in | IELTS Mastery",
  description: "Choose the IELTS Mastery workspace you want to enter.",
};

export default async function LoginPage() {
  const user = await getChatGPTUser();
  const staff = user ? await getStaffAccess(user.email, user.displayName) : null;
  const studentHref = user ? "/dashboard" : chatGPTSignInPath("/dashboard");
  const teacherHref = user ? "/teacher" : chatGPTSignInPath("/teacher");

  return (
    <main className="role-login-shell">
      <Link className="role-login-brand" href="/"><span>C</span><b>IELTS Mastery</b></Link>
      <section className="role-login-card">
        <div className="role-login-copy">
          <span><Sparkles /> ONE SECURE ACCOUNT</span>
          <h1>Where would you like to continue?</h1>
          <p>Students and teachers use the same secure sign-in. Your approved role decides which private workspace you can open.</p>
          {user && <div className="role-current-user"><ShieldCheck /><span><small>Signed in as</small><b>{user.displayName}</b><em>{user.email}</em></span><Link href={chatGPTSignOutPath("/login")}><LogOut /> Use another account</Link></div>}
        </div>

        <div className="role-choice-grid">
          <Link className="role-choice student" href={studentHref}>
            <i><GraduationCap /></i><small>STUDENT</small><h2>My learning dashboard</h2>
            <p>Continue lessons, complete mock tests, review progress, and follow your weekly plan.</p>
            <strong>{user ? "Open student dashboard" : "Sign in as a student"} <ArrowRight /></strong>
          </Link>
          <Link className="role-choice teacher" href={teacherHref}>
            <i><Presentation /></i><small>TEACHER</small><h2>Teacher workspace</h2>
            <p>Manage course content, students, classes, memberships, and assessment reviews.</p>
            <strong>{staff?.status === "active" ? "Open teacher workspace" : user ? "Check teacher access" : "Sign in as a teacher"} <ArrowRight /></strong>
          </Link>
        </div>
        <p className="role-login-note"><ShieldCheck /> Teacher access is invitation-based and controlled by the school owner.</p>
      </section>
    </main>
  );
}
