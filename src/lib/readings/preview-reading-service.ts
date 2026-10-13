import { DomainError } from "./errors";
import { RuleBasedInterpretationEngine } from "./interpreter";
import type { AstroResult, PreviewReadingRequest, PreviewReadingResult } from "./types";
import type { RuleRepository } from "./repositories/rule-repository";

export interface GeneratePreviewParams {
  input: PreviewReadingRequest;
  astro: AstroResult;
}

export class PreviewReadingService {
  constructor(
    private readonly ruleRepository: RuleRepository,
    private readonly interpretationEngine = new RuleBasedInterpretationEngine(),
  ) {}

  async generate(params: GeneratePreviewParams): Promise<PreviewReadingResult> {
    const bundle = await this.ruleRepository.getPublishedRuleBundle({
      starId: params.astro.selectedStar.id,
      constellationId: params.astro.selectedConstellation.id ?? null,
      constellationCode: params.astro.selectedConstellation.code,
    });

    if (!bundle) {
      throw new DomainError(
        "RULE_VERSION_NOT_FOUND",
        "Published rule version not found",
        404,
      );
    }

    return this.interpretationEngine.interpret({
      astro: params.astro,
      version: bundle.version,
      rules: bundle.rules,
    });
  }
}
