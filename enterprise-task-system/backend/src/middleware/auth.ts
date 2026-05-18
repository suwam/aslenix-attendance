import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User, type Role, type UserDocument } from "../models/User";

export type AuthRequest = Request & {
  user: Pick<UserDocument, "_id" | "name" | "email" | "role" | "managerId">;
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Missing bearer token" });

    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret") as { sub: string };
    const user = await User.findById(payload.sub).select("name email role managerId isActive");
    if (!user || !user.isActive) return res.status(401).json({ message: "Inactive account" });

    (req as AuthRequest).user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user;
    if (!roles.includes(user.role as Role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}

export function canManageTasks(role: Role) {
  return role === "admin" || role === "manager";
}
