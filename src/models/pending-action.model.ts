// MongoDB schema for PendingAction storage (human-in-the-loop approval workflow)
import mongoose, { Schema, Document } from 'mongoose';
import {
  PendingAction,
  PendingActionStatus,
  PendingActionSource,
} from '../types/approval.types';

export interface PendingActionDocument extends Omit<PendingAction, 'id'>, Document {}

const FileContextSnapshotSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    userId: { type: String, required: true },
    organizationId: { type: String },
    location: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const RuleActionSchema = new Schema(
  {
    type: { type: String, required: true },
    params: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const PendingActionSchema = new Schema<PendingActionDocument>(
  {
    fileContext: {
      type: FileContextSnapshotSchema,
      required: true,
    },
    source: {
      type: String,
      required: true,
      enum: ['rule', 'ai_classification'] as PendingActionSource[],
    },
    sourceId: { type: String },
    sourceName: { type: String },
    action: {
      type: RuleActionSchema,
      required: true,
    },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    confidenceThreshold: { type: Number, required: true, min: 0, max: 1 },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'approved', 'rejected'] as PendingActionStatus[],
      default: 'pending',
    },
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
    notes: { type: String },
    userId: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'pending_actions',
  },
);

PendingActionSchema.index({ status: 1 });
PendingActionSchema.index({ userId: 1, status: 1 });
PendingActionSchema.index({ organizationId: 1, status: 1 });
PendingActionSchema.index({ 'fileContext.id': 1 });

export const PendingActionModel = mongoose.model<PendingActionDocument>(
  'PendingAction',
  PendingActionSchema,
);
