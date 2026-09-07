import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import {
  ApiError,
  getClaimInvoices,
  createClaimInvoice,
  updateClaimInvoice,
  deleteClaimInvoice,
} from '../lib/api'
import type { InvoiceResponseDto } from '../lib/types'
import { InvoiceFavour, InvoiceFavourName } from '../lib/statuses'
import { useToast } from '../context/ToastContext'
import './InvoiceParticularsCard.css'

interface InvoiceParticularsCardProps {
  claimId: string
  canEdit: boolean
}

interface InvoiceFormValues {
  invoiceDate: string
  invoiceNumber: string
  invoiceAmount: string
  invoiceFavour: number
}

const EMPTY_FORM: InvoiceFormValues = {
  invoiceDate: '',
  invoiceNumber: '',
  invoiceAmount: '',
  invoiceFavour: InvoiceFavour.ClaimShieldPlus,
}

// Invoices document work already done/billed - a future date would
// mean an invoice dated for something that hasn't happened yet, so
// it's disallowed both in the date picker (max attribute) and in
// validation below (browsers on some platforms still allow typing a
// date directly, bypassing the picker's own max).
const todayDateString = new Date().toISOString().slice(0, 10)

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN')
}

function formatAmount(value: number) {
  return `₹ ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function InvoiceParticularsCard({ claimId, canEdit }: InvoiceParticularsCardProps) {
  const { showToast } = useToast()

  const [invoices, setInvoices] = useState<InvoiceResponseDto[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [addingNew, setAddingNew] = useState(false)
  const [newForm, setNewForm] = useState<InvoiceFormValues>(EMPTY_FORM)
  const [savingNew, setSavingNew] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<InvoiceFormValues>(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)

  const loadInvoices = useCallback(async () => {
    try {
      const data = await getClaimInvoices(claimId)
      setInvoices(data)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Failed to load invoices.')
    } finally {
      setLoaded(true)
    }
  }, [claimId])

  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  const validateForm = (form: InvoiceFormValues): string | null => {
    if (!form.invoiceDate) return 'Invoice date is required.'
    if (form.invoiceDate > todayDateString) return 'Invoice date cannot be in the future.'
    if (!form.invoiceNumber.trim()) return 'Invoice number is required.'
    const amount = parseFloat(form.invoiceAmount)
    if (!form.invoiceAmount || isNaN(amount) || amount <= 0) {
      return 'Invoice amount must be greater than zero.'
    }
    return null
  }

  const handleAddSave = async (event: FormEvent) => {
    event.preventDefault()

    const validationError = validateForm(newForm)
    if (validationError) {
      showToast(validationError, 'error')
      return
    }

    setSavingNew(true)
    try {
      await createClaimInvoice(claimId, {
        invoiceDate: new Date(newForm.invoiceDate).toISOString(),
        invoiceNumber: newForm.invoiceNumber.trim(),
        invoiceAmount: parseFloat(newForm.invoiceAmount),
        invoiceFavour: newForm.invoiceFavour,
      })
      setAddingNew(false)
      setNewForm(EMPTY_FORM)
      showToast('Invoice added.', 'success')
      void loadInvoices()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to add invoice.', 'error')
    } finally {
      setSavingNew(false)
    }
  }

  const startEdit = (invoice: InvoiceResponseDto) => {
    setEditingId(invoice.claimInvoiceId)
    setEditForm({
      invoiceDate: invoice.invoiceDate.slice(0, 10),
      invoiceNumber: invoice.invoiceNumber,
      invoiceAmount: String(invoice.invoiceAmount),
      invoiceFavour: invoice.invoiceFavour,
    })
  }

  const handleEditSave = async (event: FormEvent, claimInvoiceId: string) => {
    event.preventDefault()

    const validationError = validateForm(editForm)
    if (validationError) {
      showToast(validationError, 'error')
      return
    }

    setSavingEdit(true)
    try {
      await updateClaimInvoice(claimInvoiceId, {
        invoiceDate: new Date(editForm.invoiceDate).toISOString(),
        invoiceNumber: editForm.invoiceNumber.trim(),
        invoiceAmount: parseFloat(editForm.invoiceAmount),
        invoiceFavour: editForm.invoiceFavour,
      })
      setEditingId(null)
      showToast('Invoice updated.', 'success')
      void loadInvoices()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to update invoice.', 'error')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async (claimInvoiceId: string) => {
    if (!window.confirm('Remove this invoice?')) return

    try {
      await deleteClaimInvoice(claimInvoiceId)
      showToast('Invoice removed.', 'success')
      void loadInvoices()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to remove invoice.', 'error')
    }
  }

  if (!loaded) {
    return null
  }

  return (
    <section className="card invoice-particulars-card">
      <div className="invoice-particulars-header">
        <h2>Invoice Particulars</h2>
        {canEdit && !addingNew && (
          <button
            type="button"
            className="invoice-particulars-add-button"
            onClick={() => {
              setNewForm(EMPTY_FORM)
              setAddingNew(true)
            }}
          >
            <Plus size={14} />
            Add invoice
          </button>
        )}
      </div>

      {loadError && <p className="error-text">{loadError}</p>}

      {invoices.length === 0 && !addingNew && !loadError && (
        <p className="invoice-particulars-empty">No invoices added yet.</p>
      )}

      {(invoices.length > 0 || addingNew) && (
        <table className="invoice-particulars-table">
          <thead>
            <tr>
              <th>Invoice date</th>
              <th>Invoice number</th>
              <th>Invoice amount</th>
              <th>Invoice favour</th>
              {canEdit && <th className="invoice-particulars-actions-col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) =>
              editingId === invoice.claimInvoiceId ? (
                <tr key={invoice.claimInvoiceId} className="invoice-particulars-editing-row">
                  <td>
                    <input
                      type="date"
                      value={editForm.invoiceDate}
                      max={todayDateString}
                      onChange={(e) => setEditForm({ ...editForm, invoiceDate: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={editForm.invoiceNumber}
                      onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
                      placeholder="Invoice number"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.invoiceAmount}
                      onChange={(e) => setEditForm({ ...editForm, invoiceAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </td>
                  <td>
                    <select
                      value={editForm.invoiceFavour}
                      onChange={(e) =>
                        setEditForm({ ...editForm, invoiceFavour: Number(e.target.value) })
                      }
                    >
                      {Object.entries(InvoiceFavourName).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="invoice-particulars-actions-col">
                    <button
                      type="button"
                      className="invoice-particulars-icon-button invoice-particulars-save"
                      disabled={savingEdit}
                      onClick={(e) => void handleEditSave(e, invoice.claimInvoiceId)}
                      aria-label="Save"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      type="button"
                      className="invoice-particulars-icon-button"
                      onClick={() => setEditingId(null)}
                      aria-label="Cancel"
                    >
                      <X size={15} />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={invoice.claimInvoiceId}>
                  <td>{formatDate(invoice.invoiceDate)}</td>
                  <td>{invoice.invoiceNumber}</td>
                  <td>{formatAmount(invoice.invoiceAmount)}</td>
                  <td>
                    <span className="invoice-particulars-favour-pill">
                      {invoice.invoiceFavourName}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="invoice-particulars-actions-col">
                      <button
                        type="button"
                        className="invoice-particulars-icon-button"
                        onClick={() => startEdit(invoice)}
                        aria-label="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="invoice-particulars-icon-button invoice-particulars-delete"
                        onClick={() => void handleDelete(invoice.claimInvoiceId)}
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ),
            )}

            {addingNew && (
              <tr className="invoice-particulars-editing-row">
                <td>
                  <input
                    type="date"
                    value={newForm.invoiceDate}
                    max={todayDateString}
                    onChange={(e) => setNewForm({ ...newForm, invoiceDate: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={newForm.invoiceNumber}
                    onChange={(e) => setNewForm({ ...newForm, invoiceNumber: e.target.value })}
                    placeholder="Invoice number"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newForm.invoiceAmount}
                    onChange={(e) => setNewForm({ ...newForm, invoiceAmount: e.target.value })}
                    placeholder="0.00"
                  />
                </td>
                <td>
                  <select
                    value={newForm.invoiceFavour}
                    onChange={(e) =>
                      setNewForm({ ...newForm, invoiceFavour: Number(e.target.value) })
                    }
                  >
                    {Object.entries(InvoiceFavourName).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="invoice-particulars-actions-col">
                  <button
                    type="button"
                    className="invoice-particulars-icon-button invoice-particulars-save"
                    disabled={savingNew}
                    onClick={(e) => void handleAddSave(e)}
                    aria-label="Save"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    type="button"
                    className="invoice-particulars-icon-button"
                    onClick={() => setAddingNew(false)}
                    aria-label="Cancel"
                  >
                    <X size={15} />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  )
}