import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mic,
  FilePlus2,
  Search,
  FileText,
  Car,
  MapPin,
  ShieldCheck,
  CalendarClock,
  Upload,
  CheckCircle2,
  User,
  Eye,
  Wrench,
} from 'lucide-react'
import {
  ApiError,
  getAllCustomers,
  getAllPoliciesForLookup,
  getMyVehicles,
  registerClaimByStaff,
  uploadClaimDocument,
  extractDocumentOcr,
} from '../lib/api'
import type { CustomerResponseDto, PolicyResponseDto, VehicleResponseDto, OcrExtractionResultDto } from '../lib/types'
import { LossTypeName, VehicleLocationName, DocumentType, PolicyTypeName, RepairerType, RepairerTypeName } from '../lib/statuses'
import { REPAIRER_MASTER } from '../lib/repairerMaster'
import { useToast } from '../context/ToastContext'

function formatCurrency(amount: number | null | undefined) {
  return amount != null ? `₹ ${amount.toLocaleString('en-IN')}` : '—'
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '—'
}

// Policy.EndDate is stored as the exclusive cutoff (coverage renews
// starting that day), so the last real day of cover - and what a
// person expects to read as "expires on" - is the day before it.
function formatPolicyEndDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  d.setDate(d.getDate() - 1)
  return d.toLocaleDateString('en-IN')
}

