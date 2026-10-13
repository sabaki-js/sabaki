# Contributing

Thanks for contributing to this module.

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:

```bash
bun install
```

3. Run checks before opening a pull request:

```bash
bun format
bun check
```

## Branch and Commit Style

- Create focused branches (example: feat/programmatic-client-timeout).
- Keep commits small and descriptive.
- Prefer conventional commit prefixes when possible:
  - feat:
  - fix:
  - docs:
  - refactor:
  - test:
  - chore:

## Coding Guidelines

- Use TypeScript with explicit, readable types.
- Avoid introducing any without a strong reason.
- Preserve existing API behavior unless the change is intentional and documented.
- Keep command behavior deterministic for tests and CI use cases.

## Pull Request Checklist

- I ran format and checks locally.
- I added or updated documentation for public behavior changes.
- I added tests for bug fixes or new behavior when applicable.
- I kept changes scoped to one objective.

## Reporting Issues

When opening an issue, include:

- Package version
- Runtime (Node or Bun) and version
- Minimal reproduction steps
- Expected behavior and actual behavior

## Security

Please do not open public issues for vulnerabilities.
See SECURITY.md for responsible disclosure details.
