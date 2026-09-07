import { HelpCircle, Mail, LifeBuoy } from 'lucide-react'

export function HandlerHelpPage() {
  return (
    <div>
      <h1>Help</h1>
      <p className="subtitle">Quick reference for the Claims Handler workflow.</p>

      <section className="card">
        <h2>
          <HelpCircle size={16} style={{ verticalAlign: 'text-bottom', marginRight: '0.4rem' }} />
          Getting started
        </h2>
        <p>
          Your <strong>Dashboard</strong> shows every claim currently waiting
          on you, grouped by stage — Awaiting Survey, Awaiting Decision,
          In Repair, and Awaiting Settlement. Click any claim number to open
          its full detail page.
        </p>
      </section>

      <section className="card">
        <h2>Common actions</h2>
        <dl className="fact-grid">
          <dt>Complete a survey</dt>
          <dd>Open the claim → Survey &amp; Assessment → fill in findings → Complete Assessment.</dd>
          <dt>Record a decision</dt>
          <dd>Open the claim → Decision &amp; Review → Approve, Reject, Hold, or Send for Review.</dd>
          <dt>Authorize repair</dt>
          <dd>Move the assignment to In Progress, then approve the repair estimate.</dd>
          <dt>Register a new claim</dt>
          <dd>Use "Register Claim" in the sidebar to intake a claim on a customer's behalf.</dd>
        </dl>
      </section>

      <section className="card">
        <h2>
          <LifeBuoy size={16} style={{ verticalAlign: 'text-bottom', marginRight: '0.4rem' }} />
          Need more help?
        </h2>
        <p>
          <Mail size={14} style={{ verticalAlign: 'text-bottom', marginRight: '0.3rem' }} />
          Contact your Admin for account or access issues.
        </p>
      </section>
    </div>
  )
}