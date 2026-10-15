import {
  Rocket,
  Settings,
  Lightbulb,
  LifeBuoy,
  Search,
  Gavel,
  Wrench,
  Wallet,
  ShieldCheck,
  Archive,
  ChevronRight,
  FileSearch,
  PlusCircle,
  CheckCircle2,
  Mail,
  BookOpen,
  Phone,
  Info,
} from 'lucide-react'
import type { ReactNode } from 'react'

function FlowStage({
  icon,
  label,
  isLast,
}: {
  icon: ReactNode
  label: string
  isLast?: boolean
}) {
  return (
    <div className="help-flow-stage">
      <div className="help-flow-stage-icon">{icon}</div>
      <span className="help-flow-stage-label">{label}</span>
      {!isLast && <ChevronRight size={16} className="help-flow-arrow" />}
    </div>
  )
}

function ActionCard({
  icon,
  iconTint,
  title,
  description,
}: {
  icon: ReactNode
  iconTint: string
  title: string
  description: string
}) {
  return (
    <div className="help-action-card">
      <span className={`help-action-icon help-action-icon-${iconTint}`}>{icon}</span>
      <div className="help-action-body">
        <p className="help-action-title">{title}</p>
        <p className="help-action-description">{description}</p>
      </div>
      <ChevronRight size={16} className="help-action-chevron" />
    </div>
  )
}

export function HandlerHelpPage() {
  return (
    <div className="help-page">
      <div className="help-header-row">
        <div>
          <h1>Help</h1>
          <p className="subtitle">Quick reference for the Claims Handler workflow.</p>
        </div>
        <div className="help-tip-banner">
          <Lightbulb size={16} />
          <span>Tip: Use this page anytime you need guidance while processing claims.</span>
        </div>
      </div>

      <section className="card help-getting-started-card">
        <div className="help-getting-started-row">
          <div className="help-getting-started-copy">
            <span className="help-section-icon help-section-icon-blue">
              <Rocket size={20} />
            </span>
            <div>
              <h2>Getting started</h2>
              <p>
                Your <strong>Dashboard</strong> shows every claim currently waiting on
                you, grouped by stage — Survey Pending, Under Review, Repair
                Authorization Pending, and On Hold. Click any claim number to open its
                full detail page and lifecycle stepper.
              </p>
            </div>
          </div>

          <div className="help-flow-panel">
            <p className="help-flow-title">Typical claim flow</p>
            <div className="help-flow-row">
              <FlowStage icon={<Search size={18} />} label="Inspection" />
              <FlowStage icon={<Gavel size={18} />} label="Decision Support Risk" />
              <FlowStage icon={<Wrench size={18} />} label="Repair Authorization" />
              <FlowStage icon={<Wallet size={18} />} label="Liability" />
              <FlowStage icon={<ShieldCheck size={18} />} label="Approval" />
              <FlowStage icon={<Archive size={18} />} label="Closure" isLast />
            </div>
            <p className="help-flow-footnote">
              You work on different stages depending on your role and assignments.
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="help-section-header">
          <span className="help-section-icon help-section-icon-blue">
            <Settings size={20} />
          </span>
          <div>
            <h2>Common actions</h2>
            <p className="subtitle" style={{ margin: 0 }}>
              Here are the most frequent tasks you'll perform as a Claims Handler.
            </p>
          </div>
        </div>

        <div className="help-action-grid">
          <ActionCard
            icon={<FileSearch size={20} />}
            iconTint="green"
            title="Complete an inspection"
            description="Open the claim → Inspection → fill in survey findings → Complete Assessment."
          />
          <ActionCard
            icon={<Gavel size={20} />}
            iconTint="purple"
            title="Record a decision"
            description="Open the claim → Decision Support Risk → Approve, Review, or Deny."
          />
          <ActionCard
            icon={<Wrench size={20} />}
            iconTint="amber"
            title="Authorize repair"
            description="Open the claim → Repair Authorization → set status to Authorized, then Submit."
          />
          <ActionCard
            icon={<PlusCircle size={20} />}
            iconTint="blue"
            title="Register a new claim"
            description="Use “Register Claim” in the sidebar to intake a claim on a customer's behalf."
          />
        </div>
      </section>

      <div className="help-two-col-row">
        <section className="card">
          <div className="help-section-header">
            <span className="help-section-icon help-section-icon-amber">
              <Lightbulb size={20} />
            </span>
            <div>
              <h2>Useful tips</h2>
              <p className="subtitle" style={{ margin: 0 }}>
                Make your work faster and more accurate.
              </p>
            </div>
          </div>

          <ul className="help-tip-list">
            <li>
              <CheckCircle2 size={15} />
              Use the search bar to quickly find a claim by number, customer name, or
              vehicle number.
            </li>
            <li>
              <CheckCircle2 size={15} />
              Check the lifecycle stepper in the sidebar to see what's already been
              completed.
            </li>
            <li>
              <CheckCircle2 size={15} />
              Keep all required photos and documents uploaded before completing an
              inspection.
            </li>
            <li>
              <CheckCircle2 size={15} />
              If a claim is on hold, check the remarks for the reason and next steps.
            </li>
            <li>
              <CheckCircle2 size={15} />
              Closing or denying a claim at Repair Authorization ends it there — it
              won't proceed to Liability.
            </li>
          </ul>
        </section>

        <section className="card">
          <div className="help-section-header">
            <span className="help-section-icon help-section-icon-blue">
              <LifeBuoy size={20} />
            </span>
            <div>
              <h2>Need more help?</h2>
              <p className="subtitle" style={{ margin: 0 }}>
                We're here to support you.
              </p>
            </div>
          </div>

          <div className="help-support-grid">
            <div className="help-support-item">
              <Mail size={18} />
              <div>
                <p className="help-support-title">Contact Admin</p>
                <p className="help-support-description">For account or access issues.</p>
              </div>
            </div>
            <div className="help-support-item">
              <BookOpen size={18} />
              <div>
                <p className="help-support-title">View Documentation</p>
                <p className="help-support-description">Step-by-step guides and FAQs.</p>
              </div>
            </div>
            <div className="help-support-item">
              <Phone size={18} />
              <div>
                <p className="help-support-title">Raise a Support Request</p>
                <p className="help-support-description">Log an issue or request assistance.</p>
              </div>
            </div>
          </div>

          <p className="help-support-footnote">
            <Info size={14} />
            If you're still stuck, please reach out to your system administrator.
          </p>
        </section>
      </div>
    </div>
  )
}