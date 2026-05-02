import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the SQL wrapper so authenticateUser can be exercised without a DB.
const mockSql = vi.hoisted(() => vi.fn())
vi.mock('../sql', () => ({
  sql: mockSql,
}))

import {
  authenticateUser,
  hashPassword,
  verifyPassword,
} from '../password-auth'

const buildQueryResult = <T>(rows: T[]) => ({
  rows,
  command: 'SELECT',
  rowCount: rows.length,
  oid: 0,
  fields: [],
})

beforeEach(() => {
  mockSql.mockReset()
})

describe('password-auth', () => {
  describe('hashPassword', () => {
    it('returns a bcrypt-shaped hash that is not the plaintext', async () => {
      const hash = await hashPassword('correct horse battery staple')
      expect(typeof hash).toBe('string')
      expect(hash).not.toBe('correct horse battery staple')
      // bcrypt hashes start with $2 (and the project uses 12 rounds → $2b$12$)
      expect(hash).toMatch(/^\$2[aby]\$12\$/)
      // Standard bcrypt hashes are 60 characters long
      expect(hash).toHaveLength(60)
    }, 10000)

    it('produces a different hash for the same input each call (salted)', async () => {
      const a = await hashPassword('same-password')
      const b = await hashPassword('same-password')
      expect(a).not.toBe(b)
    }, 15000)
  })

  describe('verifyPassword', () => {
    it('returns true for a matching plaintext + hash pair', async () => {
      const hash = await hashPassword('hunter2')
      await expect(verifyPassword('hunter2', hash)).resolves.toBe(true)
    }, 10000)

    it('returns false for a non-matching plaintext', async () => {
      const hash = await hashPassword('hunter2')
      await expect(verifyPassword('not-the-password', hash)).resolves.toBe(
        false
      )
    }, 10000)

    it('returns false for an empty plaintext', async () => {
      const hash = await hashPassword('hunter2')
      await expect(verifyPassword('', hash)).resolves.toBe(false)
    }, 10000)

    it('round-trip: verify(p, await hash(p)) is true', async () => {
      const passwords = ['p@ssw0rd!', 'short', 'a'.repeat(40)]
      for (const p of passwords) {
        const h = await hashPassword(p)
        await expect(verifyPassword(p, h)).resolves.toBe(true)
      }
    }, 30000)
  })

  describe('authenticateUser', () => {
    const sampleUser = {
      id: 'user-1',
      email: 'admin@example.com',
      name: 'Admin',
      is_admin: true,
      created_at: '2024-01-01T00:00:00Z',
      last_login: null,
    }

    it('returns null when the user does not exist', async () => {
      mockSql.mockResolvedValueOnce(buildQueryResult([]))
      const result = await authenticateUser('missing@example.com', 'whatever')
      expect(result).toBeNull()
      // Only one query: the lookup. No password fetch, no UPDATE.
      expect(mockSql).toHaveBeenCalledTimes(1)
    })

    it('returns null when the password hash row is missing', async () => {
      // 1) getUserByEmail succeeds, 2) password_hash query returns no rows
      mockSql
        .mockResolvedValueOnce(buildQueryResult([sampleUser]))
        .mockResolvedValueOnce(buildQueryResult([]))

      const result = await authenticateUser('admin@example.com', 'whatever')
      expect(result).toBeNull()
      expect(mockSql).toHaveBeenCalledTimes(2)
    })

    it('returns null when the password does not match the stored hash', async () => {
      const realHash = await hashPassword('the-correct-password')
      mockSql
        .mockResolvedValueOnce(buildQueryResult([sampleUser]))
        .mockResolvedValueOnce(buildQueryResult([{ password_hash: realHash }]))

      const result = await authenticateUser('admin@example.com', 'wrong')
      expect(result).toBeNull()
      // No UPDATE last_login when auth fails
      expect(mockSql).toHaveBeenCalledTimes(2)
    }, 10000)

    it('returns the user and updates last_login when the password matches', async () => {
      const realHash = await hashPassword('the-correct-password')
      mockSql
        .mockResolvedValueOnce(buildQueryResult([sampleUser]))
        .mockResolvedValueOnce(buildQueryResult([{ password_hash: realHash }]))
        .mockResolvedValueOnce(buildQueryResult([]))

      const result = await authenticateUser(
        'admin@example.com',
        'the-correct-password'
      )
      expect(result).toEqual(sampleUser)
      // Lookup + password fetch + UPDATE last_login
      expect(mockSql).toHaveBeenCalledTimes(3)
    }, 10000)
  })
})
