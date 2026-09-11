import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ApiError, createUser, getAllRoles, getAllUsers, updateUser } from '../../lib/api'
import type { RoleResponseDto, UserResponseDto } from '../../lib/types'

export function UsersPage() {
  const [users, setUsers] = useState<UserResponseDto[] | null>(null)
  const [roles, setRoles] = useState<RoleResponseDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [userData, roleData] = await Promise.all([getAllUsers(), getAllRoles()])
      setUsers(userData)
      setRoles(roleData)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const roleName = (roleId: number) =>
    roles.find((r) => r.roleId === roleId)?.roleName ?? `Role ${roleId}`

  const toggleActive = async (user: UserResponseDto) => {
    try {
      await updateUser({ ...user, isActive: !user.isActive })
      setActionMessage(`${user.firstName} ${user.isActive ? 'deactivated' : 'activated'}.`)
      void load()
    } catch (err) {
      setActionMessage(err instanceof ApiError ? err.message : 'Failed to update user.')
    }
  }

  return (
    <div>
      <h1>Users</h1>

      {error && <p className="error-text">{error}</p>}
      {actionMessage && <p className="success-text banner">{actionMessage}</p>}

      {!error && !users && <p>Loading…</p>}

      {users && (
        <div className="table-responsive">
          <table className="queue-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.userId}>
                  <td>
                    {user.firstName} {user.lastName ?? ''}
                  </td>
                  <td>{user.email}</td>
                  <td>{roleName(user.roleId)}</td>
                  <td>{user.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    <button type="button" onClick={() => void toggleActive(user)}>
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserForm
        roles={roles}
        onCreated={(message) => {
          setActionMessage(message)
          void load()
        }}
      />
    </div>
  )
}

function CreateUserForm({
  roles,
  onCreated,
}: {
  roles: RoleResponseDto[]
  onCreated: (message: string) => void
}) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [roleId, setRoleId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveRoleId = roleId ?? roles[0]?.roleId ?? 0

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const user = await createUser({
        roleId: effectiveRoleId,
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
      })
      setFirstName('')
      setLastName('')
      setEmail('')
      setPassword('')
      setPhoneNumber('')
      onCreated(`Created ${user.email}.`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create user.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="card">
      <h2>Create a user</h2>
      <form onSubmit={handleSubmit}>
        <label htmlFor="firstName">First name</label>
        <input
          id="firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />

        <label htmlFor="lastName">Last name</label>
        <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <label htmlFor="phoneNumber">Phone number</label>
        <input
          id="phoneNumber"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
        />

        <label htmlFor="role">Role</label>
        <select
          id="role"
          value={effectiveRoleId}
          onChange={(e) => setRoleId(Number(e.target.value))}
        >
          {roles.map((role) => (
            <option key={role.roleId} value={role.roleId}>
              {role.roleName}
            </option>
          ))}
        </select>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create user'}
        </button>
      </form>
    </section>
  )
}
