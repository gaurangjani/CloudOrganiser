// MongoDB schema for Rule storage
import mongoose, { Schema, Document } from 'mongoose';
import {
  AnyRule,
  RuleType,
  RuleSeverity,
  RuleAction,
  FileTypeRule,
  ContentRule,
  NamingRule,
  FolderRoutingRule,
  AIAssistedRule,
} from '../types/rule.types';

// Mongoose document interface
export interface RuleDocument extends Document {
  name: string;
  description: string;
  type: RuleType;
  priority: number;
  enabled: boolean;
  severity: RuleSeverity;
  action: RuleAction;
  config: Record<string, unknown>;
  organizationId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  toRule(): AnyRule;
}

// Schema definition
const RuleSchema = new Schema<RuleDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    type: {
      type: String,
      required: true,
      enum: ['file_type', 'content', 'naming', 'folder_routing', 'ai_assisted'],
    },
    priority: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 1000,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    action: {
      type: String,
      required: true,
      enum: ['allow', 'block', 'warn', 'move', 'rename', 'tag', 'classify'],
    },
    config: {
      type: Schema.Types.Mixed,
      required: true,
    },
    organizationId: {
      type: String,
      index: true,
    },
    userId: {
      type: String,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: 'rules',
  }
);

// Indexes for efficient querying
RuleSchema.index({ type: 1, enabled: 1 });
RuleSchema.index({ priority: -1 }); // Descending order for priority
RuleSchema.index({ organizationId: 1, userId: 1 });
RuleSchema.index({ enabled: 1, priority: -1 });

// Helper method to convert document to typed Rule
RuleSchema.methods.toRule = function (): AnyRule {
  const doc = this.toObject();

  const baseRule = {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description,
    type: doc.type,
    priority: doc.priority,
    enabled: doc.enabled,
    severity: doc.severity,
    action: doc.action,
    organizationId: doc.organizationId,
    userId: doc.userId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    metadata: doc.metadata,
  };

  // Return typed rule based on type
  switch (doc.type) {
    case 'file_type':
      return { ...baseRule, config: doc.config } as FileTypeRule;
    case 'content':
      return { ...baseRule, config: doc.config } as ContentRule;
    case 'naming':
      return { ...baseRule, config: doc.config } as NamingRule;
    case 'folder_routing':
      return { ...baseRule, config: doc.config } as FolderRoutingRule;
    case 'ai_assisted':
      return { ...baseRule, config: doc.config } as AIAssistedRule;
    default:
      throw new Error(`Unknown rule type: ${doc.type}`);
  }
};

// Create and export the model
export const RuleModel = mongoose.model<RuleDocument>('Rule', RuleSchema);
