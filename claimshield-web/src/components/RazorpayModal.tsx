import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  Lock,
  Smartphone,
  Landmark,
  CreditCard,
  Building2,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  Zap,
  ArrowRight,
} from 'lucide-react'

export interface RazorpayPaymentResult {
  paymentId: string
  orderId: string
  signature: string
  method: 'upi' | 'bank_transfer' | 'card' | 'netbanking'
  accountOrVpa: string
  amount: number
}

interface RazorpayModalProps {
  isOpen: boolean
  onClose: () => void
  amount: number
  claimNumber: string
  claimId: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  isPayout?: boolean // true for Instant Claim Payout, false for Policy/Excess Payment
  onSuccess: (result: RazorpayPaymentResult) => void
  onFinish?: () => void
}

export function RazorpayModal({
  isOpen,
  onClose,
  amount,
  claimNumber,
  claimId,
  customerName = 'Claimant',
  customerPhone = '9876543210',
  isPayout = true,
  onSuccess,
  onFinish,
}: RazorpayModalProps) {
  const [activeTab, setActiveTab] = useState<'upi' | 'bank_transfer' | 'card' | 'netbanking'>('upi')
  
  // UPI fields
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>('gpay')
  const [customVpa, setCustomVpa] = useState('')
  
  // Bank fields
  const [accHolder, setAccHolder] = useState(customerName)
  const [accNumber, setAccNumber] = useState('')
  const [confirmAccNumber, setConfirmAccNumber] = useState('')
  const [ifsc, setIfsc] = useState('HDFC0001234')
  
  // Card fields
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardName, setCardName] = useState(customerName)

  // Netbanking
  const [selectedBank, setSelectedBank] = useState('HDFC')

  // Payment states
  const [status, setStatus] = useState<'idle' | 'processing' | 'otp_verify' | 'success' | 'failed'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [simulatedOtp, setSimulatedOtp] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [paymentResult, setPaymentResult] = useState<RazorpayPaymentResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (!isOpen) return null

  const formattedAmount = `₹${Math.round(amount || 0).toLocaleString('en-IN')}`

  const generatePaymentId = () => {
    const randomChars = Math.random().toString(36).substring(2, 12).toUpperCase()
    return isPayout ? `pout_Rzp${randomChars}` : `pay_Rzp${randomChars}`
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStartPayment = () => {
    setFormError(null)

    if (activeTab === 'bank_transfer') {
      if (!accNumber || !confirmAccNumber || !ifsc || !accHolder) {
        setFormError('Please enter all bank account details.')
        return
      }
      if (accNumber !== confirmAccNumber) {
        setFormError('Account numbers do not match.')
        return
      }
    } else if (activeTab === 'upi') {
      if (selectedUpiApp === 'custom' && !customVpa.includes('@')) {
        setFormError('Please enter a valid UPI ID (e.g., name@okhdfcbank).')
        return
      }
    } else if (activeTab === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 15) {
        setFormError('Please enter a valid 16-digit card number.')
        return
      }
    }

    setStatus('processing')
    setStatusMessage(isPayout ? 'Initiating RazorpayX Instant Disbursal…' : 'Connecting to Razorpay Secure Gateway…')

    setTimeout(() => {
      setStatusMessage('Authenticating with NPCI / Banking Network…')
    }, 900)

    setTimeout(() => {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString()
      setSimulatedOtp(generatedOtp)
      setOtpInput(generatedOtp)
      setStatus('otp_verify')
    }, 1800)
  }

  const handleVerifyOtp = (codeToVerify?: string) => {
    const code = codeToVerify || otpInput
    if (!code || code.length < 4) {
      setFormError('Please enter the 6-digit verification code.')
      return
    }

    setStatus('processing')
    setStatusMessage('Verifying authentication and confirming settlement…')

    setTimeout(() => {
      const pId = generatePaymentId()
      const oId = `order_Rzp${Math.random().toString(36).substring(2, 10)}`
      
      let accountOrVpa = ''
      if (activeTab === 'upi') {
        accountOrVpa = selectedUpiApp === 'custom' ? customVpa : `${customerPhone}@${selectedUpiApp}`
      } else if (activeTab === 'bank_transfer') {
        accountOrVpa = `${accNumber} (${ifsc})`
      } else if (activeTab === 'card') {
        accountOrVpa = `Card ending in ${cardNumber.slice(-4) || '4242'}`
      } else {
        accountOrVpa = `${selectedBank} NetBanking`
      }

      const result: RazorpayPaymentResult = {
        paymentId: pId,
        orderId: oId,
        signature: `sig_${Math.random().toString(36).substring(2, 16)}`,
        method: activeTab,
        accountOrVpa,
        amount,
      }

      setPaymentResult(result)
      setStatus('success')
      onSuccess(result)
    }, 1200)
  }

  return (
    <div className="rzp-overlay" onClick={onClose}>
      <motion.div
        className="rzp-modal-container"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      >
        {/* Razorpay Brand Header */}
        <div className="rzp-header">
          <div className="rzp-header-top">
            <div className="rzp-brand">
              <div className="rzp-logo-badge">
                <span className="rzp-logo-r">R</span>
                <span className="rzp-logo-z">azorpay</span>
              </div>
              <span className="rzp-mode-pill">
                <span className="rzp-pulse-dot" /> TEST MODE
              </span>
            </div>
            <button type="button" className="rzp-close-btn" onClick={onClose} title="Close Razorpay">
              ✕
            </button>
          </div>

          <div className="rzp-merchant-info">
            <div className="rzp-merchant-details">
              <span className="rzp-merchant-title">ClaimShield Assurance Ltd.</span>
              <span className="rzp-claim-sub">Claim: {claimNumber} • {isPayout ? 'Instant Fast-Track Settlement' : 'Policy Payment'}</span>
            </div>
            <div className="rzp-amount-badge">
              <span className="rzp-amount-label">{isPayout ? 'Payout Amount' : 'Payable'}</span>
              <span className="rzp-amount-val">{formattedAmount}</span>
            </div>
          </div>
        </div>

        {/* Method Tabs (Docked directly under header when in idle state) */}
        {status === 'idle' && (
          <div className="rzp-tabs">
            <button
              type="button"
              className={`rzp-tab ${activeTab === 'upi' ? 'rzp-tab-active' : ''}`}
              onClick={() => { setActiveTab('upi'); setFormError(null) }}
            >
              <Smartphone size={15} />
              <span>UPI / QR</span>
            </button>

            <button
              type="button"
              className={`rzp-tab ${activeTab === 'bank_transfer' ? 'rzp-tab-active' : ''}`}
              onClick={() => { setActiveTab('bank_transfer'); setFormError(null) }}
            >
              <Landmark size={15} />
              <span>Bank A/C</span>
            </button>

            <button
              type="button"
              className={`rzp-tab ${activeTab === 'card' ? 'rzp-tab-active' : ''}`}
              onClick={() => { setActiveTab('card'); setFormError(null) }}
            >
              <CreditCard size={15} />
              <span>Card</span>
            </button>

            <button
              type="button"
              className={`rzp-tab ${activeTab === 'netbanking' ? 'rzp-tab-active' : ''}`}
              onClick={() => { setActiveTab('netbanking'); setFormError(null) }}
            >
              <Building2 size={15} />
              <span>NetBanking</span>
            </button>
          </div>
        )}

        {/* Modal Body (Scrollable content) */}
        <div className="rzp-body">
          <AnimatePresence mode="wait">
            {/* 1. SELECT PAYMENT/PAYOUT METHOD */}
            {status === 'idle' && (
              <motion.div
                key="form"
                className="rzp-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* Tab 1: UPI */}
                {activeTab === 'upi' && (
                  <div className="rzp-tab-content">
                    <span className="rzp-section-label">Select preferred UPI option</span>
                    <div className="rzp-upi-grid">
                      {[
                        { id: 'gpay', name: 'Google Pay', icon: '🔵 GPay' },
                        { id: 'phonepe', name: 'PhonePe', icon: '🟣 PhonePe' },
                        { id: 'paytm', name: 'Paytm', icon: '🔷 Paytm' },
                        { id: 'bhim', name: 'BHIM UPI', icon: '🟢 BHIM' },
                      ].map((app) => (
                        <div
                          key={app.id}
                          className={`rzp-upi-option ${selectedUpiApp === app.id ? 'rzp-upi-selected' : ''}`}
                          onClick={() => setSelectedUpiApp(app.id)}
                        >
                          <span className="rzp-upi-icon">{app.icon}</span>
                          <span className="rzp-upi-name">{app.name}</span>
                        </div>
                      ))}
                    </div>

                    <div className="rzp-divider">
                      <span>or enter custom UPI ID / VPA</span>
                    </div>

                    <div className="rzp-input-group">
                      <input
                        type="text"
                        placeholder="e.g. mobileNumber@upi or name@okhdfcbank"
                        value={customVpa}
                        onChange={(e) => {
                          setCustomVpa(e.target.value)
                          setSelectedUpiApp('custom')
                        }}
                        className="rzp-input"
                      />
                    </div>
                  </div>
                )}

                {/* Tab 2: Bank Transfer (IMPS / Direct) */}
                {activeTab === 'bank_transfer' && (
                  <div className="rzp-tab-content">
                    <span className="rzp-section-label">Direct Bank Account Details (IMPS / NEFT 24x7)</span>
                    <div className="rzp-form-grid">
                      <div className="rzp-input-group">
                        <label>Account Holder Name</label>
                        <input
                          type="text"
                          value={accHolder}
                          onChange={(e) => setAccHolder(e.target.value)}
                          className="rzp-input"
                          placeholder="Name as per bank record"
                        />
                      </div>

                      <div className="rzp-input-group">
                        <label>Bank Account Number</label>
                        <input
                          type="password"
                          value={accNumber}
                          onChange={(e) => setAccNumber(e.target.value)}
                          className="rzp-input font-mono"
                          placeholder="e.g. 50100234567890"
                        />
                      </div>

                      <div className="rzp-input-group">
                        <label>Confirm Account Number</label>
                        <input
                          type="text"
                          value={confirmAccNumber}
                          onChange={(e) => setConfirmAccNumber(e.target.value)}
                          className="rzp-input font-mono"
                          placeholder="Re-enter bank account number"
                        />
                      </div>

                      <div className="rzp-input-group">
                        <label>IFSC Code</label>
                        <input
                          type="text"
                          value={ifsc}
                          onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                          className="rzp-input font-mono"
                          placeholder="e.g. HDFC0001234"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Card */}
                {activeTab === 'card' && (
                  <div className="rzp-tab-content">
                    <span className="rzp-section-label">Credit / Debit Card</span>
                    <div className="rzp-form-grid">
                      <div className="rzp-input-group">
                        <label>Card Number</label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim())}
                          maxLength={19}
                          className="rzp-input font-mono"
                          placeholder="4532 •••• •••• 8912"
                        />
                      </div>

                      <div className="rzp-input-row">
                        <div className="rzp-input-group">
                          <label>Expiry (MM/YY)</label>
                          <input
                            type="text"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(e.target.value)}
                            maxLength={5}
                            className="rzp-input font-mono"
                            placeholder="12/28"
                          />
                        </div>

                        <div className="rzp-input-group">
                          <label>CVV</label>
                          <input
                            type="password"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value)}
                            maxLength={4}
                            className="rzp-input font-mono"
                            placeholder="•••"
                          />
                        </div>
                      </div>

                      <div className="rzp-input-group">
                        <label>Cardholder Name</label>
                        <input
                          type="text"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                          className="rzp-input"
                          placeholder="Name on card"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 4: NetBanking */}
                {activeTab === 'netbanking' && (
                  <div className="rzp-tab-content">
                    <span className="rzp-section-label">Select Your Bank</span>
                    <div className="rzp-bank-grid">
                      {['HDFC', 'SBI', 'ICICI', 'Axis Bank', 'Kotak', 'PNB'].map((b) => (
                        <div
                          key={b}
                          className={`rzp-bank-card ${selectedBank === b ? 'rzp-bank-selected' : ''}`}
                          onClick={() => setSelectedBank(b)}
                        >
                          <Building2 size={16} />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formError && <p className="rzp-error-banner">{formError}</p>}

                {/* Submit Action */}
                <div className="rzp-footer-actions">
                  <button type="button" className="rzp-pay-btn" onClick={handleStartPayment}>
                    <Lock size={15} />
                    <span>{isPayout ? `Disburse ${formattedAmount} via RazorpayX` : `Pay ${formattedAmount}`}</span>
                    <ArrowRight size={15} />
                  </button>

                  <div className="rzp-security-note">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span>256-Bit SSL Encrypted • PCI-DSS Level 1 Certified</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. PROCESSING SPINNER */}
            {status === 'processing' && (
              <motion.div
                key="processing"
                className="rzp-view rzp-center-view"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="rzp-spinner-wrap"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                >
                  <Loader2 size={44} className="text-blue-500" />
                </motion.div>

                <h3 className="rzp-status-heading">Processing with Razorpay</h3>
                <p className="rzp-status-desc">{statusMessage}</p>

                <div className="rzp-amount-badge-large">
                  <span>Settlement Amount</span>
                  <strong>{formattedAmount}</strong>
                </div>
              </motion.div>
            )}

            {/* 3. SIMULATED 3D SECURE / BANK OTP VERIFICATION */}
            {status === 'otp_verify' && (
              <motion.div
                key="otp"
                className="rzp-view rzp-center-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="rzp-otp-badge-icon">
                  <ShieldCheck size={32} />
                </div>

                <h3 className="rzp-status-heading">Razorpay Bank Authentication</h3>
                <p className="rzp-status-desc">
                  A verification code has been generated to authorize the instant settlement of{' '}
                  <strong>{formattedAmount}</strong> for Claim <strong>{claimNumber}</strong>.
                </p>

                {simulatedOtp && (
                  <div className="rzp-dev-code-box">
                    <span>Razorpay Demo OTP:</span>
                    <strong className="font-mono">{simulatedOtp}</strong>
                    <button
                      type="button"
                      className="rzp-autofill-btn"
                      onClick={() => {
                        setOtpInput(simulatedOtp)
                        handleVerifyOtp(simulatedOtp)
                      }}
                    >
                      <Zap size={13} /> Auto-Fill &amp; Verify
                    </button>
                  </div>
                )}

                <div className="rzp-otp-input-wrap">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    className="rzp-otp-input font-mono"
                    autoFocus
                  />
                </div>

                {formError && <p className="rzp-error-banner">{formError}</p>}

                <div className="rzp-otp-actions">
                  <button type="button" className="rzp-pay-btn" onClick={() => handleVerifyOtp()}>
                    <span>Confirm &amp; Authorize Payout</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              </motion.div>
            )}

            {/* 4. SUCCESS SCREEN */}
            {status === 'success' && paymentResult && (
              <motion.div
                key="success"
                className="rzp-view rzp-center-view"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <div className="rzp-success-badge">
                  <CheckCircle2 size={46} />
                </div>

                <h3 className="rzp-success-title">
                  {isPayout ? 'Payout Disbursed Successfully!' : 'Payment Received!'}
                </h3>
                <p className="rzp-success-desc">
                  {isPayout
                    ? `Amount of ${formattedAmount} has been credited to claimant's verified account via RazorpayX Instant IMPS.`
                    : `Payment of ${formattedAmount} confirmed via Razorpay.`}
                </p>

                {/* Receipt Card */}
                <div className="rzp-receipt-card">
                  <div className="rzp-receipt-row">
                    <span className="rzp-receipt-k">Razorpay ID</span>
                    <span className="rzp-receipt-v font-mono flex-center">
                      {paymentResult.paymentId}
                      <button
                        type="button"
                        className="rzp-copy-icon-btn"
                        onClick={() => handleCopy(paymentResult.paymentId)}
                        title="Copy Payment ID"
                      >
                        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      </button>
                    </span>
                  </div>

                  <div className="rzp-receipt-row">
                    <span className="rzp-receipt-k">Claim Number</span>
                    <span className="rzp-receipt-v">{claimNumber}</span>
                  </div>

                  <div className="rzp-receipt-row">
                    <span className="rzp-receipt-k">Destination / Mode</span>
                    <span className="rzp-receipt-v">{paymentResult.accountOrVpa}</span>
                  </div>

                  <div className="rzp-receipt-row">
                    <span className="rzp-receipt-k">Status</span>
                    <span className="rzp-receipt-status-pill">
                      <span className="rzp-pulse-green" /> COMPLETED (200 OK)
                    </span>
                  </div>

                  <div className="rzp-receipt-row rzp-receipt-total">
                    <span className="rzp-receipt-k">Net Amount</span>
                    <span className="rzp-receipt-amount">{formattedAmount}</span>
                  </div>
                </div>

                <button type="button" className="rzp-finish-btn" onClick={onFinish || onClose}>
                  <span>Continue to Claim Dashboard</span>
                  <ArrowRight size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Razorpay Sub-Footer */}
        <div className="rzp-footer">
          <div className="rzp-footer-badge">
            <ShieldCheck size={12} />
            <span>Razorpay Trusted Payment Gateway</span>
          </div>
          <span className="rzp-footer-id">ID: {claimId.slice(0, 8)}</span>
        </div>
      </motion.div>
    </div>
  )
}
