import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { User } from "@shared/schema";

export interface AuditRequest extends Request {
  user?: User;
  auditData?: {
    tableName: string;
    recordId: number;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    oldData?: any;
    newData?: any;
  };
}

export const auditMiddleware = (tableName: string) => {
  return (req: AuditRequest, res: Response, next: NextFunction) => {
    req.auditData = {
      tableName,
      recordId: 0, // Will be set in the route handler
      action: req.method === 'POST' ? 'CREATE' : req.method === 'PUT' || req.method === 'PATCH' ? 'UPDATE' : 'DELETE'
    };
    next();
  };
};

export const logAudit = async (req: AuditRequest, recordId: number, oldData?: any, newData?: any) => {
  if (!req.auditData || !req.user) return;
  
  try {
    await storage.createAudit({
      tableName: req.auditData.tableName,
      recordId,
      action: req.auditData.action,
      changedBy: req.user.id,
      oldData: oldData ? JSON.parse(JSON.stringify(oldData)) : null,
      newData: newData ? JSON.parse(JSON.stringify(newData)) : null
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
};
