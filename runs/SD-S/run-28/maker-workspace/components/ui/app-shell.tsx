"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- sign-out needs a full reload after the session cookie is cleared */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { Brand } from "@/components/ui/brand";

export function AppShell({children,name}:{children:React.ReactNode;name:string}){const path=usePathname();return <div className="app-shell" data-harness-ready="true"><header className="topbar"><Brand/><nav className="topnav" aria-label="Primary"><Link className={`nav-link ${path==="/bookmarks"?"active":""}`} href="/bookmarks">Library</Link><Link aria-label="Archive" className={`nav-link ${path==="/archive"?"active":""}`} href="/archive"><Archive size={16}/><span>Archive</span></Link><button className="icon-button" aria-label={`Sign out ${name}`} title="Sign out" onClick={async()=>{await authClient.signOut();window.location.href="/sign-in";}}><LogOut size={17}/></button></nav></header>{children}<div id="global-live" className="sr-only" aria-live="polite"/></div>}
