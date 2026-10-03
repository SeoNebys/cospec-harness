import { Brand } from "@/components/ui/brand";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-shell" data-harness-ready="true">
      <section className="auth-art">
        <Brand />
        <div className="auth-copy">
          <div className="eyebrow">A calmer place for useful things</div>
          <h1>Keep the web<br />worth returning to.</h1>
          <p>Save a link in one step. Lattice quietly gathers the title and details, then keeps everything easy to find.</p>
        </div>
        <p className="auth-quote">Your library stays private. Your attention stays yours.</p>
      </section>
      <section className="auth-panel-wrap">{children}</section>
    </main>
  );
}