// YYYY-MM-DD, for <input type="date"> value/max/default - built from
// local date components, not .toISOString() (which is UTC and can
// roll over to the wrong day depending on the person's timezone and
// time of day - not what "today" should mean for a date default).
function toDateInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// YYYY-MM-DDTHH:mm, for <input type="datetime-local"> value/max/
// default - same local-time reasoning as toDateInputValue above, with
// the time appended. Used for Date of Loss and Date of Intimation,
// each a single combined date+time picker rather than two separate
// inputs, so staff logging a call about a loss that happened at a
// specific time yesterday can record that exact moment in one field.
function toDateTimeInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${toDateInputValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// A datetime-local input's value (YYYY-MM-DDTHH:mm) has no timezone
// suffix, so passing it straight to `new Date(...)` is parsed as
// local time by every browser - exactly what we want here, matching
// what the person actually picked rather than reinterpreting it as
// UTC.
function parseDateTimeInputValue(value: string): Date {
  return new Date(value)
}

const OCR_MONTH_NAMES: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

// The DOB OCR extracts (see DatePattern in TesseractOcrService.cs) can
// come back as DD-MM-YYYY, DD/MM/YYYY, or DD-MON-YYYY (e.g.
// "15-Aug-1990") - whatever separator and month form the actual
// document uses. This turns whichever of those it finds into the
// YYYY-MM-DD an <input type="date"> needs, or returns null if it
// doesn't look like a real, plausible date - a wrong auto-filled DOB
// silently overwriting what's in the form would be worse than just
// leaving it for manual entry.
function parseOcrDateToInputValue(raw: string): string | null {
  const parts = raw.trim().split(/[\s./-]+/)
  if (parts.length !== 3) return null

  const [dayPart, monthPart, yearPartRaw] = parts

  if (!/^\d{1,2}$/.test(dayPart)) return null
  const day = dayPart.padStart(2, '0')

  let month: string
  if (/^\d{1,2}$/.test(monthPart)) {
    month = monthPart.padStart(2, '0')
  } else {
    const named = OCR_MONTH_NAMES[monthPart.toLowerCase().slice(0, 3)]
    if (!named) return null
    month = named
  }

  let year = yearPartRaw
  if (year.length === 2 && /^\d{2}$/.test(year)) {
    const twoDigit = parseInt(year, 10)
    year = twoDigit > 30 ? `19${year}` : `20${year}`
  }
  if (!/^\d{4}$/.test(year)) return null

  const dayNum = parseInt(day, 10)
  const monthNum = parseInt(month, 10)
  const yearNum = parseInt(year, 10)
  const currentYear = new Date().getFullYear()

  if (
    dayNum < 1 || dayNum > 31 ||
    monthNum < 1 || monthNum > 12 ||
    yearNum < 1900 || yearNum > currentYear
  ) {
    return null
  }

  return `${year}-${month}-${day}`
}

// Checkpoint 5 (Module 3), extended in Checkpoints 8-9 - staff-assisted
// claim registration/intake for the Claims Handler (Surveyor) or Admin.
// A single Policy Number / Customer Code search auto-fills the
// customer, policy, and vehicle - staff types one thing they'd
// realistically have from a phone-in customer, instead of three
// separate dropdowns.
export function StaffRegisterClaimPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [customers, setCustomers] = useState<CustomerResponseDto[]>([])
  const [allPolicies, setAllPolicies] = useState<PolicyResponseDto[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Search box + resolved selection
  const [lookupText, setLookupText] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [policyId, setPolicyId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [vehicles, setVehicles] = useState<VehicleResponseDto[]>([])
  const [vehicleId, setVehicleId] = useState('')
  const [vehicleLoading, setVehicleLoading] = useState(false)

  const [vehicleLocationAtLoss, setVehicleLocationAtLoss] = useState(0)
  const [lossType, setLossType] = useState(0)
  const [dateTimeOfLoss, setDateTimeOfLoss] = useState('')
  const [locationOfLoss, setLocationOfLoss] = useState('')
  const [description, setDescription] = useState('')
  const [estimatedLossAmount, setEstimatedLossAmount] = useState('')

  // Workshop Recommendation drives Repair Recommendation - selecting a
  // workshop auto-fills its associated repairer name (read-only,
  // informational). "No recommendation" locks both fields instead of
  // just leaving them blank, so staff can explicitly record that no
  // recommendation was made rather than it looking like an oversight.
  const [noRecommendation, setNoRecommendation] = useState(false)
  const [workshopMasterId, setWorkshopMasterId] = useState('')
  const [preferredRepairerType, setPreferredRepairerType] = useState('')
  const selectedWorkshop = REPAIRER_MASTER.find((w) => w.id === workshopMasterId) ?? null

  // Checkpoint 9 - intake toggles + date of intimation. Vehicle parked
  // safely defaults ON (the common case); date of intimation defaults
  // to right now but stays editable, since staff may be logging a call
  // that came in earlier.
  const [dateTimeOfIntimation, setDateTimeOfIntimation] = useState(() => toDateTimeInputValue(new Date()))
  const [vehicleParkedSafely, setVehicleParkedSafely] = useState(true)
  const [thirdPartyDamage, setThirdPartyDamage] = useState(false)
  const [policeReported, setPoliceReported] = useState(false)
  const [contactMobileNumber, setContactMobileNumber] = useState('')

  // Driver details are only relevant when the vehicle was NOT parked
  // safely (i.e. someone was actually driving it at the time of loss).
  const [driverName, setDriverName] = useState('')
  const [driverDob, setDriverDob] = useState('')
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const licensePreviewUrl = useMemo(
    () => (licenseFile ? URL.createObjectURL(licenseFile) : null),
    [licenseFile],
  )
  useEffect(() => {
    return () => {
      if (licensePreviewUrl) URL.revokeObjectURL(licensePreviewUrl)
    }
  }, [licensePreviewUrl])

  const [licenseOcr, setLicenseOcr] = useState<OcrExtractionResultDto | null>(null)
  const [licenseOcrLoading, setLicenseOcrLoading] = useState(false)
  const [licenseOcrError, setLicenseOcrError] = useState<string | null>(null)

  // Auto-fills the Driver date of birth field the moment OCR
  // successfully reads one off the uploaded license - re-runs any
  // time a new license is uploaded (licenseOcr changes), so a fresh
  // upload's DOB always wins over whatever was there before. Skipped
  // entirely if the extracted text doesn't parse into a real,
  // plausible date - see parseOcrDateToInputValue - since a wrong
  // auto-filled DOB is worse than an empty field someone fills in by
  // hand.
  useEffect(() => {
    if (!licenseOcr?.dateOfBirth) return

    const parsed = parseOcrDateToInputValue(licenseOcr.dateOfBirth)
    if (!parsed) return

    setDriverDob(parsed)
    showToast('Driver date of birth filled in from the license.', 'info')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenseOcr])

  // Same idea as the DOB effect above, for the Driver name field -
  // ownerName here doubles as "the license holder's name", not just
  // an RC's registered owner (see ExtractOwnerName's fallback
  // heuristic in TesseractOcrService.cs). No parsing/validation needed
  // here the way dates require, since any non-empty extracted string
  // is already usable as-is in a plain text field.
  useEffect(() => {
    if (!licenseOcr?.ownerName) return

    setDriverName(licenseOcr.ownerName)
    showToast('Driver name filled in from the license.', 'info')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenseOcr])

  const [rcFile, setRcFile] = useState<File | null>(null)
  const rcPreviewUrl = useMemo(
    () => (rcFile ? URL.createObjectURL(rcFile) : null),
    [rcFile],
  )
  useEffect(() => {
    return () => {
      if (rcPreviewUrl) URL.revokeObjectURL(rcPreviewUrl)
    }
  }, [rcPreviewUrl])

  const [rcOcr, setRcOcr] = useState<OcrExtractionResultDto | null>(null)
  const [rcOcrLoading, setRcOcrLoading] = useState(false)
  const [rcOcrError, setRcOcrError] = useState<string | null>(null)

  // Shared by both the license and RC upload slots - runs OCR the
  // moment a file is picked, before the claim itself even exists, so
  // whoever is registering the claim can immediately see what the
  // document says (and sanity-check it's the right file) rather than
  // finding out only after submitting. If the OCR request itself
  // fails (network issue, server error, auth), that's surfaced as an
  // actual error message - failing silently here previously meant a
  // real failure looked identical to "nothing to see", giving no clue
  // that anything had gone wrong at all.
  const runOcr = async (
    file: File,
    setResult: (result: OcrExtractionResultDto | null) => void,
    setLoading: (loading: boolean) => void,
    setOcrError: (message: string | null) => void,
  ) => {
    setResult(null)
    setOcrError(null)
    setLoading(true)
    try {
      const result = await extractDocumentOcr(file)
      setResult(result)
    } catch (err) {
      setOcrError(
        err instanceof ApiError
          ? err.message
          : 'Could not reach the OCR service. Check your connection and try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const [listening, setListening] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ claimId: string; claimNumber: string } | null>(null)

  useEffect(() => {
    Promise.all([getAllCustomers(), getAllPoliciesForLookup()])
      .then(([customerData, policyData]) => {
        setCustomers(customerData)
        setAllPolicies(policyData)
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiError ? err.message : 'Failed to load registration data.')
      })
      .finally(() => setLoading(false))
  }, [])

  const customerLabelById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of customers) map[c.customerId] = c.customerName || c.customerCode
    return map
  }, [customers])

  const suggestions = useMemo(() => {
    const q = lookupText.trim().toLowerCase()
    if (!q || policyId) return []
    return allPolicies
      .filter(
        (p) =>
          p.policyNumber.toLowerCase().includes(q) ||
          (customerLabelById[p.customerId] ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [lookupText, allPolicies, customerLabelById, policyId])

  const selectedPolicy = allPolicies.find((p) => p.policyId === policyId)
  const selectedVehicle = vehicles.find((v) => v.vehicleId === vehicleId)

  const handleSelectPolicy = (policy: PolicyResponseDto) => {
    setPolicyId(policy.policyId)
    setCustomerId(policy.customerId)
    setLookupText(`${policy.policyNumber} — ${customerLabelById[policy.customerId] ?? ''}`)
    setShowSuggestions(false)

    setVehicleLoading(true)
    getMyVehicles(policy.customerId)
      .then((data) => {
        setVehicles(data)
        setVehicleId(policy.vehicleId)
      })
      .catch(() => {
        showToast('Found the policy, but could not load its vehicle. Try again.', 'error')
      })
      .finally(() => setVehicleLoading(false))
  }

  const clearSelection = () => {
    setPolicyId('')
    setCustomerId('')
    setVehicles([])
    setVehicleId('')
    setLookupText('')
  }

  const handleMic = () => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognition })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognition })
        .webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      showToast('Voice input is not supported in this browser. Please type your description.', 'error')
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'en-IN'
    recognition.interimResults = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? ''
      setDescription((current) => (current ? `${current} ${transcript}` : transcript))
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setListening(false)

      const message =
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone access was denied. Allow microphone access in your browser and try again.'
          : event.error === 'no-speech'
            ? "Didn't catch that - no speech was detected. Please try again."
            : event.error === 'audio-capture'
              ? 'No microphone was found on this device.'
              : event.error === 'network'
                ? 'Voice recognition could not reach the network. Check your internet connection and try again.'
                : `Voice input failed (${event.error}). Please try again or type your description.`

      showToast(message, 'error')
    }
    recognition.onend = () => setListening(false)

    setListening(true)
    recognition.start()
  }

  // Driver fields only matter (and are only required) when the
  // vehicle was NOT parked safely - i.e. someone was actually driving.
  const driverDetailsNeeded = !vehicleParkedSafely
  const driverLicenseRequired = driverDetailsNeeded && driverName.trim().length > 0

  const canSubmit = useMemo(
    () =>
      !!customerId &&
      !!policyId &&
      !!vehicleId &&
      vehicleLocationAtLoss > 0 &&
      lossType > 0 &&
      !!dateTimeOfLoss &&
      locationOfLoss.trim().length > 0 &&
      description.trim().length >= 10 &&
      (!driverDetailsNeeded ||
        (driverName.trim().length > 0 && !!driverDob && !!licenseFile)) &&
      (contactMobileNumber.length === 0 || contactMobileNumber.length === 10),
    [
      customerId,
      policyId,
      vehicleId,
      vehicleLocationAtLoss,
      lossType,
      dateTimeOfLoss,
      locationOfLoss,
      description,
      driverDetailsNeeded,
      driverName,
      driverDob,
      licenseFile,
      contactMobileNumber,
    ],
  )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const result = await registerClaimByStaff({
        customerId,
        policyId,
        vehicleId,
        vehicleLocationAtLoss,
        lossType,
        dateOfLoss: parseDateTimeInputValue(dateTimeOfLoss).toISOString(),
        locationOfLoss,
        description,
        estimatedLossAmount: estimatedLossAmount ? Number(estimatedLossAmount) : null,
        // No live Repairer-account GUID backs this master-data-driven
        // selection (see repairerMaster.ts), so PreferredRepairerId
        // stays unset here - the workshop + repairer names are both
        // captured as text in workshopRecommendation instead.
        repairerId: null,
        workshopRecommendation:
          !noRecommendation && selectedWorkshop
            ? `${selectedWorkshop.workshopName} (Repairer: ${selectedWorkshop.repairerName})`
            : null,
        preferredRepairerTypeId: preferredRepairerType ? Number(preferredRepairerType) : null,
        driverName: driverDetailsNeeded ? driverName.trim() : null,
        driverDob: driverDetailsNeeded && driverDob ? new Date(driverDob).toISOString() : null,
        vehicleParkedSafely,
        thirdPartyDamage,
        policeReported,
        dateOfIntimation: dateTimeOfIntimation
          ? parseDateTimeInputValue(dateTimeOfIntimation).toISOString()
          : null,
        contactMobileNumber: contactMobileNumber || null,
      })

      if (driverDetailsNeeded && licenseFile) {
        try {
          await uploadClaimDocument(result.claimId, DocumentType.DriverLicense, licenseFile)
        } catch {
          showToast(
            'Claim was registered, but the driver\'s license upload failed. You can upload it from the claim page.',
            'error',
          )
        }
      }

      if (rcFile) {
        try {
          await uploadClaimDocument(result.claimId, DocumentType.RegistrationCertificate, rcFile)
        } catch {
          showToast(
            'Claim was registered, but the registration certificate upload failed. You can upload it from the claim page.',
            'error',
          )
        }
      }

      setSuccess({ claimId: result.claimId, claimNumber: result.claimNumber })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to register claim.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p>Loading…</p>
  }

  if (loadError) {
    return <p className="error-text">{loadError}</p>
  }

  if (success) {
    return (
      <div>
        <h1>Register Claim</h1>
        <section className="card">
          <p className="success-text">
            Claim {success.claimNumber} registered successfully.
          </p>
          <button type="button" onClick={() => navigate(`/claims/${success.claimId}`)}>
            Open claim
          </button>{' '}
          <button
            type="button"
            onClick={() => {
              setSuccess(null)
              clearSelection()
              setVehicleLocationAtLoss(0)
              setLossType(0)
              setDateTimeOfLoss('')
              setLocationOfLoss('')
              setDescription('')
              setEstimatedLossAmount('')
              setWorkshopMasterId('')
              setNoRecommendation(false)
              setDriverName('')
              setDriverDob('')
              setLicenseFile(null)
              setRcFile(null)
              setDateTimeOfIntimation(toDateTimeInputValue(new Date()))
              setVehicleParkedSafely(true)
              setThirdPartyDamage(false)
              setPoliceReported(false)
              setContactMobileNumber('')
            }}
          >
            Register another claim
          </button>
        </section>
      </div>
    )
  }

  return (
    <div>
      <div className="register-claim-topbar">
        <div className="register-claim-title">
          <span className="register-claim-accent" />
          <h1>Register Claim</h1>
        </div>

        <div className="register-claim-search-inline" style={{ position: 'relative' }}>
          <span className="register-claim-search-label">
            <Search size={15} />
            Find customer &amp; policy
          </span>
          <div className="register-claim-search-box">
            <input
              id="policy-lookup"
              value={lookupText}
              onChange={(e) => {
                setLookupText(e.target.value)
                setShowSuggestions(true)
                if (policyId) {
                  // typing again after a selection starts a fresh search
                  setPolicyId('')
                  setCustomerId('')
                  setVehicles([])
                  setVehicleId('')
                }
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g. POL1786680489829 or Anjali Reddy"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="register-claim-suggestions">
                {suggestions.map((p) => (
                  <li key={p.policyId} onMouseDown={() => handleSelectPolicy(p)}>
                    <strong>{p.policyNumber}</strong>
                    <span>{customerLabelById[p.customerId] ?? 'Unknown customer'}</span>
                  </li>
                ))}
              </ul>
            )}
            {showSuggestions && lookupText.trim() && !policyId && suggestions.length === 0 && (
              <ul className="register-claim-suggestions">
                <li className="register-claim-suggestions-empty">No matching policy or customer found.</li>
              </ul>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {(vehicleLoading || selectedPolicy) && (
          <section className="card card-tint-blue">
            {vehicleLoading && <p className="subtitle">Loading vehicle…</p>}

            {selectedPolicy && !vehicleLoading && (
              <dl className="fact-grid fact-grid-rich fact-grid-2col" style={{ marginTop: '1rem' }}>
                <dt>
                  <span className="fact-icon fact-icon-blue">
                    <User size={14} />
                  </span>
                  Customer
                </dt>
                <dd>{customerLabelById[selectedPolicy.customerId] ?? '—'}</dd>

                <dt>
                  <span className="fact-icon fact-icon-teal">
                    <Car size={14} />
                  </span>
                  Vehicle
                </dt>
                <dd>{selectedVehicle?.registrationNumber ?? '—'}</dd>

                <dt>
                  <span className="fact-icon fact-icon-blue">
                    <Car size={14} />
                  </span>
                  Chassis number
                </dt>
                <dd>{selectedVehicle?.chassisNumber || '—'}</dd>

                <dt>
                  <span className="fact-icon fact-icon-teal">
                    <Car size={14} />
                  </span>
                  Engine number
                </dt>
                <dd>{selectedVehicle?.engineNumber || '—'}</dd>

                <dt>
                  <span className="fact-icon fact-icon-teal">
                    <ShieldCheck size={14} />
                  </span>
                  IDV
                </dt>
                <dd>{formatCurrency(selectedPolicy.idv)}</dd>

                <dt>
                  <span className="fact-icon fact-icon-amber">
                    <ShieldCheck size={14} />
                  </span>
                  Policy type
                </dt>
                <dd>
                  {selectedPolicy.policyTypeId
                    ? PolicyTypeName[selectedPolicy.policyTypeId] ?? 'Policy'
                    : '—'}
                </dd>

                <dt>
                  <span className="fact-icon fact-icon-blue">
                    <CalendarClock size={14} />
                  </span>
                  Policy period
                </dt>
                <dd>{formatDate(selectedPolicy.startDate)} – {formatPolicyEndDate(selectedPolicy.endDate)}</dd>

                <dt>
                  <span className="fact-icon fact-icon-teal">
                    <FileText size={14} />
                  </span>
                  Add-ons
                </dt>
                <dd>{selectedPolicy.addOns || '—'}</dd>
              </dl>
            )}
          </section>
        )}

        {/* Incident details - manual */}
        <section className="card card-tint-blue">
          <h2>
            <FileText size={16} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />
            Incident details
          </h2>
          <div className="survey-grid">
            <div className="survey-field">
              <label htmlFor="vehicle-location">Current vehicle location</label>
              <select
                id="vehicle-location"
                value={vehicleLocationAtLoss}
                onChange={(e) => setVehicleLocationAtLoss(Number(e.target.value))}
                required
              >
                <option value={0}>Select…</option>
                {Object.entries(VehicleLocationName).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="survey-field">
              <label htmlFor="loss-type">Type of loss</label>
              <select id="loss-type" value={lossType} onChange={(e) => setLossType(Number(e.target.value))} required>
                <option value={0}>Select…</option>
                {Object.entries(LossTypeName).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="survey-field">
              <label htmlFor="date-of-loss">Date &amp; time of loss</label>
              <input
                id="date-of-loss"
                type="datetime-local"
                value={dateTimeOfLoss}
                onChange={(e) => setDateTimeOfLoss(e.target.value)}
                max={toDateTimeInputValue(new Date())}
                required
              />
            </div>

            <div className="survey-field">
              <label htmlFor="date-of-intimation">
                <CalendarClock size={13} style={{ verticalAlign: '-2px', marginRight: '0.25rem' }} />
                Date &amp; time of intimation
              </label>
              <input
                id="date-of-intimation"
                type="datetime-local"
                value={dateTimeOfIntimation}
                onChange={(e) => setDateTimeOfIntimation(e.target.value)}
                max={toDateTimeInputValue(new Date())}
              />
            </div>

            <div className="survey-field">
              <label htmlFor="location-of-loss">
                <MapPin size={13} style={{ verticalAlign: '-2px', marginRight: '0.25rem' }} />
                Location of loss
              </label>
              <input
                id="location-of-loss"
                list="location-of-loss-options"
                value={locationOfLoss}
                onChange={(e) => setLocationOfLoss(e.target.value)}
                placeholder="Select or type a location"
                required
              />
              <datalist id="location-of-loss-options">
                <option value="Coimbatore" />
                <option value="Chennai" />
                <option value="Madurai" />
                <option value="Tiruchirappalli" />
                <option value="Salem" />
                <option value="Tirunelveli" />
                <option value="Erode" />
                <option value="Vellore" />
                <option value="Thoothukudi" />
                <option value="Thanjavur" />
                <option value="Bengaluru" />
                <option value="Hyderabad" />
                <option value="Mumbai" />
              </datalist>
            </div>

            <div className="survey-field">
              <label htmlFor="contact-mobile">Mobile number</label>
              <input
                id="contact-mobile"
                type="tel"
                inputMode="numeric"
                value={contactMobileNumber}
                onChange={(e) => setContactMobileNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                maxLength={10}
              />
              {contactMobileNumber.length > 0 && contactMobileNumber.length < 10 && (
                <span className="error-text" style={{ fontSize: '0.78rem' }}>
                  Enter all 10 digits
                </span>
              )}
            </div>

            <div className="survey-field survey-field-wide">
              <label style={{ marginBottom: '0.5rem', display: 'block' }}>Additional checks</label>
              <div className="register-claim-toggle-row">
                <div className="register-claim-toggle-item">
                  <button
                    type="button"
                    className={`toggle-switch ${vehicleParkedSafely ? 'on' : ''}`}
                    onClick={() => setVehicleParkedSafely((v) => !v)}
                    aria-pressed={vehicleParkedSafely}
                  >
                    <span
                      className="toggle-switch-knob"
                      style={{ transform: vehicleParkedSafely ? 'translateX(1.4rem)' : 'translateX(0)' }}
                    />
                  </button>
                  <span>Vehicle parked safely during the incident</span>
                </div>

                <div className="register-claim-toggle-item">
                  <button
                    type="button"
                    className={`toggle-switch ${thirdPartyDamage ? 'on' : ''}`}
                    onClick={() => setThirdPartyDamage((v) => !v)}
                    aria-pressed={thirdPartyDamage}
                  >
                    <span
                      className="toggle-switch-knob"
                      style={{ transform: thirdPartyDamage ? 'translateX(1.4rem)' : 'translateX(0)' }}
                    />
                  </button>
                  <span>Any third party damages</span>
                </div>

                <div className="register-claim-toggle-item">
                  <button
                    type="button"
                    className={`toggle-switch ${policeReported ? 'on' : ''}`}
                    onClick={() => setPoliceReported((v) => !v)}
                    aria-pressed={policeReported}
                  >
                    <span
                      className="toggle-switch-knob"
                      style={{ transform: policeReported ? 'translateX(1.4rem)' : 'translateX(0)' }}
                    />
                  </button>
                  <span>Incident reported to police</span>
                </div>
              </div>
            </div>

            {driverDetailsNeeded && (
              <div className="survey-field survey-field-wide">
                <label style={{ marginBottom: '0.5rem', display: 'block' }}>
                  <User size={13} style={{ verticalAlign: '-2px', marginRight: '0.25rem' }} />
                  Driver details
                </label>
                <div className="register-claim-driver-row">
                  <div className="survey-field">
                    <label htmlFor="driver-name">Driver name</label>
                    <input
                      id="driver-name"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Full name of the driver"
                      required={driverDetailsNeeded}
                    />
                  </div>

                  <div className="survey-field">
                    <label htmlFor="driver-dob">Driver date of birth</label>
                    <input
                      id="driver-dob"
                      type="date"
                      value={driverDob}
                      onChange={(e) => setDriverDob(e.target.value)}
                      max={toDateInputValue(new Date())}
                      required={driverDetailsNeeded}
                    />
                  </div>

                  <div className="survey-field">
                    <label htmlFor="driver-license">
                      Driver's license {driverLicenseRequired && <span className="error-text">(required)</span>}
                    </label>
                    <label className="register-claim-upload-slot">
                      <input
                        id="driver-license"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          setLicenseFile(file)
                          if (file)
                            void runOcr(file, setLicenseOcr, setLicenseOcrLoading, setLicenseOcrError)
                          else {
                            setLicenseOcr(null)
                            setLicenseOcrError(null)
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      {licenseFile ? (
                        <>
                          <CheckCircle2 size={16} color="var(--color-success)" />
                          {licenseFile.name}
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Upload license
                        </>
                      )}
                    </label>
                    {licensePreviewUrl && (
                      <a
                        href={licensePreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="register-claim-doc-view-link"
                      >
                        <Eye size={13} /> View document
                      </a>
                    )}
                    {licenseOcrLoading && (
                      <p className="register-claim-ocr-status">Reading document…</p>
                    )}
                    {licenseOcrError && !licenseOcrLoading && (
                      <p className="register-claim-ocr-error">{licenseOcrError}</p>
                    )}
                    {licenseOcr && !licenseOcrLoading && (
                      <div className="register-claim-ocr-result">
                        {licenseOcr.licenseNumber ||
                          licenseOcr.ownerName ||
                          licenseOcr.dateOfBirth ||
                          licenseOcr.validUntil ? (
                          <>
                            {licenseOcr.licenseNumber && (
                              <p>
                                <strong>License No:</strong> {licenseOcr.licenseNumber}
                              </p>
                            )}
                            {licenseOcr.ownerName && (
                              <p>
                                <strong>Name:</strong> {licenseOcr.ownerName}
                              </p>
                            )}
                            {licenseOcr.dateOfBirth && (
                              <p>
                                <strong>DOB:</strong> {licenseOcr.dateOfBirth}
                              </p>
                            )}
                            {licenseOcr.validUntil && (
                              <p>
                                <strong>Valid until:</strong> {licenseOcr.validUntil}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="register-claim-ocr-status">
                            Couldn't read structured details from this document - check the
                            photo is clear, or enter details manually.
                          </p>
                        )}
                        {licenseOcr.rawText && (
                          <details className="register-claim-ocr-raw">
                            <summary>Show raw OCR text</summary>
                            <pre>{licenseOcr.rawText}</pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="survey-field">
                    <label htmlFor="registration-certificate">Registration certificate</label>
                    <label className="register-claim-upload-slot">
                      <input
                        id="registration-certificate"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          setRcFile(file)
                          if (file)
                            void runOcr(file, setRcOcr, setRcOcrLoading, setRcOcrError)
                          else {
                            setRcOcr(null)
                            setRcOcrError(null)
                          }
                        }}
                        style={{ display: 'none' }}
                      />
                      {rcFile ? (
                        <>
                          <CheckCircle2 size={16} color="var(--color-success)" />
                          {rcFile.name}
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Upload RC
                        </>
                      )}
                    </label>
                    {rcPreviewUrl && (
                      <a
                        href={rcPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="register-claim-doc-view-link"
                      >
                        <Eye size={13} /> View document
                      </a>
                    )}
                    {rcOcrLoading && (
                      <p className="register-claim-ocr-status">Reading document…</p>
                    )}
                    {rcOcrError && !rcOcrLoading && (
                      <p className="register-claim-ocr-error">{rcOcrError}</p>
                    )}
                    {rcOcr && !rcOcrLoading && (
                      <div className="register-claim-ocr-result">
                        {rcOcr.registrationNumber || rcOcr.ownerName || rcOcr.chassisNumber ? (
                          <>
                            {rcOcr.registrationNumber && (
                              <p>
                                <strong>Reg. No:</strong> {rcOcr.registrationNumber}
                              </p>
                            )}
                            {rcOcr.ownerName && (
                              <p>
                                <strong>Owner:</strong> {rcOcr.ownerName}
                              </p>
                            )}
                            {rcOcr.chassisNumber && (
                              <p>
                                <strong>Chassis No:</strong> {rcOcr.chassisNumber}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="register-claim-ocr-status">
                            Couldn't read structured details from this document - check the
                            photo is clear, or enter details manually.
                          </p>
                        )}
                        {rcOcr.rawText && (
                          <details className="register-claim-ocr-raw">
                            <summary>Show raw OCR text</summary>
                            <pre>{rcOcr.rawText}</pre>
                          </details>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="survey-field survey-field-wide">
              <label htmlFor="description">Loss Description</label>
              <div className="register-claim-description-row">
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  required
                  placeholder="At least 10 characters. Type, or use the mic to speak the description."
                />
                <button
                  type="button"
                  className={`mic-button ${listening ? 'listening' : ''}`}
                  onClick={handleMic}
                  title="Speak the description"
                >
                  <Mic size={18} />
                </button>
              </div>
            </div>

            <div className="register-claim-repairer-row">
              <div className="survey-field">
                <label htmlFor="estimated-loss">Estimated loss amount (₹)</label>
                <input
                  id="estimated-loss"
                  type="number"
                  min="0"
                  step="0.01"
                  value={estimatedLossAmount}
                  onChange={(e) => setEstimatedLossAmount(e.target.value)}
                />
              </div>

              <div className="survey-field">
                <label htmlFor="workshop-recommendation">
                  <Wrench size={13} style={{ verticalAlign: '-2px', marginRight: '0.25rem' }} />
                  Workshop recommendation
                </label>
                <select
                  id="workshop-recommendation"
                  value={workshopMasterId}
                  disabled={noRecommendation}
                  onChange={(e) => setWorkshopMasterId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {REPAIRER_MASTER.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.workshopName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="survey-field">
                <label htmlFor="repair-recommendation">
                  <Car size={13} style={{ verticalAlign: '-2px', marginRight: '0.25rem' }} />
                  Repair recommendation
                </label>
                <input
                  id="repair-recommendation"
                  value={selectedWorkshop?.repairerName ?? ''}
                  disabled
                  placeholder="Auto-filled once a workshop is selected"
                />
              </div>

              <div className="survey-field">
                <label htmlFor="preferred-repairer-type">Repairer Type</label>
                <select
                  id="preferred-repairer-type"
                  value={preferredRepairerType}
                  disabled={noRecommendation}
                  onChange={(e) => setPreferredRepairerType(e.target.value)}
                >
                  <option value="">Select…</option>
                  {Object.values(RepairerType).map((id) => (
                    <option key={id} value={id}>
                      {RepairerTypeName[id]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="survey-field survey-field-wide">
              <label className="survey-field-checkbox">
                <input
                  type="checkbox"
                  checked={noRecommendation}
                  onChange={(e) => {
                    setNoRecommendation(e.target.checked)
                    if (e.target.checked) setWorkshopMasterId('')
                  }}
                />
                No recommendation
              </label>
            </div>
          </div>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" disabled={submitting || !canSubmit} className="survey-action-primary">
            <FilePlus2 size={16} />
            {submitting ? 'Registering…' : 'Register claim'}
          </button>
        </section>
      </form>
    </div>
  )
}