#!/usr/bin/env tsx

import {
  createUser,
  authenticateUser,
  updateUserPassword,
  deleteUser,
  listUsers,
} from "../lib/password-auth";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const commands = {
  create: async (
    email: string,
    password: string,
    name?: string,
    isAdmin: boolean = false
  ) => {
    try {
      const user = await createUser(email, password, name, isAdmin);
      console.log(`✅ User created successfully:`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name || "N/A"}`);
      console.log(`   Admin: ${user.is_admin ? "Yes" : "No"}`);
      console.log(`   ID: ${user.id}`);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      ) {
        console.error(`❌ Error: User with email ${email} already exists`);
      } else {
        console.error(
          `❌ Error creating user:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  },

  authenticate: async (email: string, password: string) => {
    try {
      const user = await authenticateUser(email, password);
      if (user) {
        console.log(`✅ Authentication successful:`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name: ${user.name || "N/A"}`);
        console.log(`   Admin: ${user.is_admin ? "Yes" : "No"}`);
        console.log(`   Last Login: ${user.last_login || "Never"}`);
      } else {
        console.log(`❌ Authentication failed: Invalid email or password`);
      }
    } catch (error: unknown) {
      console.error(
        `❌ Error authenticating user:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  },

  updatePassword: async (email: string, newPassword: string) => {
    try {
      const success = await updateUserPassword(email, newPassword);
      if (success) {
        console.log(`✅ Password updated successfully for ${email}`);
      } else {
        console.log(`❌ User not found: ${email}`);
      }
    } catch (error: unknown) {
      console.error(
        `❌ Error updating password:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  },

  delete: async (email: string) => {
    try {
      const success = await deleteUser(email);
      if (success) {
        console.log(`✅ User deleted successfully: ${email}`);
      } else {
        console.log(`❌ User not found: ${email}`);
      }
    } catch (error: unknown) {
      console.error(
        `❌ Error deleting user:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  },

  list: async () => {
    try {
      const users = await listUsers();
      if (users.length === 0) {
        console.log("No users found");
        return;
      }

      console.log(`📋 Found ${users.length} user(s):`);
      console.log("");

      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   Name: ${user.name || "N/A"}`);
        console.log(`   Admin: ${user.is_admin ? "Yes" : "No"}`);
        console.log(
          `   Created: ${new Date(user.created_at).toLocaleString()}`
        );
        console.log(
          `   Last Login: ${
            user.last_login
              ? new Date(user.last_login).toLocaleString()
              : "Never"
          }`
        );
        console.log("");
      });
    } catch (error: unknown) {
      console.error(
        `❌ Error listing users:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  },
};

function printUsage() {
  console.log("User Management CLI Tool");
  console.log("");
  console.log("Usage: npm run manage-users <command> [options]");
  console.log("");
  console.log("Commands:");
  console.log(
    "  create <email> <password> [name] [--admin]     Create a new user"
  );
  console.log(
    "  auth <email> <password>                        Test user authentication"
  );
  console.log(
    "  update-password <email> <new-password>         Update user password"
  );
  console.log("  delete <email>                                 Delete a user");
  console.log(
    "  list                                           List all users"
  );
  console.log("");
  console.log("Examples:");
  console.log(
    '  npm run manage-users create admin@example.com secret123 "Admin User" --admin'
  );
  console.log("  npm run manage-users auth admin@example.com secret123");
  console.log(
    "  npm run manage-users update-password admin@example.com newpassword"
  );
  console.log("  npm run manage-users delete admin@example.com");
  console.log("  npm run manage-users list");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    return;
  }

  const command = args[0];

  switch (command) {
    case "create": {
      if (args.length < 3) {
        console.error("❌ Error: create command requires email and password");
        return;
      }
      const email = args[1];
      const password = args[2];
      const name = args[3];
      const isAdmin = args.includes("--admin");
      await commands.create(email, password, name, isAdmin);
      break;
    }

    case "auth": {
      if (args.length < 3) {
        console.error("❌ Error: auth command requires email and password");
        return;
      }
      const email = args[1];
      const password = args[2];
      await commands.authenticate(email, password);
      break;
    }

    case "update-password": {
      if (args.length < 3) {
        console.error(
          "❌ Error: update-password command requires email and new password"
        );
        return;
      }
      const email = args[1];
      const newPassword = args[2];
      await commands.updatePassword(email, newPassword);
      break;
    }

    case "delete": {
      if (args.length < 2) {
        console.error("❌ Error: delete command requires email");
        return;
      }
      const email = args[1];
      await commands.delete(email);
      break;
    }

    case "list": {
      await commands.list();
      break;
    }

    default: {
      console.error(`❌ Error: Unknown command "${command}"`);
      printUsage();
    }
  }
}

main().catch(console.error);
