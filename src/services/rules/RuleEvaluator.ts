// RuleEvaluator – orchestrates all rule handlers and evaluates rules in priority order
import { FileContext } from '../../types/context.types';
import { AIProvider } from '../../types/ai.types';
import {
  Rule,
  RuleFilter,
  RuleEvaluationResult,
  RulesEngineResult,
  RulesRepository,
} from '../../types/rules.types';
import { logger } from '../../config/logger';
import { FileTypeRuleHandler } from './handlers/FileTypeRuleHandler';
import { ContentRuleHandler } from './handlers/ContentRuleHandler';
import { NamingRuleHandler } from './handlers/NamingRuleHandler';
import { FolderRoutingRuleHandler } from './handlers/FolderRoutingRuleHandler';
import { AIAssistedRuleHandler } from './handlers/AIAssistedRuleHandler';
import { ApprovalService } from '../ApprovalService';

/**
 * RuleEvaluatorConfig allows optional configuration of the evaluator
 */
export interface RuleEvaluatorConfig {
  /** AI provider used for 'ai_assisted' rules; if omitted those rules are skipped */
  aiProvider?: AIProvider;
  /**
   * ApprovalService instance.  When provided, matched actions whose confidence
   * is below `confidenceThreshold` are queued for human approval instead of
   * being applied immediately.
   */
  approvalService?: ApprovalService;
  /**
   * Minimum confidence score required to apply an action immediately.
   * Actions below this threshold are queued for approval.
   * Defaults to `ApprovalService.DEFAULT_CONFIDENCE_THRESHOLD` (0.7).
   */
  confidenceThreshold?: number;
}

/**
 * RuleEvaluator is the central class of the modular rules engine.
 *
 * It fetches enabled rules from the repository (ordered by ascending priority),
 * dispatches each rule to the appropriate typed handler, and aggregates the results.
 *
 * Rule types and their corresponding handlers:
 *  - 'file_type'       → FileTypeRuleHandler
 *  - 'content'         → ContentRuleHandler
 *  - 'naming'          → NamingRuleHandler
 *  - 'folder_routing'  → FolderRoutingRuleHandler
 *  - 'ai_assisted'     → AIAssistedRuleHandler
 */
export class RuleEvaluator {
  private repository: RulesRepository;
  private fileTypeHandler: FileTypeRuleHandler;
  private contentHandler: ContentRuleHandler;
  private namingHandler: NamingRuleHandler;
  private folderRoutingHandler: FolderRoutingRuleHandler;
  private aiAssistedHandler: AIAssistedRuleHandler;
  private approvalService?: ApprovalService;
  private confidenceThreshold: number;

  constructor(repository: RulesRepository, config?: RuleEvaluatorConfig) {
    this.repository = repository;
    this.fileTypeHandler = new FileTypeRuleHandler();
    this.contentHandler = new ContentRuleHandler();
    this.namingHandler = new NamingRuleHandler();
    this.folderRoutingHandler = new FolderRoutingRuleHandler();
    this.aiAssistedHandler = new AIAssistedRuleHandler(config?.aiProvider);
    this.approvalService = config?.approvalService;
    this.confidenceThreshold =
      config?.confidenceThreshold ?? ApprovalService.DEFAULT_CONFIDENCE_THRESHOLD;
  }

  /**
   * Evaluate all enabled rules against the supplied FileContext.
   *
   * Rules are fetched from the repository, sorted by ascending priority
   * (lower number = evaluated first), and each one is dispatched to the
   * appropriate handler.
   *
   * When an `approvalService` is configured, matched actions whose confidence
   * is below `confidenceThreshold` are queued for human review instead of
   * being placed in `appliedActions`.
   *
   * @param context - The FileContext to evaluate
   * @param filter  - Optional additional filter applied when fetching rules
   * @returns       - A RulesEngineResult containing matched rules, applied
   *                  actions, and IDs of any actions queued for approval
   */
  async evaluate(context: FileContext, filter?: RuleFilter): Promise<RulesEngineResult> {
    logger.debug(`RuleEvaluator: evaluating rules for file "${context.name}" (${context.id})`);

    const combinedFilter: RuleFilter = { enabled: true, ...filter };
    const rules = await this.repository.findAll(combinedFilter);

    // Sort ascending by priority (lower = higher precedence)
    const sortedRules = rules.slice().sort((a, b) => a.priority - b.priority);

    const evaluationResults: RuleEvaluationResult[] = [];

    for (const rule of sortedRules) {
      const result = await this.evaluateRule(rule, context);
      evaluationResults.push(result);

      if (result.matched) {
        logger.debug(
          `RuleEvaluator: rule "${rule.name}" (${rule.id}) matched for file "${context.name}"`,
        );
      }
    }

    const matchedRules = evaluationResults.filter((r) => r.matched);

    // Separate immediately-applicable actions from those requiring approval
    const appliedActions = [];
    const pendingActionIds: string[] = [];

    for (const ruleResult of matchedRules) {
      const confidence = ruleResult.confidence;
      const needsApproval =
        this.approvalService !== undefined &&
        confidence !== undefined &&
        ApprovalService.requiresApproval(confidence, this.confidenceThreshold);

      if (needsApproval && this.approvalService) {
        for (const action of ruleResult.actions) {
          const pending = await this.approvalService.queueAction({
            fileContext: {
              id: context.id,
              name: context.name,
              userId: context.userId,
              organizationId: context.organizationId,
              location: context.location,
            },
            source: 'rule',
            sourceId: ruleResult.ruleId,
            sourceName: ruleResult.ruleName,
            action,
            confidence: confidence as number,
            confidenceThreshold: this.confidenceThreshold,
            userId: context.userId,
            organizationId: context.organizationId,
          });
          pendingActionIds.push(pending.id);
        }
      } else {
        appliedActions.push(...ruleResult.actions);
      }
    }

    const engineResult: RulesEngineResult = {
      fileContextId: context.id,
      matchedRules,
      totalRulesEvaluated: sortedRules.length,
      appliedActions,
      pendingActionIds,
      timestamp: new Date(),
    };

    logger.debug(
      `RuleEvaluator: ${matchedRules.length}/${sortedRules.length} rules matched for file "${context.name}"` +
        (pendingActionIds.length > 0
          ? `, ${pendingActionIds.length} action(s) queued for approval`
          : ''),
    );

    return engineResult;
  }

  /**
   * Evaluate a single rule against a FileContext.
   * Dispatches to the appropriate handler based on the rule type.
   */
  async evaluateRule(rule: Rule, context: FileContext): Promise<RuleEvaluationResult> {
    switch (rule.type) {
      case 'file_type':
        return this.fileTypeHandler.evaluate(rule, context);

      case 'content':
        return this.contentHandler.evaluate(rule, context);

      case 'naming':
        return this.namingHandler.evaluate(rule, context);

      case 'folder_routing':
        return this.folderRoutingHandler.evaluate(rule, context);

      case 'ai_assisted':
        return this.aiAssistedHandler.evaluate(rule, context);

      default: {
        // Exhaustive check: TypeScript will warn if a new RuleType is added without handling it
        const _exhaustive: never = rule.type;
        logger.warn(`RuleEvaluator: unknown rule type "${_exhaustive as string}" – skipping`);
        return {
          ruleId: rule.id,
          ruleName: rule.name,
          ruleType: rule.type,
          matched: false,
          actions: [],
          metadata: { reason: `Unknown rule type: ${rule.type as string}` },
        };
      }
    }
  }
}

