import bcrypt from "bcrypt";
import { sql } from "@vercel/postgres";

export interface User {
  id: string;
  email: string;
  name: string | null;
  is_admin: boolean;
  created_at: string;
  last_login: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function createUser(
  email: string,
  password: string,
  name?: string,
  isAdmin: boolean = false
): Promise<User> {
  const passwordHash = await hashPassword(password);

  const result = await sql`
    INSERT INTO users (email, password_hash, name, is_admin)
    VALUES (${email}, ${passwordHash}, ${name || null}, ${isAdmin})
    RETURNING id, email, name, is_admin, created_at, last_login
  `;

  return result.rows[0] as User;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await sql`
    SELECT id, email, name, is_admin, created_at, last_login
    FROM users
    WHERE email = ${email}
  `;

  return (result.rows[0] as User) || null;
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<User | null> {
  const user = await getUserByEmail(email);
  if (!user) return null;

  // Get the password hash
  const result = await sql`
    SELECT password_hash
    FROM users
    WHERE email = ${email}
  `;

  if (!result.rows[0]) return null;

  const passwordHash = result.rows[0].password_hash;
  const isValid = await verifyPassword(password, passwordHash);

  if (!isValid) return null;

  // Update last login
  await sql`
    UPDATE users
    SET last_login = NOW()
    WHERE email = ${email}
  `;

  return user;
}

export async function updateUserPassword(
  email: string,
  newPassword: string
): Promise<boolean> {
  const passwordHash = await hashPassword(newPassword);

  const result = await sql`
    UPDATE users
    SET password_hash = ${passwordHash}
    WHERE email = ${email}
  `;

  return (result.rowCount ?? 0) > 0;
}

export async function deleteUser(email: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM users
    WHERE email = ${email}
  `;

  return (result.rowCount ?? 0) > 0;
}

export async function listUsers(): Promise<User[]> {
  const result = await sql`
    SELECT id, email, name, is_admin, created_at, last_login
    FROM users
    ORDER BY created_at DESC
  `;

  return result.rows as User[];
}
