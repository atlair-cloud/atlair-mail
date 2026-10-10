export class TemplateError extends Error {
  readonly code: string;
  readonly statusCode = 422;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class InvalidTemplateError extends TemplateError {
  readonly path: string;

  constructor(path: string, problem: string) {
    super("ATL_TEMPLATE_INVALID", `${path}: ${problem}`);
    this.path = path;
  }
}

export interface VariableProblems {
  missing: string[];
  unknown: string[];
  invalid: string[];
}

const describe = ({ missing, unknown, invalid }: VariableProblems) =>
  [
    missing.length > 0 && `missing ${missing.join(", ")}`,
    unknown.length > 0 && `not declared by the template: ${unknown.join(", ")}`,
    invalid.length > 0 && `wrong type or too long: ${invalid.join(", ")}`,
  ]
    .filter(Boolean)
    .join("; ");

export class TemplateVariablesError extends TemplateError {
  readonly problems: VariableProblems;

  constructor(problems: VariableProblems) {
    super("ATL_TEMPLATE_VARIABLES", `Template variables: ${describe(problems)}`);
    this.problems = problems;
  }
}
